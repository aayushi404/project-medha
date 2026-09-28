import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt as pyjwt

from backend.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET_KEY, settings

ACCESS_TOKEN_TYPE = "access"


def create_access_token(actor_id: UUID, actor_type: str = "teacher") -> str:
    """`actor_type` is "teacher" (a `teachers` row: admin/principal/teacher)
    or "student" (a `students` row) -- lets `decode_access_token` know which
    table to resolve `sub` against, now that the two are separate tables."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(actor_id),
        "type": ACCESS_TOKEN_TYPE,
        "actor_type": actor_type,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": secrets.token_urlsafe(12),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return pyjwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> tuple[UUID, str]:
    """Return (actor_id, actor_type) encoded in a valid, unexpired access
    token. `actor_type` is required and must be "teacher" or "student".

    Raises jwt.PyJWTError (e.g. ExpiredSignatureError, InvalidTokenError) if the
    token is malformed, expired, wrongly signed, or not an access token --
    callers are responsible for mapping that to a 401.
    """
    payload = pyjwt.decode(
        token,
        JWT_SECRET_KEY,
        algorithms=[JWT_ALGORITHM],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        options={"require": ["exp", "sub", "iss", "aud", "iat"]},
    )
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise pyjwt.InvalidTokenError("not an access token")
    actor_type = payload.get("actor_type")
    if actor_type not in ("teacher", "student"):
        raise pyjwt.InvalidTokenError("bad actor_type")
    try:
        return UUID(str(payload["sub"])), actor_type
    except ValueError as exc:
        raise pyjwt.InvalidTokenError("bad subject") from exc


def create_refresh_token() -> str:
    """Opaque random string, not a JWT. Callers hash it (see hashing.py) before
    persisting to auth_sessions.refresh_token_hash and return the raw value to
    the client as an httpOnly cookie -- it is never decodable/inspectable."""
    return secrets.token_urlsafe(32)
