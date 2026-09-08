import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt as pyjwt

from backend.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET_KEY

ACCESS_TOKEN_TYPE = "access"


def create_access_token(teacher_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(teacher_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return pyjwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> UUID:
    """Return the teacher_id encoded in a valid, unexpired access token.

    Raises jwt.PyJWTError (e.g. ExpiredSignatureError, InvalidTokenError) if the
    token is malformed, expired, wrongly signed, or not an access token --
    callers are responsible for mapping that to a 401.
    """
    payload = pyjwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise pyjwt.InvalidTokenError("not an access token")
    return UUID(payload["sub"])


def create_refresh_token() -> str:
    """Opaque random string, not a JWT. Callers hash it (see hashing.py) before
    persisting to auth_sessions.refresh_token_hash and return the raw value to
    the client as an httpOnly cookie -- it is never decodable/inspectable."""
    return secrets.token_urlsafe(32)
