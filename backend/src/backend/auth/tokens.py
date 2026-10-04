"""Single-use email tokens (verify email / reset password). Only the SHA-256
of a token is stored; the raw value exists only in the emailed link. Issuing
a new token invalidates the previous unused one, tokens expire, and consuming
one is atomic (UPDATE ... WHERE used_at IS NULL), so a link can't be replayed
or raced."""

import re
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


RESET_CODE_TTL = timedelta(minutes=15)
# 31 symbols: no 0/O, 1/I/L, or U, so a code read aloud or copied from a
# staff screen can't be misread. 10 of them is about 50 bits -- far beyond
# guessing once the redeem endpoint is throttled per phone.
_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
_CODE_LENGTH = 10


def _normalise_code(raw: str) -> str:
    return re.sub(r"[\s-]", "", raw).upper()


def issue_code(
    db: Session,
    actor: Teacher | Student,
    purpose: str,
    *,
    ttl: timedelta | None = None,
    commit: bool = True,
) -> str:
    """Like `issue`, but returns a short code to be read out by staff instead
    of a link. Stored hashed, single-use, same invalidation of earlier unused
    tokens. Returns the display form `XXXXX-XXXXX`."""
    db.execute(
        update(AuthToken)
        .where(_owner_filter(actor), AuthToken.purpose == purpose, AuthToken.used_at.is_(None))
        .values(used_at=_now())
    )
    code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
    db.add(
        AuthToken(
            purpose=purpose,
            teacher_id=None if isinstance(actor, Student) else actor.id,
            student_id=actor.id if isinstance(actor, Student) else None,
            token_hash=_sha256(code),
            expires_at=_now() + (ttl or _TTL[purpose]),
        )
    )
    if commit:
        db.commit()
    return f"{code[:5]}-{code[5:]}"


def consume_code(db: Session, actor: Teacher | Student, raw: str, purpose: str) -> None:
    """Redeem a code, but only against `actor`'s own tokens -- a code that is
    valid for one account can't reset another. One generic error for every
    failure, so the response doesn't say which part was wrong."""
    row = db.execute(
        update(AuthToken)
        .where(
            AuthToken.token_hash == _sha256(_normalise_code(raw)),
            _owner_filter(actor),
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > _now(),
        )
        .values(used_at=_now())
        .returning(AuthToken.id)
    ).first()
    if row is None:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That code is invalid or has expired.")
    db.commit()


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
