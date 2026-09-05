"""The generation pipeline: param-validate -> cache probe -> stub row ->
retrieval -> versioned prompt -> LLM stream -> parse+validate -> persist.

An async generator yielding SSE frames, mirroring `backend.ask.service`'s
streaming shape: `token`* (or one `progress` for non-text types) then `done`,
or a single `error`.
"""

import json
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator

from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.db.models import Generation, Teacher
from backend.generation import cache
from backend.generation.content import CONTENT_MODELS, PARAM_MODELS
from backend.generation.prompts import GEN_PROMPTS
from backend.generation.service import ResolvedScope
from backend.llm import LLMError, StreamEnd, TokenDelta, get_llm_client

logger = logging.getLogger("backend.generation")

_ERR_GENERATION = "Medha couldn't build that just now. Try again in a moment."
_ERR_PARSE = "The generated content wasn't formatted correctly. Try again."
_ERR_EMPTY = "Got an empty response. Try again."

# presentation streams a big JSON blob, not readable prose -> show progress, not tokens
_STREAM_AS_PROGRESS = {"presentation"}

_MAX_TOKENS = {
    "lesson_plan": lambda: settings.generation_max_tokens_lesson_plan,
    "question_paper": lambda: settings.generation_max_tokens_question_paper,
    "notes": lambda: settings.generation_max_tokens_notes,
    "quiz": lambda: settings.generation_max_tokens_quiz,
    "presentation": lambda: settings.generation_max_tokens_presentation,
}

_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _extract_json(text: str) -> dict | None:
    stripped = _JSON_FENCE_RE.sub("", text.strip())
    start, end = stripped.find("{"), stripped.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(stripped[start : end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _sse(event: str, payload: dict) -> dict:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


def _title_for(gen_type: str, scope: ResolvedScope, content: dict) -> str:
    base = scope.topic_title or scope.chapter_title or scope.subject_name
    if gen_type == "presentation":
        return (content.get("title") or base or "Presentation").strip()[:160]
    if gen_type == "lesson_plan":
        return (content.get("topic") or base or "Lesson plan").strip()[:160]
    label = {
        "quiz": "Quiz",
        "notes": "Notes",
        "question_paper": "Question paper",
    }.get(gen_type, gen_type.replace("_", " ").title())
    return f"{base} — {label}"[:160] if base else label


async def run(
    db: Session,
    teacher: Teacher,
    gen_type: str,
    scope: ResolvedScope,
    raw_params: dict,
    language: str,
    *,
    source: str = "quick_action",
    session_id: uuid.UUID | None = None,
    parent_generation_id: uuid.UUID | None = None,
) -> AsyncIterator[dict]:
    if not settings.generation_enabled:
        yield _sse("error", {"message": "Content generation is turned off right now.",
                             "fallback": "type_instead"})
        return

    version, build = GEN_PROMPTS[gen_type]
    param_model = PARAM_MODELS[gen_type]
    content_model = CONTENT_MODELS[gen_type]

    # 1. validate the teacher's form inputs
    try:
        params = param_model.model_validate(raw_params or {})
    except ValidationError as exc:
        yield _sse("error", {"message": f"Invalid options: {exc.errors()[0]['msg']}",
                             "fallback": "retry"})
        return

    # 2. cache probe -- serve an existing row, no LLM spend
    key = cache.compute_key(
        gen_type=gen_type,
        grade_id=scope.grade_id,
        subject_id=scope.subject_id,
        chapter_id=scope.chapter_id,
        params=params.model_dump(),
        language=language,
        prompt_version=version,
    )
    if settings.generation_cache_enabled and parent_generation_id is None:
        hit = cache.probe(db, key)
        if hit is not None:
            copy = cache.copy_for(db, teacher.id, hit, session_id=session_id)
            db.commit()
            db.refresh(copy)
            logger.info("generation cache hit type=%s key=%s -> %s", gen_type, key[:12], copy.id)
            yield _sse("done", {"generation_id": str(copy.id), "type": gen_type, "cached": True})
            return

    # 3. stub row -- a dropped connection still records the attempt
    row = Generation(
        teacher_id=teacher.id,
        visibility="private",
        type=gen_type,
        title=_title_for(gen_type, scope, {}),
        language=language,
        grade_id=scope.grade_id,
        subject_id=scope.subject_id,
        chapter_id=scope.chapter_id,
        topic_id=scope.topic_id,
        source=source,
        session_id=session_id,
        parent_generation_id=parent_generation_id,
        input_params=params.model_dump(),
        status="running",
        prompt_version=version,
        cache_key=key,
        model=settings.gemini_model if settings.llm_provider == "gemini" else settings.llm_model,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # 4. retrieval grounding -- [] until embeddings are configured; never fatal
    chunks: list[str] = []
    chunk_ids: list[uuid.UUID] = []
    if scope.topic_id is not None:
        try:
            from backend.retrieval.retriever import Retriever

            retrieved = await Retriever().top_k(
                db, topic_id=scope.topic_id, query=scope.topic_title or scope.subject_name
            )
            chunks = [c.content_text for c in retrieved]
            chunk_ids = [c.id for c in retrieved]
        except Exception as exc:  # noqa: BLE001 -- retrieval must never break a turn
            logger.warning("generation retrieval failed, proceeding ungrounded: %s", exc)

    # 5. build the prompt
    system, messages = build(
        grade_label=scope.grade_label,
        subject_name=scope.subject_name,
        topic_title=scope.topic_title or scope.chapter_title or "this topic",
        topic_description=scope.topic_description,
        language=language,
        chunks=chunks,
        params=params,
    )

    # 6. stream the LLM
    as_progress = gen_type in _STREAM_AS_PROGRESS
    if as_progress:
        yield _sse("progress", {"stage": "generating", "done": 0, "total": 1})
    client = get_llm_client()
    parts: list[str] = []
    tokens_out: int | None = None
    started = time.monotonic()
    try:
        async for event in client.stream(
            system=system, messages=messages, max_tokens=_MAX_TOKENS[gen_type]()
        ):
            if isinstance(event, TokenDelta):
                parts.append(event.text)
                if not as_progress:
                    yield _sse("token", {"text": event.text})
            elif isinstance(event, StreamEnd):
                tokens_out = event.usage.output_tokens
    except LLMError as exc:
        logger.warning("generation failed type=%s: %s", gen_type, exc)
        _fail(db, row, str(exc))
        yield _sse("error", {"message": _ERR_GENERATION, "fallback": "retry"})
        return
    gen_ms = int((time.monotonic() - started) * 1000)

    raw = "".join(parts)
    if not raw.strip():
        _fail(db, row, "empty model output")
        yield _sse("error", {"message": _ERR_EMPTY, "fallback": "retry"})
        return

    # 7. parse + validate against the type's content shape
    blob = _extract_json(raw)
    if blob is None:
        _fail(db, row, "model output was not JSON")
        yield _sse("error", {"message": _ERR_PARSE, "fallback": "retry"})
        return
    try:
        content = content_model.model_validate(blob)
    except ValidationError as exc:
        _fail(db, row, f"content validation: {exc.errors()[0]}")
        logger.warning("generation content invalid type=%s: %s", gen_type, exc.errors()[0])
        yield _sse("error", {"message": _ERR_PARSE, "fallback": "retry"})
        return

    # 8. persist
    row.content_json = content.model_dump(mode="json")
    row.title = _title_for(gen_type, scope, row.content_json)
    row.status = "completed"
    row.completed_at = func.now()
    row.generation_ms = gen_ms
    row.tokens_out = tokens_out
    row.retrieved_chunk_ids = chunk_ids or None
    row.updated_at = func.now()
    db.commit()
    db.refresh(row)

    logger.info(
        "generation type=%s id=%s status=completed gen_ms=%s tokens_out=%s chunks=%s pv=%s",
        gen_type, row.id, gen_ms, tokens_out, len(chunk_ids), version,
    )
    if as_progress:
        yield _sse("progress", {"stage": "done", "done": 1, "total": 1})
    yield _sse("done", {"generation_id": str(row.id), "type": gen_type, "cached": False})


def _fail(db: Session, row: Generation, message: str) -> None:
    row.status = "failed"
    row.error_message = message[:2000]
    row.updated_at = func.now()
    db.commit()
