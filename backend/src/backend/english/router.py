import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from backend.auth.dependencies import require_student
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.english import service
from backend.english.schemas import (
    EnglishMessageCreateIn,
    EnglishMessageOut,
    EnglishSessionCreateIn,
    EnglishSessionDetailOut,
    EnglishSessionOut,
)
from backend.tutor.rate_limit import tutor_rate_limit

router = APIRouter(
    prefix="/english", tags=["english"], dependencies=[Depends(require_student)]
)

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.post(
    "/sessions", response_model=EnglishSessionOut, status_code=status.HTTP_201_CREATED
)
def create_session(
    payload: EnglishSessionCreateIn,
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> EnglishSessionOut:
    session, topic = service.create_session(db, student, payload)
    return EnglishSessionOut(
        id=session.id,
        lesson_topic=topic,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("/sessions/{session_id}", response_model=EnglishSessionDetailOut)
def get_session(
    session_id: uuid.UUID,
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> EnglishSessionDetailOut:
    from backend.db.models import ChatMessage

    session = service.load_owned_session(db, student, session_id)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return EnglishSessionDetailOut(
        id=session.id,
        lesson_topic=session.title,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[EnglishMessageOut.model_validate(m) for m in messages],
    )


@router.post(
    "/sessions/{session_id}/messages", dependencies=[Depends(tutor_rate_limit)]
)
async def post_message(
    session_id: uuid.UUID,
    payload: EnglishMessageCreateIn,
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    session = service.load_owned_session(db, student, session_id)
    generator = service.stream_message(db, student, session, payload.content)
    return EventSourceResponse(generator, headers=_SSE_HEADERS)
