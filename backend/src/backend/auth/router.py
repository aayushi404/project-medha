from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.auth import service
from backend.auth.dependencies import get_current_actor
from backend.auth.schemas import (
    ChangePasswordIn,
    EmailLoginIn,
    EmailOnlyIn,
    GoogleAuthIn,
    MessageOut,
    PhoneLoginIn,
    RegisterIn,
    RegisterOut,
    ResetPasswordIn,
    ResetWithCodeIn,
    StudentLookupIn,
    StudentLookupOut,
    StudentOut,
    TeacherOut,
    TokenOut,
    VerifyEmailIn,
)
from backend.core import throttle
from backend.core.api_prefix import api_prefix
from backend.core.config import REFRESH_TOKEN_EXPIRE_DAYS, settings
from backend.db.models import Student, Teacher
from backend.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

_REFRESH_COOKIE_NAME = "refresh_token"
_COOKIE_PATH = "/auth"


def _cookie_path(request: Request) -> str:
    # "/api/auth" when reached through the website's /api proxy, so the
    # browser sends the cookie back on the same prefixed path.
    return api_prefix(request) + _COOKIE_PATH


def _set_refresh_cookie(request: Request, response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=_cookie_path(request),
    )


def _clear_refresh_cookie(request: Request, response: Response) -> None:
    # match secure/samesite/path so the browser actually drops it cross-site
    response.delete_cookie(
        _REFRESH_COOKIE_NAME,
        path=_cookie_path(request),
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def _require_browser_client(request: Request) -> None:
    """CSRF defence for the endpoints that authenticate with the refresh
    *cookie* (which the browser attaches automatically, even cross-site when
    SameSite=None): require a custom header, which a cross-site page can only
    send after a CORS preflight that our CORS policy grants solely to the
    frontend origin, and check Origin when the browser supplies it."""
    if request.headers.get("x-medha-client") != "web":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden.")
    origin = request.headers.get("origin")
    if origin is not None and origin != settings.frontend_origin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden.")


_GENERIC_ACCEPTED = "If that email is registered, we've sent instructions to it."


@router.post("/register", response_model=RegisterOut, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterIn,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> RegisterOut:
    throttle.enforce(db, "register", throttle.client_ip(request), limit=30, window_seconds=3600)
    service.register(db, payload, background_tasks)
    approver = "your principal" if payload.role == "teacher" else "an administrator"
    return RegisterOut(
        role=payload.role,
        message="Registration received. Check your email to verify your address; "
        f"your account will then be pending approval from {approver}.",
    )


@router.post("/login", response_model=TokenOut)
def login(
    payload: EmailLoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    """Principal and admin accounts. Teachers and students can't log in here."""
    access_token, refresh_token, expires_in = service.login_email(
        db,
        payload.email,
        payload.password,
        request.headers.get("user-agent"),
        expected_role=payload.role,
        ip=throttle.client_ip(request),
    )
    _set_refresh_cookie(request, response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.post("/login/phone", response_model=TokenOut)
def login_phone(
    payload: PhoneLoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    """Teacher and student accounts. A student picks their profile first
    (POST /auth/student/lookup) and sends its id as `student_id`."""
    access_token, refresh_token, expires_in = service.login_phone(
        db,
        payload.phone,
        payload.role,
        payload.student_id,
        payload.password,
        request.headers.get("user-agent"),
        ip=throttle.client_ip(request),
    )
    _set_refresh_cookie(request, response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.post("/student/lookup", response_model=StudentLookupOut)
def student_lookup(payload: StudentLookupIn, request: Request, db: Session = Depends(get_db)) -> StudentLookupOut:
    """The student profiles on a phone number, for the login picker."""
    return service.lookup_student_profiles(db, payload.phone, throttle.client_ip(request))


@router.post("/reset-with-code", response_model=MessageOut)
def reset_with_code(payload: ResetWithCodeIn, request: Request, db: Session = Depends(get_db)) -> MessageOut:
    """Redeem a one-time code a teacher or principal read out to the account
    holder, and set a new password."""
    service.reset_with_code(db, payload, throttle.client_ip(request))
    return MessageOut(message="Your password has been changed. Please log in.")


@router.post("/google", response_model=TokenOut)
def google_auth(
    payload: GoogleAuthIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    throttle.enforce(db, "google", throttle.client_ip(request), limit=60, window_seconds=15 * 60)
    access_token, refresh_token, expires_in = service.google_login(
        db, payload.id_token, request.headers.get("user-agent")
    )
    _set_refresh_cookie(request, response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.post("/refresh", response_model=TokenOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    _require_browser_client(request)
    throttle.enforce(db, "refresh", throttle.client_ip(request), limit=600, window_seconds=15 * 60)
    raw_refresh_token = request.cookies.get(_REFRESH_COOKIE_NAME)
    if raw_refresh_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token provided.")

    access_token, refresh_token, expires_in = service.refresh_session(
        db, raw_refresh_token, request.headers.get("user-agent")
    )
    _set_refresh_cookie(request, response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    _require_browser_client(request)
    raw_refresh_token = request.cookies.get(_REFRESH_COOKIE_NAME)
    service.logout_session(db, raw_refresh_token)
    _clear_refresh_cookie(request, response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    request: Request,
    response: Response,
    current_actor: Teacher | Student = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> None:
    service.logout_all(db, current_actor)
    _clear_refresh_cookie(request, response)


@router.post("/verify-email", response_model=MessageOut)
def verify_email(payload: VerifyEmailIn, request: Request, db: Session = Depends(get_db)) -> MessageOut:
    throttle.enforce(db, "verify_email", throttle.client_ip(request), limit=60, window_seconds=3600)
    service.verify_email(db, payload.token)
    return MessageOut(message="Your email address is verified.")


@router.post("/resend-verification", response_model=MessageOut, status_code=status.HTTP_202_ACCEPTED)
def resend_verification(
    payload: EmailOnlyIn, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
) -> MessageOut:
    throttle.enforce(db, "resend_ip", throttle.client_ip(request), limit=30, window_seconds=3600)
    throttle.enforce(db, "resend_email", payload.email, limit=3, window_seconds=3600)
    service.resend_verification(db, payload.email, background_tasks)
    return MessageOut(message=_GENERIC_ACCEPTED)


@router.post("/forgot-password", response_model=MessageOut, status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: EmailOnlyIn, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
) -> MessageOut:
    throttle.enforce(db, "forgot_ip", throttle.client_ip(request), limit=30, window_seconds=3600)
    throttle.enforce(db, "forgot_email", payload.email, limit=3, window_seconds=3600)
    service.forgot_password(db, payload.email, background_tasks)
    return MessageOut(message=_GENERIC_ACCEPTED)


@router.post("/reset-password", response_model=MessageOut)
def reset_password(payload: ResetPasswordIn, request: Request, db: Session = Depends(get_db)) -> MessageOut:
    throttle.enforce(db, "reset_ip", throttle.client_ip(request), limit=30, window_seconds=3600)
    service.reset_password(db, payload.token, payload.new_password)
    return MessageOut(message="Your password has been changed. Please log in.")


@router.post("/change-password", response_model=TokenOut)
def change_password(
    payload: ChangePasswordIn,
    request: Request,
    response: Response,
    current_actor: Teacher | Student = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> TokenOut:
    throttle.enforce(db, "change_pw", str(current_actor.id), limit=10, window_seconds=3600)
    access_token, refresh_token, expires_in = service.change_password(
        db, current_actor, payload.current_password, payload.new_password, request.headers.get("user-agent")
    )
    _set_refresh_cookie(request, response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.get("/me", response_model=TeacherOut | StudentOut)
def me(
    current_actor: Teacher | Student = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> TeacherOut | StudentOut:
    if isinstance(current_actor, Student):
        from backend.core.section_access import current_enrollment
        from backend.db.models import ClassSection

        enrollment = current_enrollment(db, current_actor)
        section = db.get(ClassSection, enrollment.class_section_id) if enrollment else None
        return StudentOut(
            id=current_actor.id,
            email=current_actor.email,
            full_name=current_actor.full_name,
            approval_status=current_actor.approval_status,
            school_id=current_actor.school_id,
            grade_id=section.grade_id if section else None,
            roll_number=str(enrollment.roll_number) if enrollment and enrollment.roll_number is not None else None,
            photo_url=current_actor.photo_url,
        )
    return TeacherOut.model_validate(current_actor)
