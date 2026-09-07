from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import bcrypt

from backend.auth.hashing import hash_password, hash_refresh_token, verify_password
from backend.auth.jwt import create_access_token, create_refresh_token
from backend.auth.rate_limit import is_locked_out, record_failure, reset
from backend.auth.schemas import RegisterIn
from backend.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from backend.db.models import AuthSession, School, Teacher

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


def _approved_principal(db: Session, school_id) -> Teacher | None:
    return (
        db.query(Teacher)
        .filter(
            Teacher.school_id == school_id,
            Teacher.role == "principal",
            Teacher.approval_status == "approved",
        )
        .first()
    )


def register(db: Session, payload: RegisterIn) -> Teacher:
    """Create a pending account. Registering never logs you in -- an admin
    (for principals) or a principal (for teachers) has to approve first."""
    school = db.get(School, payload.school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That school wasn't found.")

    if payload.role == "teacher" and _approved_principal(db, school.id) is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Your school doesn't have an approved principal yet. Ask your "
            "principal to register first, then try again.",
        )
    if payload.role == "principal" and _approved_principal(db, school.id) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This school already has an approved principal.",
        )

    existing = db.query(Teacher).filter(Teacher.email == payload.email).first()
    if existing is not None:
        if existing.approval_status != "rejected":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "An account with this email already exists.",
            )
        # a previously rejected applicant may re-apply: reuse the row so the
        # unique email constraint doesn't block them.
        teacher = existing
    else:
        teacher = Teacher(email=payload.email)
        db.add(teacher)

    if payload.google_sub is not None:
        conflict = db.query(Teacher).filter(Teacher.google_sub == payload.google_sub).first()
        if conflict is not None and conflict is not teacher:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This Google account is already linked to another Medha account.",
            )
        teacher.google_sub = payload.google_sub

    teacher.full_name = payload.full_name
    teacher.password_hash = hash_password(payload.password)
    teacher.role = payload.role
    teacher.school_id = payload.school_id
    teacher.phone_number = payload.mobile_number
    teacher.employee_code = payload.employee_code
    teacher.years_of_experience = payload.years_of_experience
    teacher.qualification = payload.qualification
    teacher.approval_status = "pending"
    teacher.approved_by = None
    teacher.approved_at = None
    teacher.rejection_reason = None

    db.commit()
    db.refresh(teacher)
    return teacher


def _verify_google_id_token(raw_id_token: str) -> dict:
    """Verify a Google ID token's signature/audience/expiry and return its
    claims. The audience is the WEB client id (see .env.example) -- a native
    Android/iOS sign-in flow passes that as `serverClientId` precisely so the
    token it produces is audienced for this backend, not just the device."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    from backend.core.config import settings

    if not settings.google_client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured."
        )
    try:
        claims = google_id_token.verify_oauth2_token(
            raw_id_token, google_requests.Request(), settings.google_client_id
        )
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired Google sign-in token."
        ) from exc
    if not claims.get("email_verified", False):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Google account email is not verified."
        )
    return claims


def google_login(
    db: Session, raw_id_token: str, device_info: str | None
) -> tuple[str, str, int]:
    """Same three outcomes as `login()` (issued tokens / PENDING_APPROVAL /
    REGISTRATION_REJECTED), plus a fourth: no account is linked to this Google
    identity yet, so the client should route to Register (prefilled) rather
    than treating this as a login failure."""
    claims = _verify_google_id_token(raw_id_token)
    google_sub = claims["sub"]
    email = (claims.get("email") or "").strip().lower()
    full_name = claims.get("name") or (email.split("@")[0] if email else "")

    teacher = db.query(Teacher).filter(Teacher.google_sub == google_sub).first()

    if teacher is None and email:
        # owns this email (verified by Google) but hasn't linked Google yet --
        # link it now rather than making them set a password just to prove it.
        candidate = db.query(Teacher).filter(Teacher.email == email).first()
        if candidate is not None and candidate.google_sub is None:
            candidate.google_sub = google_sub
            db.commit()
            db.refresh(candidate)
            teacher = candidate

    if teacher is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_REGISTERED",
                "google_sub": google_sub,
                "email": email,
                "full_name": full_name,
            },
        )

    if not teacher.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account is not active.")
    if teacher.approval_status == "pending":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail={"code": "PENDING_APPROVAL"}
        )
    if teacher.approval_status == "rejected":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "code": "REGISTRATION_REJECTED",
                "reason": teacher.rejection_reason,
            },
        )

    return _issue_tokens(db, teacher, device_info)


def login(
    db: Session, email: str, password: str, device_info: str | None
) -> tuple[str, str, int]:
    if is_locked_out(email):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many failed attempts. Try again in 15 minutes.",
        )

    teacher = db.query(Teacher).filter(Teacher.email == email).first()
    # a student row can exist without a credential (registered, not yet
    # activated) -- fall back to the dummy hash so the response time and message
    # match the "no such account" case.
    stored_hash = (
        teacher.password_hash
        if teacher is not None and teacher.password_hash
        else _DUMMY_HASH
    )
    if not verify_password(password, stored_hash) or teacher is None or not teacher.is_active:
        record_failure(email)
        # same message for missing user and wrong password -- don't reveal
        # which emails are registered
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")

    if teacher.approval_status == "pending":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail={"code": "PENDING_APPROVAL"}
        )
    if teacher.approval_status == "rejected":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "code": "REGISTRATION_REJECTED",
                "reason": teacher.rejection_reason,
            },
        )

    reset(email)
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
