"""FastAPI dependencies that put a shared (DB-backed, see core/throttle.py)
rate limit on an endpoint. `by_actor` keys on the signed-in user (fair, and
immune to shared school IPs); `by_ip` is for public endpoints.

    @router.post("/x", dependencies=[by_actor("x", limit=30, window_seconds=600)])
"""


from fastapi import Depends, Request
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_actor
from backend.core import throttle
from backend.db.session import get_db


def by_ip(scope: str, *, limit: int, window_seconds: int):
    def dependency(request: Request, db: Session = Depends(get_db)) -> None:
        throttle.enforce(db, scope, throttle.client_ip(request), limit, window_seconds)

    return Depends(dependency)


def by_actor(scope: str, *, limit: int, window_seconds: int):
    def dependency(actor=Depends(get_current_actor), db: Session = Depends(get_db)) -> None:
        throttle.enforce(db, scope, str(actor.id), limit, window_seconds)

    return Depends(dependency)


__all__ = ["by_ip", "by_actor"]
