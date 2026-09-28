"""Single-use email tokens (verify email / reset password). Only the SHA-256
of a token is stored; the raw value exists only in the emailed link. Issuing
a new token invalidates the previous unused one, tokens expire, and consuming
one is atomic (UPDATE ... WHERE used_at IS NULL), so a link can't be replayed
or raced."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from backend.auth.hashing import hash_refresh_token as _sha256
from backend.core.config import settings
from backend.db.models import AuthToken, Student, Teacher

VERIFY_EMAIL = "verify_email"
RESET_PASSWORD = "reset_password"
_TTL = {VERIFY_EMAIL: timedelta(hours=24), RESET_PASSWORD: timedelta(minutes=30)}
_PATH = {VERIFY_EMAIL: "verify-email", RESET_PASSWORD: "reset-password"}
# A principal-imported student's "set your password" link is a RESET_PASSWORD
# token with a longer life: it's sent unprompted, often read days later.
INVITE_TTL = timedelta(days=7)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _owner_filter(actor: Teacher | Student):
    return (AuthToken.student_id == actor.id) if isinstance(actor, Student) else (AuthToken.teacher_id == actor.id)


def issue(
    db: Session,
    actor: Teacher | Student,
    purpose: str,
    *,
    ttl: timedelta | None = None,
    commit: bool = True,
) -> str:
    """Create a fresh token for `actor` and return the frontend link to email.
    `commit=False` leaves the token in the caller's transaction (bulk import)."""
    db.execute(
        update(AuthToken)
        .where(_owner_filter(actor), AuthToken.purpose == purpose, AuthToken.used_at.is_(None))
        .values(used_at=_now())
    )
    raw = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            purpose=purpose,
            teacher_id=None if isinstance(actor, Student) else actor.id,
            student_id=actor.id if isinstance(actor, Student) else None,
            token_hash=_sha256(raw),
            expires_at=_now() + (ttl or _TTL[purpose]),
        )
    )
    if commit:
        db.commit()
    return f"{settings.frontend_origin}/{_PATH[purpose]}?token={raw}"


def consume(db: Session, raw: str, purpose: str) -> Teacher | Student:
    """Atomically mark the token used and return its owner. One generic error
    for unknown, expired, used, or wrong-purpose tokens."""
    row = db.execute(
        update(AuthToken)
        .where(
            AuthToken.token_hash == _sha256(raw),
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > _now(),
        )
        .values(used_at=_now())
        .returning(AuthToken.teacher_id, AuthToken.student_id)
    ).first()
    if row is None:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.")
    teacher_id, student_id = row
    actor = db.get(Student, student_id) if student_id else db.get(Teacher, teacher_id)
    if actor is None:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.")
    db.commit()
    return actor
