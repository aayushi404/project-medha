from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_student
from backend.core.config import settings
from backend.db.models import ChatMessage, ChatSession, Teacher
from backend.db.session import get_db


def tutor_rate_limit(
    student: Teacher = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    """Per-student cap on the doubt-chat endpoint, mirroring `chat_rate_limit`."""
    now = datetime.now(timezone.utc)

    def count_since(delta: timedelta) -> int:
        return (
            db.query(func.count(ChatMessage.id))
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .filter(
                ChatSession.teacher_id == student.id,
                ChatMessage.role == "student",
                ChatMessage.created_at >= now - delta,
            )
            .scalar()
        ) or 0

    if count_since(timedelta(minutes=1)) >= settings.chat_rate_limit_per_min:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You're asking questions too quickly. Wait a moment.",
        )
    if count_since(timedelta(days=1)) >= settings.chat_rate_limit_per_day:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You've reached today's question limit. Try again tomorrow.",
        )
