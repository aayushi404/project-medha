import json
import logging
import re
import uuid
from collections.abc import AsyncIterator

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.chat.schemas import SessionCreateIn
from backend.core.ownership import assert_owned
from backend.db.models import (
    ChatMessage,
    ChatSession,
    CurriculumChapter,
    CurriculumTopic,
    Grade,
    Module,
    ModuleArtifact,
    Subject,
    Teacher,
)
from backend.llm import LLMError, Message, StreamEnd, TokenDelta, get_llm_client
from backend.llm.prompts import activity as activity_prompt
from backend.llm.prompts import explanation
from backend.llm.prompts import quiz as quiz_prompt
from backend.llm.prompts import title as title_prompt
from backend.retrieval.retriever import Retriever

logger = logging.getLogger("backend.chat")

_ERR_GENERATION = "Could not generate a response. Please try again in a moment."
_ERR_EMPTY = "Got an empty response. Please try again."
_ERR_PARSE = "The response wasn't formatted correctly. Please try again."

_GEN_BUILDERS = {"quiz": quiz_prompt, "activity": activity_prompt}


# ---------------------------------------------------------------- sessions

def create_session(db: Session, teacher: Teacher, payload: SessionCreateIn) -> ChatSession:
    if db.get(Grade, payload.grade_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid grade.")
    if db.get(Subject, payload.subject_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid subject.")

    if payload.chapter_id is not None:
        chapter = db.get(CurriculumChapter, payload.chapter_id)
        if (
            chapter is None
            or chapter.grade_id != payload.grade_id
            or chapter.subject_id != payload.subject_id
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Chapter does not match the selected class and subject.",
            )

    if payload.topic_id is not None:
        if payload.chapter_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "chapter_id is required when topic_id is given."
            )
        topic = db.get(CurriculumTopic, payload.topic_id)
        if topic is None or topic.chapter_id != payload.chapter_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Topic does not belong to the selected chapter."
            )

    session = ChatSession(
        teacher_id=teacher.id,
        grade_id=payload.grade_id,
        subject_id=payload.subject_id,
        chapter_id=payload.chapter_id,
        topic_id=payload.topic_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_sessions(db: Session, teacher: Teacher, limit: int = 20) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.teacher_id == teacher.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
        .all()
    )


def load_owned_session(db: Session, teacher: Teacher, session_id: uuid.UUID) -> ChatSession:
    session = db.get(ChatSession, session_id)
    assert_owned(teacher.id, session)
    return session


def get_session_detail(
    db: Session, teacher: Teacher, session_id: uuid.UUID
) -> tuple[ChatSession, list[ChatMessage], uuid.UUID | None]:
    session = load_owned_session(db, teacher, session_id)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    module = db.query(Module).filter(Module.session_id == session.id).first()
    return session, messages, (module.id if module is not None else None)


# ---------------------------------------------------------------- generation

def _history(db: Session, session_id: uuid.UUID, exclude_id: uuid.UUID) -> list[Message]:
    prior = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.id != exclude_id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return [
        Message(role="user" if m.role == "teacher" else "assistant", content=m.content)
        for m in prior
    ]


async def _derive_title(client, language: str, content: str) -> str:
    try:
        system, messages = title_prompt.build(language=language, teacher_query=content)
        completion = await client.complete(system=system, messages=messages, max_tokens=40)
        candidate = completion.text.strip().strip('"').splitlines()[0][:60].strip() if completion.text else ""
        if candidate:
            return candidate
    except LLMError as exc:
        logger.warning("title generation failed: %s", exc)
    fallback = content[:60].rstrip()
    return fallback + ("…" if len(content) > 60 else "")


def _upsert_module(db: Session, teacher: Teacher, session: ChatSession) -> Module:
    module = db.query(Module).filter(Module.session_id == session.id).first()
    if module is None:
        module = Module(
            teacher_id=teacher.id,
            session_id=session.id,
            grade_id=session.grade_id,
            subject_id=session.subject_id,
            topic_id=session.topic_id,
            title=session.title or "Untitled",
        )
        db.add(module)
        db.flush()
    else:
        module.updated_at = func.now()
    return module


def _upsert_artifact(
    db: Session, module: Module, artifact_type: str, content_json: dict
) -> ModuleArtifact:
    """Phase 1 keeps one artifact of each type per module -- replace in place if
    it already exists, otherwise insert."""
    artifact = (
        db.query(ModuleArtifact)
        .filter(
            ModuleArtifact.module_id == module.id,
            ModuleArtifact.artifact_type == artifact_type,
        )
        .first()
    )
    if artifact is None:
        artifact = ModuleArtifact(
            module_id=module.id, artifact_type=artifact_type, content_json=content_json
        )
        db.add(artifact)
        db.flush()
    else:
        artifact.content_json = content_json
    return artifact


def _replace_explanation_artifact(db: Session, module: Module, text: str) -> ModuleArtifact:
    return _upsert_artifact(db, module, "explanation", {"text": text})


def _last_teacher_message(db: Session, session_id: uuid.UUID) -> str | None:
    msg = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.role == "teacher")
        .order_by(ChatMessage.created_at.desc())
        .first()
    )
    return msg.content if msg is not None else None


_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _extract_json(text: str) -> dict | None:
    """Tolerant: strip ``` fences, take the first '{' .. last '}', parse.
    Returns None on any failure -- caller then persists nothing."""
    stripped = _JSON_FENCE_RE.sub("", text.strip())
    start, end = stripped.find("{"), stripped.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(stripped[start : end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _ack_line(artifact_type: str, content_json: dict) -> str:
    if artifact_type == "quiz":
        n = len(content_json.get("questions", []))
        return f"Quiz ready — {n} question{'' if n == 1 else 's'}."
    title = (content_json.get("title") or "").strip()
    return f"Class activity ready{': ' + title if title else ''}."


def _sse(event: str, payload: dict) -> dict:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


async def stream_message(
    db: Session, teacher: Teacher, session: ChatSession, content: str
) -> AsyncIterator[dict]:
    """SSE generator: emits `token` events, then one `done` (or `error`).
    The teacher message is persisted before generation so a dropped
    connection still records the ask."""
    grade = db.get(Grade, session.grade_id)
    subject = db.get(Subject, session.subject_id)
    topic = db.get(CurriculumTopic, session.topic_id) if session.topic_id else None

    teacher_msg = ChatMessage(session_id=session.id, role="teacher", content=content)
    db.add(teacher_msg)
    db.commit()
    db.refresh(teacher_msg)

    history = _history(db, session.id, exclude_id=teacher_msg.id)

    # Retrieval grounding -- returns [] while embeddings aren't configured yet.
    chunks: list[str] = []
    chunk_ids: list[uuid.UUID] = []
    if session.topic_id is not None:
        try:
            retrieved = await Retriever().top_k(db, topic_id=session.topic_id, query=content)
            chunks = [c.content_text for c in retrieved]
            chunk_ids = [c.id for c in retrieved]
        except Exception as exc:  # never let retrieval break generation
            logger.warning("retrieval failed, proceeding ungrounded: %s", exc)

    system, messages = explanation.build(
        grade_label=grade.label,
        subject_name=subject.name,
        topic_title=topic.title if topic else "this topic",
        topic_description=topic.description if topic else None,
        language=teacher.preferred_language,
        chunks=chunks,
        history=history,
        teacher_query=content,
    )

    client = get_llm_client()
    parts: list[str] = []
    output_tokens: int | None = None
    try:
        async for event in client.stream(system=system, messages=messages):
            if isinstance(event, TokenDelta):
                parts.append(event.text)
                yield _sse("token", {"text": event.text})
            elif isinstance(event, StreamEnd):
                output_tokens = event.usage.output_tokens
    except LLMError as exc:
        logger.warning("generation failed: %s", exc)
        yield _sse("error", {"message": _ERR_GENERATION})
        return

    full_text = "".join(parts).strip()
    if not full_text:
        yield _sse("error", {"message": _ERR_EMPTY})
        return

    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=full_text,
        token_count=output_tokens,
        retrieved_chunk_ids=chunk_ids or None,
    )
    db.add(assistant_msg)
    session.updated_at = func.now()
    if session.title is None:
        session.title = await _derive_title(client, teacher.preferred_language, content)

    module = _upsert_module(db, teacher, session)
    if module.title in (None, "Untitled") and session.title:
        module.title = session.title
    artifact = _replace_explanation_artifact(db, module, full_text)

    db.commit()
    db.refresh(assistant_msg)
    db.refresh(module)
    db.refresh(artifact)

    yield _sse(
        "done",
        {
            "module_id": str(module.id),
            "artifact_id": str(artifact.id),
            "message_id": str(assistant_msg.id),
        },
    )


async def run_generator(
    db: Session, teacher: Teacher, session: ChatSession, artifact_type: str
) -> AsyncIterator[dict]:
    """Quick-action generation (quiz | activity). Skips planning, streams raw
    model output, parses the final JSON, and stores it as a module artifact.
    Creates the session's Module if a quick action was hit before any message."""
    builder = _GEN_BUILDERS[artifact_type]
    grade = db.get(Grade, session.grade_id)
    subject = db.get(Subject, session.subject_id)
    topic = db.get(CurriculumTopic, session.topic_id) if session.topic_id else None

    query = _last_teacher_message(db, session.id) or (
        topic.title if topic else f"{grade.label} {subject.name}"
    )

    chunk_ids: list[uuid.UUID] = []
    chunks: list[str] = []
    if session.topic_id is not None:
        try:
            retrieved = await Retriever().top_k(db, topic_id=session.topic_id, query=query)
            chunks = [c.content_text for c in retrieved]
            chunk_ids = [c.id for c in retrieved]
        except Exception as exc:
            logger.warning("retrieval failed, proceeding ungrounded: %s", exc)

    system, messages = builder.build(
        grade_label=grade.label,
        subject_name=subject.name,
        topic_title=topic.title if topic else "this topic",
        topic_description=topic.description if topic else None,
        language=teacher.preferred_language,
        chunks=chunks,
        teacher_query=query,
    )

    client = get_llm_client()
    parts: list[str] = []
    output_tokens: int | None = None
    try:
        async for event in client.stream(system=system, messages=messages):
            if isinstance(event, TokenDelta):
                parts.append(event.text)
                yield _sse("token", {"text": event.text})
            elif isinstance(event, StreamEnd):
                output_tokens = event.usage.output_tokens
    except LLMError as exc:
        logger.warning("generation failed: %s", exc)
        yield _sse("error", {"message": _ERR_GENERATION})
        return

    content_json = _extract_json("".join(parts))
    if content_json is None:
        logger.warning("could not parse %s JSON from model output", artifact_type)
        yield _sse("error", {"message": _ERR_PARSE})
        return
    content_json["_prompt_version"] = builder.VERSION

    if session.title is None:
        session.title = topic.title if topic else f"{grade.label} {subject.name}"
    module = _upsert_module(db, teacher, session)
    if module.title in (None, "Untitled") and session.title:
        module.title = session.title
    artifact = _upsert_artifact(db, module, artifact_type, content_json)

    db.add(
        ChatMessage(
            session_id=session.id,
            role="assistant",
            content=_ack_line(artifact_type, content_json),
            token_count=output_tokens,
            retrieved_chunk_ids=chunk_ids or None,
        )
    )
    session.updated_at = func.now()
    db.commit()
    db.refresh(module)
    db.refresh(artifact)

    yield _sse(
        "done",
        {
            "module_id": str(module.id),
            "artifact_id": str(artifact.id),
            "artifact_type": artifact_type,
        },
    )
