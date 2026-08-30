import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from backend.auth.dependencies import require_student
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.tutor import service
from backend.tutor.rate_limit import tutor_rate_limit
from backend.tutor.schemas import (
    TutorMessageCreateIn,
    TutorMessageOut,
    TutorSessionCreateIn,
    TutorSessionDetailOut,
    TutorSessionListItem,
    TutorSessionOut,
)

router = APIRouter(
    prefix="/tutor", tags=["tutor"], dependencies=[Depends(require_student)]
)

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.post(
    "/sessions", response_model=TutorSessionOut, status_code=status.HTTP_201_CREATED
)
def create_session(
    payload: TutorSessionCreateIn,
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> TutorSessionOut:
    return service.create_session(db, student, payload)


@router.get("/sessions", response_model=list[TutorSessionListItem])
def list_sessions(
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[TutorSessionListItem]:
    return service.list_sessions(db, student)


@router.get("/sessions/{session_id}", response_model=TutorSessionDetailOut)
def get_session(
    session_id: uuid.UUID,
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> TutorSessionDetailOut:
    session, messages = service.get_session_detail(db, student, session_id)
    return TutorSessionDetailOut(
        id=session.id,
        subject_id=session.subject_id,
        chapter_id=session.chapter_id,
        topic_id=session.topic_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[TutorMessageOut.model_validate(m) for m in messages],
    )


@router.post(
    "/sessions/{session_id}/messages", dependencies=[Depends(tutor_rate_limit)]
)
async def post_message(
    session_id: uuid.UUID,
    payload: TutorMessageCreateIn,
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    session = service.load_owned_session(db, student, session_id)
    generator = service.stream_message(db, student, session, payload.content)
    return EventSourceResponse(generator, headers=_SSE_HEADERS)
