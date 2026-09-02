"""Learn English — student-facing conversational tutor."""

import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.ownership import assert_owned
from backend.db.models import ChatMessage, ChatSession, Grade, Subject, Teacher
from backend.english.schemas import EnglishSessionCreateIn
from backend.llm import LLMError, Message, StreamEnd, TokenDelta, get_llm_client
from backend.llm.prompts import english as english_prompt

logger = logging.getLogger("backend.english")

_ERR_GENERATION = "Could not get an answer. Please try again in a moment."
_ERR_EMPTY = "Got an empty answer. Please try again."


def _student_grade_id(student: Teacher) -> uuid.UUID:
    if student.grade_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Your account isn't linked to a class."
        )
    return student.grade_id


def _english_subject(db: Session) -> Subject:
    subject = (
        db.query(Subject)
        .filter(func.lower(Subject.name) == "english")
        .first()
    )
    if subject is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "English curriculum is not set up yet.",
        )
    return subject


def create_session(
    db: Session, student: Teacher, payload: EnglishSessionCreateIn
) -> tuple[ChatSession, str | None]:
    grade_id = _student_grade_id(student)
    subject = _english_subject(db)
    topic = (payload.lesson_topic or "").strip() or None

    session = ChatSession(
        teacher_id=student.id,
        grade_id=grade_id,
        subject_id=subject.id,
        chapter_id=None,
        topic_id=None,
        title=topic,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, topic


def load_owned_session(
    db: Session, student: Teacher, session_id: uuid.UUID
) -> ChatSession:
    session = db.get(ChatSession, session_id)
    assert_owned(student.id, session)
    return session


def _history(db: Session, session_id: uuid.UUID, exclude_id: uuid.UUID) -> list[Message]:
    prior = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.id != exclude_id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return [
        Message(role="assistant" if m.role == "assistant" else "user", content=m.content)
        for m in prior
    ]


def _sse(event: str, payload: dict) -> dict:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


async def stream_message(
    db: Session, student: Teacher, session: ChatSession, content: str
) -> AsyncIterator[dict]:
    grade = db.get(Grade, session.grade_id)
    lesson_topic = session.title

    student_msg = ChatMessage(session_id=session.id, role="student", content=content)
    db.add(student_msg)
    db.commit()
    db.refresh(student_msg)

    history = _history(db, session.id, exclude_id=student_msg.id)

    system, messages = english_prompt.build(
        grade_label=grade.label if grade else "your class",
        lesson_topic=lesson_topic,
        language=student.preferred_language,
        chunks=[],
        history=history,
        student_query=content,
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
        logger.warning("english generation failed: %s", exc)
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
    )
    db.add(assistant_msg)
    session.updated_at = func.now()
    if session.title is None:
        session.title = content[:60].rstrip() + ("…" if len(content) > 60 else "")
    db.commit()
    db.refresh(assistant_msg)

    yield _sse("done", {"message_id": str(assistant_msg.id)})
