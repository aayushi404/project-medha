from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_teacher
from backend.core.config import settings
from backend.db.models import Generation, Teacher
from backend.db.session import get_db


def generation_rate_limit(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> None:
    """Per-teacher cap on the LLM-spending generate endpoints. Counts the
    teacher's own generation rows in two trailing windows (DB-count, like
    `backend.ask.rate_limit`). Cache hits still create a row, so a burst of
    repeat requests is rate-limited too -- acceptable."""
    now = datetime.now(timezone.utc)

    def count_since(delta: timedelta) -> int:
        return (
            db.query(func.count(Generation.id))
            .filter(
                Generation.teacher_id == teacher.id,
                Generation.created_at >= now - delta,
            )
            .scalar()
        ) or 0

    if count_since(timedelta(minutes=1)) >= settings.generation_rate_limit_per_min:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You're generating too quickly. Wait a moment.",
        )
    if count_since(timedelta(days=1)) >= settings.generation_rate_limit_per_day:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily generation limit reached. Try again tomorrow.",
        )
