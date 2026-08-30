"""Student doubt chat. Reuses the `chat_sessions` / `chat_messages` tables (the
`teacher_id` column is a plain user FK) and the retrieval grounding, but skips
the Module/artifact machinery -- a student's doubt is just a conversation -- and
uses a student-facing prompt.
"""
import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.ownership import assert_owned
from backend.db.models import (
    ChatMessage,
    ChatSession,
    CurriculumChapter,
    CurriculumTopic,
    Grade,
    Subject,
    Teacher,
)
from backend.llm import LLMError, Message, StreamEnd, TokenDelta, get_llm_client
from backend.llm.prompts import doubt as doubt_prompt
from backend.retrieval.retriever import Retriever
from backend.tutor.schemas import TutorSessionCreateIn

logger = logging.getLogger("backend.tutor")

_ERR_GENERATION = "Could not get an answer. Please try again in a moment."
_ERR_EMPTY = "Got an empty answer. Please try again."


def _student_grade_id(student: Teacher) -> uuid.UUID:
    if student.grade_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Your account isn't linked to a class."
        )
    return student.grade_id


def create_session(
    db: Session, student: Teacher, payload: TutorSessionCreateIn
) -> ChatSession:
    grade_id = _student_grade_id(student)

    if db.get(Subject, payload.subject_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid subject.")

    chapter = db.get(CurriculumChapter, payload.chapter_id)
    if (
        chapter is None
        or chapter.grade_id != grade_id
        or chapter.subject_id != payload.subject_id
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Chapter does not match your class and the selected subject.",
        )

    # ground on the chapter's single topic when it has exactly one; otherwise
    # leave it unset and let retrieval return nothing
    topics = (
        db.query(CurriculumTopic)
        .filter(CurriculumTopic.chapter_id == chapter.id)
        .all()
    )
    topic_id = topics[0].id if len(topics) == 1 else None

    session = ChatSession(
        teacher_id=student.id,
        grade_id=grade_id,
        subject_id=payload.subject_id,
        chapter_id=chapter.id,
        topic_id=topic_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_sessions(db: Session, student: Teacher, limit: int = 20) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.teacher_id == student.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
        .all()
    )


def load_owned_session(
    db: Session, student: Teacher, session_id: uuid.UUID
) -> ChatSession:
    session = db.get(ChatSession, session_id)
    assert_owned(student.id, session)
    return session


def get_session_detail(
    db: Session, student: Teacher, session_id: uuid.UUID
) -> tuple[ChatSession, list[ChatMessage]]:
    session = load_owned_session(db, student, session_id)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return session, messages


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


async def _derive_title(client, content: str) -> str:
    fallback = content[:60].rstrip()
    return fallback + ("…" if len(content) > 60 else "")


def _sse(event: str, payload: dict) -> dict:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


async def stream_message(
    db: Session, student: Teacher, session: ChatSession, content: str
) -> AsyncIterator[dict]:
    grade = db.get(Grade, session.grade_id)
    subject = db.get(Subject, session.subject_id)
    chapter = (
        db.get(CurriculumChapter, session.chapter_id) if session.chapter_id else None
    )
    topic = (
        db.get(CurriculumTopic, session.topic_id) if session.topic_id else None
    )

    student_msg = ChatMessage(session_id=session.id, role="student", content=content)
    db.add(student_msg)
    db.commit()
    db.refresh(student_msg)

    history = _history(db, session.id, exclude_id=student_msg.id)

    chunks: list[str] = []
    chunk_ids: list[uuid.UUID] = []
    if session.topic_id is not None:
        try:
            retrieved = await Retriever().top_k(
                db, topic_id=session.topic_id, query=content
            )
            chunks = [c.content_text for c in retrieved]
            chunk_ids = [c.id for c in retrieved]
        except Exception as exc:  # never let retrieval break generation
            logger.warning("retrieval failed, proceeding ungrounded: %s", exc)

    system, messages = doubt_prompt.build(
        grade_label=grade.label,
        subject_name=subject.name,
        chapter_title=chapter.title if chapter else "this chapter",
        topic_title=topic.title if topic else None,
        topic_description=topic.description if topic else None,
        language=student.preferred_language,
        chunks=chunks,
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
        session.title = await _derive_title(client, content)
    db.commit()
    db.refresh(assistant_msg)

    yield _sse("done", {"message_id": str(assistant_msg.id)})
