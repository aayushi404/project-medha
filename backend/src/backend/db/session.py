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
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

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
    if settings.db_slots > 0:
        return settings.db_slots
    capacity = settings.db_pool_size + settings.db_max_overflow
    return max(capacity - _RESERVED_CONNECTIONS, 1)


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


async def get_db() -> AsyncGenerator[Session, None]:
    try:
        await _take_slot(settings.db_slot_wait_seconds)
    except TimeoutError:
        SlotStats.rejected += 1
        logger.warning("no database slot free after %ss", settings.db_slot_wait_seconds)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The server is busy. Please try again shortly.",
            headers={"Retry-After": "5"},
        ) from None

    db = SessionLocal()
    slot = _RequestSlot(db)
    _current_slot.set(slot)
    try:
        yield db
    finally:
        # Closing talks to the database, so it stays off the event loop. Shielded so
        # a client hanging up cannot leave the connection and slot unreturned.
        with anyio.CancelScope(shield=True):
            await anyio.to_thread.run_sync(db.close)
            if slot.held:
                slot.held = False
                _return_slot()


def _end_read_transaction(db: Session) -> None:
    """Returns the connection. Objects stay loaded: expiring them would make the caller
    re-read everything it holds afterwards."""
    expire_on_commit = db.expire_on_commit
    db.expire_on_commit = False
    try:
        db.commit()
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
    if slot is None or not slot.held or slot.db.new or slot.db.dirty or slot.db.deleted:
        yield
        return

    await anyio.to_thread.run_sync(_end_read_transaction, slot.db)
    slot.held = False
    _return_slot()
    try:
        yield
    except Exception:
        # The caller may still record the failure in the database.
        await _take_slot(None)
        slot.held = True
        raise
    except BaseException:
        # Cancelled or closed: nothing will use the session again except `get_db`
        # closing it, and waiting for a slot here could hold up the cancellation.
        raise
    await _take_slot(None)
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
