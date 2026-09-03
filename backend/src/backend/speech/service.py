"""Spoken-conversation turn handler for /speech/converse.

STT runs on the client. Here we stream the LLM reply and, as each sentence
completes, fire a TTS call for it and emit an `audio` frame — so the first
spoken chunk goes out while the model is still writing the rest, instead of
waiting for the whole reply to generate and synthesize. The client
(`SequentialAudioPlayer`) plays the chunks back to back.

Voice turns live in their own `voice_turns` table (see
docs/medha-voice-assistant-plan.md §4), separate from typed `chat_messages`.
"""

import base64
import json
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.db.models import (
    ChatSession,
    CurriculumChapter,
    CurriculumTopic,
    Grade,
    Subject,
    Teacher,
    VoiceTurn,
)
from backend.llm import LLMError, StreamEnd, TokenDelta, get_llm_client
from backend.llm.client import Message
from backend.llm.prompts import voice as voice_prompt
from backend.retrieval.retriever import Retriever
from backend.speech import client as speech_client

logger = logging.getLogger("backend.speech")

_ERR_GENERATION = "Medha couldn't answer just now. Try again, or type instead."
_ERR_EMPTY = "Medha didn't catch that. Say it once more?"

_VALID_STYLES = {"normal", "short", "detail"}


def _sse(event: str, payload: dict) -> dict:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


# A sentence-ish boundary: Devanagari danda, ., !, ? or newline, plus any run of
# them and trailing quotes/brackets/space.
_SENTENCE_END = re.compile(r"[।.!?\n]+[\s\"'”’)\]]*")
# Don't fire a TTS call for a fragment shorter than this — a short lead like
# "Achha, samajh gayi." merges into the next sentence so the speech flows.
_MIN_SPOKEN_CHARS = 30
# Safety valve if the model streams a long run with no punctuation.
_MAX_PENDING_CHARS = 240


def _next_spoken_chunk(buf: str) -> tuple[str, str] | None:
    """If `buf` holds a speakable chunk, return (chunk, remainder); else None.
    Prefers a sentence break at least `_MIN_SPOKEN_CHARS` in; falls back to a
    word gap once the buffer gets long."""
    for m in _SENTENCE_END.finditer(buf):
        if m.end() >= _MIN_SPOKEN_CHARS:
            return buf[: m.end()].strip(), buf[m.end() :]
    if len(buf) > _MAX_PENDING_CHARS:
        cut = buf.rfind(" ", _MIN_SPOKEN_CHARS, _MAX_PENDING_CHARS)
        if cut != -1:
            return buf[:cut].strip(), buf[cut + 1 :]
    return None


async def _audio_frame(text: str, language: str, seq: int) -> tuple[dict, int] | None:
    """Synthesize `text`; return (audio SSE frame, elapsed_ms), or None on failure."""
    text = text.strip()
    if not text:
        return None
    t0 = time.monotonic()
    try:
        audio = await speech_client.synthesize(text, language=language)
    except speech_client.SpeechError as exc:
        logger.warning("voice tts chunk failed (seq=%s): %s", seq, exc)
        return None
    frame = _sse(
        "audio",
        {
            "seq": seq,
            "b64": base64.b64encode(audio.audio_bytes).decode("ascii"),
            "mime": audio.content_type,
        },
    )
    return frame, int((time.monotonic() - t0) * 1000)


def _recent_history(db: Session, session_id: uuid.UUID, exclude_id: uuid.UUID) -> list[Message]:
    """The last few completed voice turns, oldest first, as alternating
    user/assistant messages. Turns still awaiting a reply (stub rows) are
    skipped."""
    rows = (
        db.query(VoiceTurn)
        .filter(
            VoiceTurn.session_id == session_id,
            VoiceTurn.id != exclude_id,
            VoiceTurn.assistant_text.isnot(None),
        )
        .order_by(VoiceTurn.created_at.desc())
        .limit(settings.voice_history_turns)
        .all()
    )
    history: list[Message] = []
    for turn in reversed(rows):
        history.append(Message(role="user", content=turn.user_transcript))
        history.append(Message(role="assistant", content=turn.assistant_text or ""))
    return history


def list_recent_turns(
    db: Session, session_id: uuid.UUID, limit: int = 20
) -> list[VoiceTurn]:
    """The most recent completed turns for a session, oldest first -- what the
    voice panel replays when it reopens. Stub rows (no reply yet) are skipped."""
    rows = (
        db.query(VoiceTurn)
        .filter(
            VoiceTurn.session_id == session_id,
            VoiceTurn.assistant_text.isnot(None),
        )
        .order_by(VoiceTurn.created_at.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))


async def stream_converse(
    db: Session,
    teacher: Teacher,
    session: ChatSession,
    transcript: str,
    language: str | None,
    style: str | None,
) -> AsyncIterator[dict]:
    """SSE generator: `token`* then one `audio` (base64 WAV) then `done`, or a
    single `error`. The teacher's turn is persisted before generation so a
    dropped connection still records what was asked."""
    if not settings.voice_enabled:
        yield _sse("error", {"message": "Voice is turned off right now.", "fallback": "type_instead"})
        return

    grade = db.get(Grade, session.grade_id)
    subject = db.get(Subject, session.subject_id)
    topic = db.get(CurriculumTopic, session.topic_id) if session.topic_id else None
    chapter = (
        db.get(CurriculumChapter, session.chapter_id) if session.chapter_id else None
    )

    # Persist the in-conversation control choices onto the session so they carry
    # to the next turn.
    if style in _VALID_STYLES:
        session.voice_reply_style = style
    if language:
        session.voice_language = language
    reply_style = (style if style in _VALID_STYLES else session.voice_reply_style) or "normal"
    reply_language = language or session.voice_language or teacher.preferred_language

    stub = VoiceTurn(
        session_id=session.id,
        user_transcript=transcript,
        stt_language=reply_language,
    )
    db.add(stub)
    db.commit()
    db.refresh(stub)

    history = _recent_history(db, session.id, exclude_id=stub.id)

    # Retrieval grounding -- [] until embeddings are configured; never fatal.
    chunks: list[str] = []
    if session.topic_id is not None:
        try:
            retrieved = await Retriever().top_k(db, topic_id=session.topic_id, query=transcript)
            chunks = [c.content_text for c in retrieved]
        except Exception as exc:  # noqa: BLE001 -- retrieval must never break a turn
            logger.warning("voice retrieval failed, proceeding ungrounded: %s", exc)

    topic_title = topic.title if topic else (chapter.title if chapter else "this topic")
    system, messages = voice_prompt.build(
        grade_label=grade.label,
        subject_name=subject.name,
        topic_title=topic_title,
        topic_description=topic.description if topic else None,
        language=reply_language,
        chunks=chunks,
        history=history,
        teacher_query=transcript,
        reply_style=reply_style,
        summary=session.voice_summary,
    )
    max_tokens = (
        settings.voice_detail_reply_tokens
        if reply_style == "detail"
        else settings.voice_max_reply_tokens
    )

    client = get_llm_client()
    parts: list[str] = []
    pending = ""  # streamed text not yet handed to TTS
    tokens_out: int | None = None
    seq = 0
    tts_ms_total = 0
    first_audio_ms: int | None = None
    llm_started = time.monotonic()

    async def _emit(chunk: str):
        """Synthesize one chunk and, on success, yield its audio frame."""
        nonlocal seq, tts_ms_total, first_audio_ms
        made = await _audio_frame(chunk, reply_language, seq)
        if made is None:
            return
        frame, ms = made
        tts_ms_total += ms
        if first_audio_ms is None:
            first_audio_ms = int((time.monotonic() - llm_started) * 1000)
        seq += 1
        yield frame

    try:
        async for event in client.stream(system=system, messages=messages, max_tokens=max_tokens):
            if isinstance(event, TokenDelta):
                parts.append(event.text)
                pending += event.text
                yield _sse("token", {"text": event.text})
                split = _next_spoken_chunk(pending)
                if split is not None:
                    chunk, pending = split
                    async for frame in _emit(chunk):
                        yield frame
            elif isinstance(event, StreamEnd):
                tokens_out = event.usage.output_tokens
    except LLMError as exc:
        logger.warning("voice generation failed: %s", exc)
        yield _sse("error", {"message": _ERR_GENERATION, "fallback": "type_instead"})
        return
    llm_ms = int((time.monotonic() - llm_started) * 1000)

    reply = "".join(parts).strip()
    if not reply:
        yield _sse("error", {"message": _ERR_EMPTY, "fallback": "retry"})
        return

    # Speak whatever is left after the last sentence break.
    if pending.strip():
        async for frame in _emit(pending):
            yield frame

    # Non-fatal: a partial failure just drops that sentence's audio (the caption
    # still has the text). Only when nothing was spoken does the client fall
    # back to browser speech for the whole reply.
    tts_failed = seq == 0

    stub.assistant_text = reply
    stub.llm_ms = llm_ms
    stub.tts_ms = tts_ms_total or None
    stub.tokens_out = tokens_out
    stub.tts_chars = len(reply)
    session.updated_at = func.now()
    db.commit()
    db.refresh(stub)

    logger.info(
        "voice_turn session=%s turn=%s style=%s lang=%s chunks=%s llm_ms=%s "
        "first_audio_ms=%s tts_ms=%s tokens_out=%s tts_failed=%s",
        session.id,
        stub.id,
        reply_style,
        reply_language,
        seq,
        llm_ms,
        first_audio_ms,
        tts_ms_total,
        tokens_out,
        tts_failed,
    )

    yield _sse(
        "done",
        {
            "turn_id": str(stub.id),
            "reply_style": reply_style,
            "tts_failed": tts_failed,
            **({"fallback": "browser_tts"} if tts_failed else {}),
        },
    )
