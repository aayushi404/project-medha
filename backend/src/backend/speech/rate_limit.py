import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_teacher, require_student
from backend.core.config import settings
from backend.db.models import ChatSession, Teacher, VoiceTurn
from backend.db.session import get_db


def _enforce_voice_rate(db: Session, user_id: uuid.UUID) -> None:
    """Cap /speech converse turns (LLM + TTS spend) for one user in two trailing
    windows -- same DB-count approach as chat_rate_limit; a Redis token bucket
    can replace it later on the same config keys. Teacher and student voice
    turns both land in `voice_turns` keyed by the owning `chat_sessions` row."""
    now = datetime.now(timezone.utc)

    def count_since(delta: timedelta) -> int:
        return (
            db.query(func.count(VoiceTurn.id))
            .join(ChatSession, VoiceTurn.session_id == ChatSession.id)
            .filter(
                ChatSession.teacher_id == user_id,
                VoiceTurn.created_at >= now - delta,
            )
            .scalar()
        ) or 0

    if count_since(timedelta(minutes=1)) >= settings.voice_rate_limit_per_min:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You're talking to Medha too quickly. Wait a moment.",
        )
    if count_since(timedelta(days=1)) >= settings.voice_rate_limit_per_day:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily voice limit reached. Try again tomorrow.",
        )


def voice_rate_limit(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> None:
    """Per-teacher cap on /speech/converse."""
    _enforce_voice_rate(db, teacher.id)


def voice_rate_limit_student(
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    """Per-student cap on the /tutor and /english converse routes."""
    _enforce_voice_rate(db, student.id)
