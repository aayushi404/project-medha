import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from backend.auth.dependencies import require_student
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.speech import service as speech_service
from backend.speech.rate_limit import voice_rate_limit_student
from backend.speech.schemas import SpokenTurnIn, VoiceTurnOut
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


@router.post(
    "/sessions/{session_id}/converse",
    dependencies=[Depends(voice_rate_limit_student)],
)
async def converse(
    session_id: uuid.UUID,
    payload: SpokenTurnIn,
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    """One spoken doubt-chat turn. SSE: `token`* -> `audio` (base64 WAV) -> `done`,
    or a single `error`. Same pipeline as the teacher's /speech/converse, with the
    student-facing spoken prompt."""
    session = service.load_owned_session(db, student, session_id)
    generator = speech_service.stream_converse(
        db, student, session, payload.transcript, payload.language, None, kind="doubt"
    )
    return EventSourceResponse(generator, headers=_SSE_HEADERS)


@router.get(
    "/sessions/{session_id}/voice-turns", response_model=list[VoiceTurnOut]
)
def list_voice_turns(
    session_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[VoiceTurnOut]:
    """Recent completed spoken turns for a session, oldest first -- the voice
    panel replays these when it reopens."""
    service.load_owned_session(db, student, session_id)
    turns = speech_service.list_recent_turns(db, session_id, limit)
    return [VoiceTurnOut.model_validate(t) for t in turns]
