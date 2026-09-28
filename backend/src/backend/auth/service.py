import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import emails, tokens
from backend.auth.hashing import hash_password, hash_refresh_token, verify_password
from backend.auth.jwt import create_access_token, create_refresh_token
from backend.auth.schemas import RegisterIn
from backend.core import throttle
from backend.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from backend.db.models import AuthSession, School, Student, Teacher

logger = logging.getLogger("backend.auth")

# A real hash so verify_password does the full bcrypt work even when the email
# doesn't exist -- keeps login response time from leaking account existence.
_DUMMY_HASH = bcrypt.hashpw(b"unused", bcrypt.gensalt()).decode("utf-8")

MAX_SESSIONS_PER_ACTOR = 5
# A rotated token replayed within this many seconds is almost certainly two tabs
# refreshing at once, not theft -- reject it without burning the whole family.
_REUSE_GRACE_SECONDS = 10
_DEVICE_INFO_MAX = 300

# Login limits (see core/throttle.py for why there's no email-only lockout).
_LOGIN_WINDOW = 15 * 60
_LOGIN_PER_IP_EMAIL = 5
_LOGIN_PER_IP = 100  # generous: a school computer lab shares one address
_LOGIN_EMAIL_WINDOW = 60 * 60
_LOGIN_PER_EMAIL = 100  # makes distributed guessing costly without making lockout cheap


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _actor_type(actor: Teacher | Student) -> str:
    return "student" if isinstance(actor, Student) else "teacher"


def _sessions_of(actor: Teacher | Student):
    return AuthSession.student_id == actor.id if isinstance(actor, Student) else AuthSession.teacher_id == actor.id


def _new_session(
    db: Session,
    actor: Teacher | Student,
    device_info: str | None,
    family_id: uuid.UUID | None = None,
) -> tuple[AuthSession, str]:
    raw = create_refresh_token()
    session = AuthSession(
        id=uuid.uuid4(),
        teacher_id=None if isinstance(actor, Student) else actor.id,
        student_id=actor.id if isinstance(actor, Student) else None,
        refresh_token_hash=hash_refresh_token(raw),
        family_id=family_id or uuid.uuid4(),
        device_info=(device_info or "")[:_DEVICE_INFO_MAX] or None,
        expires_at=_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    return session, raw


def _enforce_session_cap(db: Session, actor: Teacher | Student) -> None:
    """Keep at most MAX_SESSIONS_PER_ACTOR live sessions; evict the oldest."""
    live = (
        db.query(AuthSession)
        .filter(_sessions_of(actor), AuthSession.revoked_at.is_(None), AuthSession.expires_at > _now())
        .order_by(AuthSession.issued_at.desc())
        .all()
    )
    for old in live[MAX_SESSIONS_PER_ACTOR:]:
        old.revoked_at = _now()


def _revoke_all_sessions(db: Session, actor: Teacher | Student) -> None:
    db.execute(
        update(AuthSession).where(_sessions_of(actor), AuthSession.revoked_at.is_(None)).values(revoked_at=_now())
    )


def _issue_tokens(
    db: Session, actor: Teacher | Student, device_info: str | None
) -> tuple[str, str, int]:
    """Create an access token + a fresh refresh session (new family) for `actor`."""
    access_token = create_access_token(actor.id, _actor_type(actor))
    _, refresh_token = _new_session(db, actor, device_info)
    db.flush()
    _enforce_session_cap(db, actor)
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


# ---------------------------------------------------------------- registration


def _verify_google_id_token(raw_id_token: str) -> dict:
    """Verify a Google ID token's signature/audience/expiry and return its
    claims. The audience is the WEB client id (see .env.example) -- a native
    Android/iOS sign-in flow passes that as `serverClientId` precisely so the
    token it produces is audienced for this backend, not just the device."""
    from google.auth.exceptions import TransportError
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    from backend.core.config import settings

    if not settings.google_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured.")
    try:
        claims = google_id_token.verify_oauth2_token(
            raw_id_token, google_requests.Request(), settings.google_client_id
        )
    except TransportError as exc:
        logger.warning("google_certs_unreachable: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is temporarily unavailable."
        ) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired Google sign-in token.") from exc
    if not claims.get("email_verified", False):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google account email is not verified.")
    return claims


def register(db: Session, payload: RegisterIn, background: BackgroundTasks) -> None:
    """Create a pending account, or quietly do nothing visible if the email is
    already registered. Registering never logs you in -- the email must be
    verified and then an admin (for principals) or a principal (for teachers)
    has to approve.

    The response is identical whether or not the email already existed (an
    "already registered" email goes to the address's owner instead), so this
    endpoint can't be used to find out who has an account."""
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

    google_sub: str | None = None
    email_verified = False
    if payload.google_id_token:
        claims = _verify_google_id_token(payload.google_id_token)
        if (claims.get("email") or "").strip().lower() != payload.email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The Google account doesn't match this email.")
        google_sub = claims["sub"]
        email_verified = True  # Google has verified this address

    existing = db.query(Teacher).filter(Teacher.email == payload.email).first()
    if existing is not None:
        reapply = (
            existing.approval_status == "rejected"
            and existing.role == payload.role
            and existing.school_id == payload.school_id
        )
        if not reapply:
            emails.already_registered(background, payload.email, payload.full_name)
            return
        teacher = existing  # a rejected applicant may re-apply to the same school and role
    else:
        teacher = Teacher(email=payload.email)
        db.add(teacher)

    if google_sub is not None:
        conflict = db.query(Teacher).filter(Teacher.google_sub == google_sub).first()
        if conflict is not None and conflict is not teacher:
            emails.already_registered(background, payload.email, payload.full_name)
            db.rollback()
            return
        teacher.google_sub = google_sub

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
    teacher.email_verified_at = _now() if email_verified else None

    try:
        db.commit()
    except IntegrityError:
        # a concurrent registration (or a reused mobile number) won the race
        db.rollback()
        emails.already_registered(background, payload.email, payload.full_name)
        return
    db.refresh(teacher)

    if teacher.email_verified_at is None:
        emails.verification(background, teacher.email, teacher.full_name, tokens.issue(db, teacher, tokens.VERIFY_EMAIL))


# ---------------------------------------------------------------------- login


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

    actor: Teacher | Student | None = db.query(Teacher).filter(
        Teacher.google_sub == google_sub
    ).first() or db.query(Student).filter(Student.google_sub == google_sub).first()

    if actor is None and email:
        # Google has verified this person owns `email`. Link it to an existing
        # row with that email -- but if the row's email was never verified,
        # whoever created it (possibly not this person) chose its password, so
        # discard that password: the real owner sets their own via reset.
        candidate: Teacher | Student | None = db.query(Teacher).filter(Teacher.email == email).first()
        if candidate is None:
            candidate = db.query(Student).filter(Student.email == email).first()
        if candidate is not None and candidate.google_sub is None:
            if candidate.email_verified_at is None:
                candidate.password_hash = None
                candidate.email_verified_at = _now()
            candidate.google_sub = google_sub
            db.commit()
            db.refresh(candidate)
            actor = candidate

    if actor is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_REGISTERED",
                "google_sub": google_sub,
                "email": email,
                "full_name": full_name,
            },
        )

    _assert_can_sign_in(actor)
    return _issue_tokens(db, actor, device_info)


def _assert_can_sign_in(actor: Teacher | Student) -> None:
    if not actor.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account is not active.")
    if actor.approval_status == "pending":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "PENDING_APPROVAL"})
    if actor.approval_status == "rejected":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "REGISTRATION_REJECTED", "reason": actor.rejection_reason},
        )


def login(
    db: Session,
    email: str,
    password: str,
    device_info: str | None,
    expected_role: str | None = None,
    ip: str = "unknown",
) -> tuple[str, str, int]:
    pair_key, ip_key = f"{ip}|{email}", ip
    if (
        throttle.count(db, "login_ip_email", pair_key, _LOGIN_WINDOW) >= _LOGIN_PER_IP_EMAIL
        or throttle.count(db, "login_ip", ip_key, _LOGIN_WINDOW) >= _LOGIN_PER_IP
        or throttle.count(db, "login_email", email, _LOGIN_EMAIL_WINDOW) >= _LOGIN_PER_EMAIL
    ):
        raise throttle.too_many(_LOGIN_WINDOW)

    # A student and a teacher/principal/admin live in independent tables with
    # independently-unique emails, so the login-screen tab picks which table to
    # look in -- no tab (or a non-student tab) means "teachers".
    model = Student if expected_role == "student" else Teacher
    actor: Teacher | Student | None = db.query(model).filter(model.email == email).first()
    # a row can exist without a usable credential (e.g. an unverified account
    # whose password was discarded) -- fall back to the dummy hash so response
    # time and message match the "no such account" case.
    stored_hash = actor.password_hash if actor is not None and actor.password_hash else _DUMMY_HASH
    if not verify_password(password, stored_hash) or actor is None or not actor.is_active:
        throttle.hit(db, "login_ip_email", pair_key, _LOGIN_WINDOW)
        throttle.hit(db, "login_ip", ip_key, _LOGIN_WINDOW)
        throttle.hit(db, "login_email", email, _LOGIN_EMAIL_WINDOW)
        # same message for missing user and wrong password -- don't reveal
        # which emails are registered
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")

    # The password is right, so this is genuinely their account -- but the
    # login screen's tab doesn't match the role on file. Reject rather than
    # silently letting a teacher in through the student tab; `admin` has no tab
    # of its own, so it's exempt.
    if expected_role is not None and actor.role != expected_role and actor.role != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "ROLE_MISMATCH", "actual_role": actor.role},
        )

    _assert_can_sign_in(actor)

    throttle.clear(db, "login_ip_email", pair_key)
    return _issue_tokens(db, actor, device_info)


# -------------------------------------------------------------------- sessions


def _load_actor(db: Session, session: AuthSession) -> Teacher | Student | None:
    return db.get(Student, session.student_id) if session.student_id else db.get(Teacher, session.teacher_id)


def refresh_session(db: Session, raw_refresh_token: str, device_info: str | None = None) -> tuple[str, str, int]:
    """Rotate a refresh token. The revoke is one atomic UPDATE ... WHERE
    revoked_at IS NULL, so two concurrent requests can't both win. Presenting a
    token that was already rotated is treated as theft: the whole family (every
    descendant of that login) is revoked."""
    token_hash = hash_refresh_token(raw_refresh_token)
    now = _now()
    won = db.execute(
        update(AuthSession)
        .where(AuthSession.refresh_token_hash == token_hash, AuthSession.revoked_at.is_(None), AuthSession.expires_at > now)
        .values(revoked_at=now)
        .returning(AuthSession.id, AuthSession.family_id)
    ).first()

    if won is None:
        db.rollback()
        stale = db.query(AuthSession).filter(AuthSession.refresh_token_hash == token_hash).first()
        if stale is not None and stale.replaced_by_id is not None:
            revoked_at = stale.revoked_at or now
            if (now - revoked_at).total_seconds() > _REUSE_GRACE_SECONDS:
                db.execute(
                    update(AuthSession)
                    .where(AuthSession.family_id == stale.family_id, AuthSession.revoked_at.is_(None))
                    .values(revoked_at=now)
                )
                db.commit()
                logger.warning("refresh_token_reuse_detected family=%s", stale.family_id)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")

    session_id, family_id = won
    session = db.get(AuthSession, session_id)
    actor = _load_actor(db, session)
    # the account may have been deactivated, rejected or revoked since it logged in
    if actor is None or not actor.is_active or actor.approval_status != "approved":
        db.execute(
            update(AuthSession).where(AuthSession.family_id == family_id, AuthSession.revoked_at.is_(None)).values(revoked_at=now)
        )
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")

    new_session, new_raw = _new_session(db, actor, session.device_info or device_info, family_id=family_id)
    db.flush()
    session.replaced_by_id = new_session.id
    _enforce_session_cap(db, actor)
    access_token = create_access_token(actor.id, _actor_type(actor))
    db.commit()
    return access_token, new_raw, ACCESS_TOKEN_EXPIRE_MINUTES * 60


def logout_session(db: Session, raw_refresh_token: str | None) -> None:
    if raw_refresh_token is None:
        return
    db.execute(
        update(AuthSession)
        .where(AuthSession.refresh_token_hash == hash_refresh_token(raw_refresh_token), AuthSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    db.commit()


def logout_all(db: Session, actor: Teacher | Student) -> None:
    _revoke_all_sessions(db, actor)
    db.commit()


# ------------------------------------------------- email verification / reset


def verify_email(db: Session, raw_token: str) -> None:
    actor = tokens.consume(db, raw_token, tokens.VERIFY_EMAIL)
    if actor.email_verified_at is None:
        actor.email_verified_at = _now()
        db.commit()


def _accounts_for_email(db: Session, email: str) -> list[Teacher | Student]:
    found: list[Teacher | Student] = []
    for model in (Teacher, Student):
        row = db.query(model).filter(model.email == email).first()
        if row is not None:
            found.append(row)
    return found


def resend_verification(db: Session, email: str, background: BackgroundTasks) -> None:
    for actor in _accounts_for_email(db, email):
        if actor.email_verified_at is None and actor.is_active:
            emails.verification(background, actor.email, actor.full_name, tokens.issue(db, actor, tokens.VERIFY_EMAIL))


def forgot_password(db: Session, email: str, background: BackgroundTasks) -> None:
    for actor in _accounts_for_email(db, email):
        if actor.is_active:
            emails.password_reset(background, actor.email, actor.full_name, tokens.issue(db, actor, tokens.RESET_PASSWORD))


def reset_password(db: Session, raw_token: str, new_password: str) -> None:
    actor = tokens.consume(db, raw_token, tokens.RESET_PASSWORD)
    actor.password_hash = hash_password(new_password)
    if actor.email_verified_at is None:
        actor.email_verified_at = _now()  # they just proved they control the mailbox
    _revoke_all_sessions(db, actor)  # anyone holding an old session is signed out
    db.commit()


def change_password(
    db: Session, actor: Teacher | Student, current_password: str, new_password: str, device_info: str | None
) -> tuple[str, str, int]:
    if not actor.password_hash or not verify_password(current_password, actor.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    actor.password_hash = hash_password(new_password)
    _revoke_all_sessions(db, actor)
    db.commit()
    return _issue_tokens(db, actor, device_info)
