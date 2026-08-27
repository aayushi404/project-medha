from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import bcrypt

from backend.auth.hashing import hash_password, hash_refresh_token, verify_password
from backend.auth.jwt import create_access_token, create_refresh_token
from backend.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from backend.db.models import AuthSession, Teacher

# A real hash so verify_password does the full bcrypt work even when the email
# doesn't exist -- keeps login response time from leaking account existence.
_DUMMY_HASH = bcrypt.hashpw(b"unused", bcrypt.gensalt()).decode("utf-8")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _issue_tokens(db: Session, teacher: Teacher, device_info: str | None) -> tuple[str, str, int]:
    """Create an access token + a fresh refresh session for `teacher`."""
    access_token = create_access_token(teacher.id)
    refresh_token = create_refresh_token()
    db.add(
        AuthSession(
            teacher_id=teacher.id,
            refresh_token_hash=hash_refresh_token(refresh_token),
            device_info=device_info,
            expires_at=_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.commit()
    return access_token, refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES * 60


def signup(
    db: Session, email: str, password: str, device_info: str | None
) -> tuple[str, str, int]:
    existing = db.query(Teacher.id).filter(Teacher.email == email).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    # school/subjects and full_name are collected in the separate onboarding
    # step; this row only proves ownership of the email + password.
    teacher = Teacher(
        email=email,
        password_hash=hash_password(password),
        full_name="",
        school_id=None,
    )
    db.add(teacher)
    db.flush()
    return _issue_tokens(db, teacher, device_info)


def login(
    db: Session, email: str, password: str, device_info: str | None
) -> tuple[str, str, int]:
    teacher = db.query(Teacher).filter(Teacher.email == email).first()
    stored_hash = teacher.password_hash if teacher is not None else _DUMMY_HASH
    if not verify_password(password, stored_hash) or teacher is None or not teacher.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    return _issue_tokens(db, teacher, device_info)


def refresh_session(db: Session, raw_refresh_token: str) -> tuple[str, str, int]:
    session = (
        db.query(AuthSession)
        .filter(
            AuthSession.refresh_token_hash == hash_refresh_token(raw_refresh_token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > _now(),
        )
        .first()
    )
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")

    session.revoked_at = _now()

    new_refresh_token = create_refresh_token()
    db.add(
        AuthSession(
            teacher_id=session.teacher_id,
            refresh_token_hash=hash_refresh_token(new_refresh_token),
            device_info=session.device_info,
            expires_at=_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    access_token = create_access_token(session.teacher_id)
    db.commit()

    return access_token, new_refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES * 60


def logout_session(db: Session, raw_refresh_token: str | None) -> None:
    if raw_refresh_token is None:
        return
    session = (
        db.query(AuthSession)
        .filter(
            AuthSession.refresh_token_hash == hash_refresh_token(raw_refresh_token),
            AuthSession.revoked_at.is_(None),
        )
        .first()
    )
    if session is not None:
        session.revoked_at = _now()
        db.commit()
