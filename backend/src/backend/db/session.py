"""Database sessions, plus the slot limit that keeps the connection pool from deadlocking.

Why slots exist. A request's session keeps its connection from its first query until
`get_db` closes it, and each step in between (auth, the route, the close) needs a free
worker thread. Under load every thread could end up blocked waiting for a connection,
while every connection belonged to a request waiting for a thread: nothing moved until
the pool's timeout. A bigger pool only moved the point where this began.

So a request takes a slot before it opens a session, and there are fewer slots than
connections. Whoever holds a slot is guaranteed a connection without waiting, so threads
never block on the pool. Requests beyond that queue on the event loop, which costs
almost nothing. The limit is per process, as the pool is.

A connection must not sit idle during a slow outside call, such as an LLM stream, so
those calls run inside `outside_call()`, which gives back the connection and the slot
until the call ends. The LLM, speech and embedding clients do this themselves, so
features need no code of their own.
"""

import asyncio
import contextvars
import logging
import weakref
from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager

import anyio
from fastapi import HTTPException, status
from sqlalchemy import create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from starlette.datastructures import Headers

from backend.core.config import DATABASE_URL, settings

logger = logging.getLogger("backend.db")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# A couple of connections stay outside the slot limit as a margin for code holding
# its own session, so the guarantee above survives a small miscount.
_RESERVED_CONNECTIONS = 2


def slot_limit() -> int:
    capacity = settings.db_pool_size + settings.db_max_overflow
    most = max(capacity - _RESERVED_CONNECTIONS, 1)
    # Never above the pool: more slots than connections would bring the deadlock back.
    return min(settings.db_slots, most) if settings.db_slots > 0 else most


class SlotStats:
    """Live counts, for monitoring and tests."""

    in_use = 0
    waiting = 0
    rejected = 0


# One semaphore per event loop. A server has one loop per process; tests may create more.
_semaphores: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore]" = (
    weakref.WeakKeyDictionary()
)


def _semaphore() -> asyncio.Semaphore:
    loop = asyncio.get_running_loop()
    semaphore = _semaphores.get(loop)
    if semaphore is None:
        semaphore = _semaphores[loop] = asyncio.Semaphore(slot_limit())
    return semaphore


async def _take_slot(timeout: float | None) -> None:
    SlotStats.waiting += 1
    try:
        if timeout is None:
            await _semaphore().acquire()
        else:
            await asyncio.wait_for(_semaphore().acquire(), timeout)
    finally:
        SlotStats.waiting -= 1
    SlotStats.in_use += 1


def _return_slot() -> None:
    SlotStats.in_use -= 1
    _semaphore().release()


class _RequestSlot:
    """Whether this request's slot is currently taken, and the session it protects."""

    __slots__ = ("db", "held")

    def __init__(self, db: Session) -> None:
        self.db = db
        self.held = True


_current_slot: contextvars.ContextVar[_RequestSlot | None] = contextvars.ContextVar(
    "medha_db_request_slot", default=None
)


class DatabaseBusy(HTTPException):
    """No slot came free in time. Answers 503 if it reaches the client."""

    def __init__(self) -> None:
        super().__init__(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The server is busy. Please try again shortly.",
            headers={"Retry-After": "5"},
        )


async def _take_slot_or_busy() -> None:
    try:
        await _take_slot(settings.db_slot_wait_seconds)
    except TimeoutError:
        SlotStats.rejected += 1
        logger.warning("no database slot free after %ss", settings.db_slot_wait_seconds)
        raise DatabaseBusy() from None


async def _finish_with(slot: _RequestSlot) -> None:
    """Close the session and return the slot. Closing talks to the database, so it stays
    off the event loop. Shielded so a client hanging up cannot leave them unreturned. The
    slot goes back even if closing fails: a database blip must not use up slots for good."""
    with anyio.CancelScope(shield=True):
        try:
            await anyio.to_thread.run_sync(slot.db.close)
        except Exception as exc:
            logger.warning("closing a database session failed: %s", exc)
        finally:
            if slot.held:
                slot.held = False
                _return_slot()


async def get_db() -> AsyncGenerator[Session, None]:
    await _take_slot_or_busy()

    db = SessionLocal()
    slot = _RequestSlot(db)
    _current_slot.set(slot)
    try:
        yield db
    finally:
        await _finish_with(slot)


class ReleaseDatabaseBeforeSending:
    """Gives back the session and slot once a response is ready, before sending it. Otherwise
    a few people downloading a large file over slow connections would hold every slot while
    the database sat idle. Server-sent events keep theirs: those routes still use the session
    while streaming, and give it back around their slow calls with `outside_call`."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_after_release(message) -> None:
            if message["type"] == "http.response.start":
                content_type = Headers(raw=message.get("headers", [])).get("content-type", "")
                slot = _current_slot.get()
                if slot is not None and not content_type.startswith("text/event-stream"):
                    await _finish_with(slot)
            await send(message)

        await self.app(scope, receive, send_after_release)


# Writes sent to the database but not yet committed. `Session.new` and friends are empty
# by then, so this is how `outside_call` knows not to commit half of something.
@event.listens_for(Session, "after_flush")
def _note_flush(session: Session, _flush_context) -> None:
    session.info["unsaved_flush"] = True


@event.listens_for(Session, "after_commit")
@event.listens_for(Session, "after_rollback")
def _clear_flush(session: Session) -> None:
    session.info.pop("unsaved_flush", None)


def _has_unsaved_changes(db: Session) -> bool:
    return bool(db.new or db.dirty or db.deleted or db.info.get("unsaved_flush"))


def _end_read_transaction(db: Session) -> None:
    """Returns the connection. Objects stay loaded: expiring them would make the caller
    re-read everything it holds afterwards."""
    expire_on_commit = db.expire_on_commit
    db.expire_on_commit = False
    try:
        db.commit()
    except SQLAlchemyError as exc:
        # Nothing was unsaved, so nothing is lost. The call can go ahead, and the next
        # query gets a fresh connection.
        logger.warning("ending a read transaction failed: %s", exc)
        db.invalidate()
    finally:
        db.expire_on_commit = expire_on_commit


@asynccontextmanager
async def outside_call() -> AsyncIterator[None]:
    """Wrap a slow call to another service. The connection and slot go back for its
    duration, so a request waiting on an LLM does not stop others using the database.

    Does nothing where it cannot help safely: outside a request, inside another
    `outside_call`, or with unsaved changes, because saving them early here could
    store half of something the caller means to save as one unit.
    """
    slot = _current_slot.get()
    if slot is None or not slot.held or _has_unsaved_changes(slot.db):
        yield
        return

    await anyio.to_thread.run_sync(_end_read_transaction, slot.db)
    slot.held = False
    _return_slot()
    try:
        yield
    except Exception:
        # The caller may still record the failure in the database.
        try:
            await _take_slot(settings.db_slot_wait_seconds)
            slot.held = True
        except TimeoutError:
            logger.warning("no slot free to record a failed outside call")
        raise
    except BaseException:
        # Cancelled or closed: nothing will use the session again except `get_db`
        # closing it, and waiting for a slot here could hold up the cancellation.
        raise
    await _take_slot_or_busy()
    slot.held = True


@asynccontextmanager
async def own_slot() -> AsyncIterator[None]:
    """For code that opens its own `SessionLocal()` while running on the event loop,
    so it cannot block the loop on a full pool."""
    await _take_slot(None)
    try:
        yield
    finally:
        _return_slot()
