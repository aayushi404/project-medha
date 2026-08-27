from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_teacher
from backend.core.config import settings
from backend.db.models import ChatMessage, ChatSession, Teacher
from backend.db.session import get_db


def chat_rate_limit(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> None:
    """Per-teacher cap on LLM-spending endpoints. Counts the teacher's own
    messages in two trailing windows. DB-count now; Redis token bucket in
    Phase 2 (same config keys)."""
    now = datetime.now(timezone.utc)

    def count_since(delta: timedelta) -> int:
        return (
            db.query(func.count(ChatMessage.id))
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .filter(
                ChatSession.teacher_id == teacher.id,
                ChatMessage.role == "teacher",
                ChatMessage.created_at >= now - delta,
            )
            .scalar()
        ) or 0

    if count_since(timedelta(minutes=1)) >= settings.chat_rate_limit_per_min:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You're sending messages too quickly. Wait a moment.",
        )
    if count_since(timedelta(days=1)) >= settings.chat_rate_limit_per_day:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily message limit reached. Try again tomorrow.",
        )
