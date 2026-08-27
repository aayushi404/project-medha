import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from backend.auth.dependencies import get_current_teacher
from backend.chat import service
from backend.chat.rate_limit import chat_rate_limit
from backend.chat.schemas import (
    GenerateIn,
    MessageCreateIn,
    MessageOut,
    SessionCreateIn,
    SessionDetailOut,
    SessionListItem,
    SessionOut,
)
from backend.db.models import Teacher
from backend.db.session import get_db

router = APIRouter(prefix="/chat", tags=["chat"])

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreateIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> SessionOut:
    return service.create_session(db, current_teacher, payload)


@router.get("/sessions", response_model=list[SessionListItem])
def list_sessions(
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> list[SessionListItem]:
    return service.list_sessions(db, current_teacher)


@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
def get_session(
    session_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> SessionDetailOut:
    session, messages, module_id = service.get_session_detail(db, current_teacher, session_id)
    return SessionDetailOut(
        id=session.id,
        grade_id=session.grade_id,
        subject_id=session.subject_id,
        chapter_id=session.chapter_id,
        topic_id=session.topic_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[MessageOut.model_validate(m) for m in messages],
        module_id=module_id,
    )


@router.post("/sessions/{session_id}/messages", dependencies=[Depends(chat_rate_limit)])
async def post_message(
    session_id: uuid.UUID,
    payload: MessageCreateIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    # Ownership is checked synchronously here so a 404 is a clean JSON response,
    # not an error mid-stream.
    session = service.load_owned_session(db, current_teacher, session_id)
    generator = service.stream_message(db, current_teacher, session, payload.content)
    return EventSourceResponse(generator, headers=_SSE_HEADERS)


@router.post("/sessions/{session_id}/generate", dependencies=[Depends(chat_rate_limit)])
async def generate_artifact(
    session_id: uuid.UUID,
    payload: GenerateIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    session = service.load_owned_session(db, current_teacher, session_id)
    generator = service.run_generator(db, current_teacher, session, payload.artifact_type)
    return EventSourceResponse(generator, headers=_SSE_HEADERS)
