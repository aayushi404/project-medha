"""Shared, database-backed rate limiting for auth and other abuse-prone
endpoints. Counters live in `auth_throttle`, so they are consistent across
workers/instances and survive restarts (the old in-process limiter did
neither). Identifiers (emails, IPs) are stored only as SHA-256 hashes.

Design rules:
  * Never lock an account on the victim's email alone -- that lets anyone lock
    out any known user (e.g. a principal) with a handful of requests. Login is
    limited per (IP, email) and per IP, with only a generous per-email ceiling
    that makes distributed guessing expensive without making lockout cheap.
  * Limits are per fixed window: the first hit opens the window, it resets
    once the window has elapsed.
  * Limits must be generous per IP: a school computer lab shares one address.
"""

import hashlib
import random

from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session


def _hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def client_ip(request: Request) -> str:
    """The caller's address as resolved by uvicorn (which honours the proxy's
    X-Forwarded-For only for trusted proxies -- see render-start.sh)."""
    return request.client.host if request.client else "unknown"


_HIT = text(
    """
    INSERT INTO auth_throttle (scope, key_hash, count, window_start)
    VALUES (:scope, :key, 1, now())
    ON CONFLICT (scope, key_hash) DO UPDATE SET
        count = CASE WHEN auth_throttle.window_start < now() - make_interval(secs => :window)
                     THEN 1 ELSE auth_throttle.count + 1 END,
        window_start = CASE WHEN auth_throttle.window_start < now() - make_interval(secs => :window)
                            THEN now() ELSE auth_throttle.window_start END
    RETURNING count
    """
)

_COUNT = text(
    """
    SELECT count FROM auth_throttle
    WHERE scope = :scope AND key_hash = :key
      AND window_start >= now() - make_interval(secs => :window)
    """
)


def hit(db: Session, scope: str, key: str, window_seconds: int) -> int:
    """Record one event and return how many fall in the current window."""
    n = db.execute(_HIT, {"scope": scope, "key": _hash(key), "window": window_seconds}).scalar_one()
    db.commit()  # persist even if the request goes on to fail
    if random.random() < 0.01:
        _purge(db)
    return int(n)


def count(db: Session, scope: str, key: str, window_seconds: int) -> int:
    n = db.execute(_COUNT, {"scope": scope, "key": _hash(key), "window": window_seconds}).scalar()
    return int(n or 0)


def clear(db: Session, scope: str, key: str) -> None:
    db.execute(text("DELETE FROM auth_throttle WHERE scope = :s AND key_hash = :k"), {"s": scope, "k": _hash(key)})
    db.commit()


def _purge(db: Session) -> None:
    db.execute(text("DELETE FROM auth_throttle WHERE window_start < now() - interval '2 days'"))
    # housekeeping for the other auth tables rides along: dead sessions and spent/expired tokens
    db.execute(text("DELETE FROM auth_sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '30 days'"))
    db.execute(text("DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days'"))
    db.commit()


def too_many(window_seconds: int) -> HTTPException:
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "Too many attempts. Please wait a while and try again.",
        headers={"Retry-After": str(window_seconds)},
    )


def enforce(db: Session, scope: str, key: str, limit: int, window_seconds: int) -> None:
    """Count this request and reject it once the window's limit is exceeded."""
    if hit(db, scope, key, window_seconds) > limit:
        raise too_many(window_seconds)
