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
from backend.auth.schemas import (
    RegisterIn,
    ResetCodeOut,
    ResetWithCodeIn,
    StudentLookupOut,
    StudentProfileOut,
)
from backend.core import throttle
from backend.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from backend.core.section_access import current_enrollment
from backend.db.models import AccountAuditEvent, AuthSession, ClassSection, Grade, School, Student, Teacher

logger = logging.getLogger("backend.auth")

# A real hash so verify_password does the full bcrypt work even when the account
# doesn't exist -- keeps login response time from leaking account existence.
_DUMMY_HASH = bcrypt.hashpw(b"unused", bcrypt.gensalt()).decode("utf-8")

MAX_SESSIONS_PER_ACTOR = 5
# A rotated token replayed within this many seconds is almost certainly two tabs
# refreshing at once, not theft -- reject it without burning the whole family.
_REUSE_GRACE_SECONDS = 10
_DEVICE_INFO_MAX = 300

# Login limits (see core/throttle.py for why there's no identifier-only lockout).
_LOGIN_WINDOW = 15 * 60
_LOGIN_PER_IP_IDENTIFIER = 5  # one identifier (email, or phone + profile) from one address
_LOGIN_PER_IP = 100  # generous: a school computer lab shares one address
_LOGIN_IDENTIFIER_WINDOW = 60 * 60
_LOGIN_PER_IDENTIFIER = 100  # makes distributed guessing costly without making lockout cheap

# Profile lookup and staff-issued reset codes. Lookup is the enumeration point
# for phone numbers, so it is throttled on both axes.
_LOOKUP_WINDOW = 15 * 60
_LOOKUP_PER_IP = 30
_LOOKUP_PER_PHONE = 10
_RESET_WINDOW = 60 * 60
_RESET_PER_IP = 30
_RESET_PER_PHONE = 10

_ADMIN_OR_PRINCIPAL = ("principal", "admin")
_LOGIN_FAILED = "Invalid email or password."
_PHONE_LOGIN_FAILED = "Invalid phone number or password."


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


def _notify_already_registered(background: BackgroundTasks, email: str | None, name: str) -> None:
    # No email on the application means there is nobody to tell -- the
    # response is the same either way, so nothing leaks.
    if email:
        emails.already_registered(background, email, name)


def register(db: Session, payload: RegisterIn, background: BackgroundTasks) -> None:
    """Create a pending account, or quietly do nothing visible if the account
    already exists. Registering never logs you in -- a teacher needs their
    principal's approval; a principal needs an admin's, and a verified email.

    The response is identical whether or not the account already existed (the
    address's owner is told by email when there is one), so this endpoint can't
    be used to find out who has an account."""
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
        if (claims.get("email") or "").strip().lower() != (payload.email or ""):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The Google account doesn't match this email.")
        google_sub = claims["sub"]
        email_verified = True  # Google has verified this address

    # A teacher is matched by email if they gave one, otherwise by phone -- the
    # phone is their login, so it is the identity that must not be duplicated.
    existing: Teacher | None = None
    if payload.email:
        existing = db.query(Teacher).filter(Teacher.email == payload.email).first()
    if existing is None:
        existing = db.query(Teacher).filter(Teacher.phone_number == payload.mobile_number).first()

    if existing is not None:
        reapply = (
            existing.approval_status == "rejected"
            and existing.role == payload.role
            and existing.school_id == payload.school_id
        )
        if not reapply:
            _notify_already_registered(background, payload.email, payload.full_name)
            return
        teacher = existing  # a rejected applicant may re-apply to the same school and role
    else:
        teacher = Teacher(email=payload.email)
        db.add(teacher)

    if google_sub is not None:
        conflict = db.query(Teacher).filter(Teacher.google_sub == google_sub).first()
        if conflict is not None and conflict is not teacher:
            _notify_already_registered(background, payload.email, payload.full_name)
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
        # a concurrent registration (or a reused phone / email) won the race
        db.rollback()
        _notify_already_registered(background, payload.email, payload.full_name)
        return
    db.refresh(teacher)

    if teacher.email and teacher.email_verified_at is None:
        emails.verification(background, teacher.email, teacher.full_name, tokens.issue(db, teacher, tokens.VERIFY_EMAIL))


# ---------------------------------------------------------------------- login


def google_login(
    db: Session, raw_id_token: str, device_info: str | None
) -> tuple[str, str, int]:
    """Google sign-in for principal and admin accounts only. Teachers and
    students have no Google path: it links by email, and phone-login accounts
    may not have one. Same outcomes as `login_email()`, plus NOT_REGISTERED so
    the client can route to Register."""
    claims = _verify_google_id_token(raw_id_token)
    google_sub = claims["sub"]
    email = (claims.get("email") or "").strip().lower()
    full_name = claims.get("name") or (email.split("@")[0] if email else "")

    actor: Teacher | None = db.query(Teacher).filter(
        Teacher.google_sub == google_sub, Teacher.role.in_(_ADMIN_OR_PRINCIPAL)
    ).first()

    if actor is None and email:
        # Google has verified this person owns `email`. Link it to an existing
        # row with that email -- but if the row's email was never verified,
        # whoever created it (possibly not this person) chose its password, so
        # discard that password: the real owner sets their own via reset.
        candidate: Teacher | None = db.query(Teacher).filter(
            Teacher.email == email, Teacher.role.in_(_ADMIN_OR_PRINCIPAL)
        ).first()
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


def _check_login_throttle(db: Session, pair_key: str, ip_key: str, identifier: str) -> None:
    if (
        throttle.count(db, "login_ip_identifier", pair_key, _LOGIN_WINDOW) >= _LOGIN_PER_IP_IDENTIFIER
        or throttle.count(db, "login_ip", ip_key, _LOGIN_WINDOW) >= _LOGIN_PER_IP
        or throttle.count(db, "login_identifier", identifier, _LOGIN_IDENTIFIER_WINDOW) >= _LOGIN_PER_IDENTIFIER
    ):
        raise throttle.too_many(_LOGIN_WINDOW)


def _record_login_failure(db: Session, pair_key: str, ip_key: str, identifier: str) -> None:
    throttle.hit(db, "login_ip_identifier", pair_key, _LOGIN_WINDOW)
    throttle.hit(db, "login_ip", ip_key, _LOGIN_WINDOW)
    throttle.hit(db, "login_identifier", identifier, _LOGIN_IDENTIFIER_WINDOW)


def login_email(
    db: Session,
    email: str,
    password: str,
    device_info: str | None,
    expected_role: str | None = None,
    ip: str = "unknown",
) -> tuple[str, str, int]:
    """Principal and admin login. Teachers and students are not found here:
    a teacher who types their email into the principal tab gets a wrong-portal
    error after the password is checked, so it reveals nothing new.

    `expected_role` is the portal the login came from ("principal" or "admin").
    Admins sign in only through the /admin/login portal, and that portal admits
    only admins. A mismatch there gets the generic failure, so neither portal
    reveals which emails belong to admins."""
    pair_key = f"{ip}|{email}"
    _check_login_throttle(db, pair_key, ip, email)

    actor = db.query(Teacher).filter(Teacher.email == email).first()
    # a row can exist without a usable credential -- fall back to the dummy
    # hash so response time and message match the "no such account" case.
    stored_hash = actor.password_hash if actor is not None and actor.password_hash else _DUMMY_HASH
    wrong_admin_portal = (
        actor is not None
        and expected_role is not None
        and (expected_role == "admin") != (actor.role == "admin")
    )
    if not verify_password(password, stored_hash) or actor is None or not actor.is_active or wrong_admin_portal:
        _record_login_failure(db, pair_key, ip, email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _LOGIN_FAILED)

    # The password is right, so this is genuinely their account -- but the
    # portal doesn't match the role on file. Reject rather than letting an
    # admin or a non-principal in through the principal tab.
    if expected_role is not None and actor.role != expected_role:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "ROLE_MISMATCH", "actual_role": actor.role},
        )

    if actor.role not in _ADMIN_OR_PRINCIPAL:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "ROLE_MISMATCH", "actual_role": actor.role},
        )

    _assert_can_sign_in(actor)
    throttle.clear(db, "login_ip_identifier", pair_key)
    return _issue_tokens(db, actor, device_info)


def _phone_actor(db: Session, role: str, phone: str, student_id: uuid.UUID | None) -> Teacher | Student | None:
    """The account a phone login refers to. A student is only found when
    `student_id` also belongs to `phone` -- so a profile id from some other
    family's number can never be used here."""
    if role == "student":
        if student_id is None:
            return None
        return db.query(Student).filter(Student.id == student_id, Student.phone_number == phone).first()
    return db.query(Teacher).filter(Teacher.phone_number == phone).first()


def login_phone(
    db: Session,
    phone: str,
    role: str,
    student_id: uuid.UUID | None,
    password: str,
    device_info: str | None,
    ip: str = "unknown",
) -> tuple[str, str, int]:
    """Teacher and student login by phone. For students the pair key includes
    the profile, so a parent logging into two children from one device isn't
    locked out by the other child's typos."""
    identifier = phone if role == "teacher" else f"{phone}|{student_id}"
    pair_key = f"{ip}|{identifier}"
    _check_login_throttle(db, pair_key, ip, phone)

    actor = _phone_actor(db, role, phone, student_id)
    stored_hash = actor.password_hash if actor is not None and actor.password_hash else _DUMMY_HASH
    if not verify_password(password, stored_hash) or actor is None or not actor.is_active:
        _record_login_failure(db, pair_key, ip, phone)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _PHONE_LOGIN_FAILED)

    # The password is right, so this is genuinely their account -- but the tab
    # doesn't match the role on file. Same rule as email login; admin has no tab
    # of its own, so it's exempt.
    if actor.role != role and actor.role != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "ROLE_MISMATCH", "actual_role": actor.role},
        )

    _assert_can_sign_in(actor)
    throttle.clear(db, "login_ip_identifier", pair_key)
    return _issue_tokens(db, actor, device_info)


# ------------------------------------------------------- student profile lookup


def lookup_student_profiles(db: Session, phone: str, ip: str) -> StudentLookupOut:
    """Every student profile on a phone number, for the picker. Throttled on
    both the caller's address and the phone, and counted whether or not
    anything matches -- an empty answer must not be cheaper to probe than a
    full one."""
    throttle.enforce(db, "phone_lookup_ip", ip, limit=_LOOKUP_PER_IP, window_seconds=_LOOKUP_WINDOW)
    throttle.enforce(db, "phone_lookup", phone, limit=_LOOKUP_PER_PHONE, window_seconds=_LOOKUP_WINDOW)

    students = (
        db.query(Student)
        .filter(
            Student.phone_number == phone,
            Student.approval_status != "rejected",
            Student.is_active.is_(True),
        )
        .order_by(Student.full_name)
        .all()
    )
    profiles: list[StudentProfileOut] = []
    for student in students:
        enrollment = current_enrollment(db, student)
        class_label = roll_number = None
        if enrollment is not None:
            section = db.get(ClassSection, enrollment.class_section_id)
            grade = db.get(Grade, section.grade_id)
            class_label = f"{grade.label}, Section {section.section}"
            roll_number = str(enrollment.roll_number)
        profiles.append(
            StudentProfileOut(
                id=student.id,
                full_name=student.full_name,
                class_label=class_label,
                roll_number=roll_number,
            )
        )
    return StudentLookupOut(profiles=profiles)


# ------------------------------------------------------ staff-issued reset codes


def issue_reset_code(db: Session, staff: Teacher, subject: Teacher | Student) -> ResetCodeOut:
    """Create a one-time code for `subject`, to be read to them in person. The
    caller has already checked that `staff` may act on `subject`. Issuing a
    new code makes any earlier one useless; the event is audited."""
    if not subject.is_active or subject.approval_status != "approved":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This account isn't approved and active yet, so its password can't be reset.",
        )
    expires_at = _now() + tokens.RESET_CODE_TTL
    code = tokens.issue_code(
        db, subject, tokens.RESET_PASSWORD, ttl=tokens.RESET_CODE_TTL, commit=False
    )
    is_student = isinstance(subject, Student)
    db.add(
        AccountAuditEvent(
            actor_teacher_id=staff.id,
            subject_teacher_id=None if is_student else subject.id,
            subject_student_id=subject.id if is_student else None,
            action="reset_code_issued",
        )
    )
    db.commit()
    return ResetCodeOut(code=code, expires_at=expires_at, full_name=subject.full_name)


def reset_with_code(db: Session, payload: ResetWithCodeIn, ip: str) -> None:
    """Redeem a staff-issued code and set a new password. Every failure
    returns the same message, whether the phone, the profile, the code or the
    account was wrong."""
    throttle.enforce(db, "reset_code_ip", ip, limit=_RESET_PER_IP, window_seconds=_RESET_WINDOW)
    throttle.enforce(db, "reset_code_phone", payload.phone, limit=_RESET_PER_PHONE, window_seconds=_RESET_WINDOW)

    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "That code is invalid or has expired.")
    actor = _phone_actor(db, payload.role, payload.phone, payload.student_id)
    if actor is None or actor.role != payload.role or not actor.is_active or actor.approval_status != "approved":
        raise invalid

    tokens.consume_code(db, actor, payload.code, tokens.RESET_PASSWORD)
    actor.password_hash = hash_password(payload.new_password)
    _revoke_all_sessions(db, actor)  # anyone holding an old session is signed out
    db.commit()


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
