import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.auth.jwt import decode_access_token
from backend.db.models import Teacher
from backend.db.session import get_db

_bearer_scheme = HTTPBearer(auto_error=True)


def get_current_teacher(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> Teacher:
    try:
        teacher_id = decode_access_token(credentials.credentials)
    except pyjwt.PyJWTError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired access token."
        ) from exc

    teacher = db.get(Teacher, teacher_id)
    if teacher is None or not teacher.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication credentials.")
    # Tokens are only ever issued to approved accounts, but re-check here so a
    # later revocation takes effect on the next request without waiting for the
    # access token to expire.
    if teacher.approval_status != "approved":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not approved.")
    return teacher


# `get_current_user` reads better in role-agnostic code (admins and principals
# are not "teachers"); it's the same dependency.
get_current_user = get_current_teacher


def require_role(*allowed: str):
    """Dependency factory: 403 unless the caller's role is one of `allowed`."""

    def _guard(user: Teacher = Depends(get_current_user)) -> Teacher:
        if user.role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "You don't have permission to do that."
            )
        return user

    return _guard


require_admin = require_role("admin")
require_principal = require_role("principal")
require_teacher = require_role("teacher")
require_student = require_role("student")
