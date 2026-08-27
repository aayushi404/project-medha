from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.auth import service
from backend.auth.dependencies import get_current_teacher
from backend.auth.schemas import LoginIn, SignupIn, TeacherOut, TokenOut
from backend.core.config import REFRESH_TOKEN_EXPIRE_DAYS, settings
from backend.db.models import Teacher
from backend.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

_REFRESH_COOKIE_NAME = "refresh_token"
_COOKIE_PATH = "/auth"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    # match secure/samesite/path so the browser actually drops it cross-site
    response.delete_cookie(
        _REFRESH_COOKIE_NAME,
        path=_COOKIE_PATH,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignupIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    access_token, refresh_token, expires_in = service.signup(
        db, payload.email, payload.password, request.headers.get("user-agent")
    )
    _set_refresh_cookie(response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.post("/login", response_model=TokenOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    access_token, refresh_token, expires_in = service.login(
        db, payload.email, payload.password, request.headers.get("user-agent")
    )
    _set_refresh_cookie(response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.post("/refresh", response_model=TokenOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    raw_refresh_token = request.cookies.get(_REFRESH_COOKIE_NAME)
    if raw_refresh_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token provided.")

    access_token, refresh_token, expires_in = service.refresh_session(db, raw_refresh_token)
    _set_refresh_cookie(response, refresh_token)
    return TokenOut(access_token=access_token, expires_in=expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    raw_refresh_token = request.cookies.get(_REFRESH_COOKIE_NAME)
    service.logout_session(db, raw_refresh_token)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=TeacherOut)
def me(current_teacher: Teacher = Depends(get_current_teacher)) -> Teacher:
    return current_teacher
