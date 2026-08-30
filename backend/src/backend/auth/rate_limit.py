"""Login throttle: 5 failed attempts per email per 15 minutes.

Password auth without throttling is brute-forceable in a way phone OTP wasn't.
This is an in-process sliding window -- fine for the single-worker pilot; move
to Redis alongside the chat limiter (see chat/rate_limit.py) in Phase 2.
"""
import threading
import time

_WINDOW_SECONDS = 15 * 60
_MAX_FAILURES = 5

_lock = threading.Lock()
# email -> list[failure epoch seconds], oldest first
_failures: dict[str, list[float]] = {}


def _prune(email: str, now: float) -> list[float]:
    kept = [t for t in _failures.get(email, []) if now - t < _WINDOW_SECONDS]
    if kept:
        _failures[email] = kept
    else:
        _failures.pop(email, None)
    return kept


def is_locked_out(email: str) -> bool:
    now = time.monotonic()
    with _lock:
        return len(_prune(email, now)) >= _MAX_FAILURES


def record_failure(email: str) -> None:
    now = time.monotonic()
    with _lock:
        _prune(email, now)
        _failures.setdefault(email, []).append(now)


def reset(email: str) -> None:
    """Clear the counter after a successful login."""
    with _lock:
        _failures.pop(email, None)
