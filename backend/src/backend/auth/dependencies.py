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
    return teacher
