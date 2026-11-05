"""The connection-pool deadlock must stay fixed (db/session.py). Runs without Postgres, on
a small SQLite pool. The first test is a control: it shows this setup really reproduces
the freeze with the old sync `get_db`, so the fixed version passing means something.
"""

import asyncio
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
os.environ.setdefault("JWT_SECRET_KEY", "x" * 40)

import httpx  # noqa: E402
from fastapi import Depends, FastAPI  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import QueuePool  # noqa: E402

from backend.db import session as db_session  # noqa: E402
from backend.db.session import SlotStats, get_db, outside_call, own_slot  # noqa: E402

POOL_SIZE = 3
POOL_TIMEOUT = 2
REQUESTS = 120  # far beyond both the pool and the 40-thread limit, as in the real freeze


def _small_pool_factory(path: str) -> sessionmaker:
    engine = create_engine(
        f"sqlite:///{path}",
        poolclass=QueuePool, pool_size=POOL_SIZE, max_overflow=0, pool_timeout=POOL_TIMEOUT,
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _build_app(factory: sessionmaker, dependency) -> FastAPI:
    """Mirrors how the real routes use a session: an auth-style dependency queries first,
    then the sync route queries again, with thread hops in between."""
    app = FastAPI()

    def auth(db: Session = Depends(dependency)) -> int:
        return db.execute(text("SELECT 1")).scalar_one()

    @app.get("/me")
    def me(user: int = Depends(auth), db: Session = Depends(dependency)) -> dict:
        return {"value": db.execute(text("SELECT 2")).scalar_one()}

    @app.get("/slow")
    async def slow(db: Session = Depends(dependency)) -> dict:
        db.execute(text("SELECT 1")).scalar_one()
        async with outside_call():
            await asyncio.sleep(0.5)
        return {"value": db.execute(text("SELECT 2")).scalar_one()}

    return app


async def _hammer(app: FastAPI, path: str, count: int) -> list[int]:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=60) as client:
        responses = await asyncio.gather(*(client.get(path) for _ in range(count)))
    return [r.status_code for r in responses]


class _DeadlockTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db")
        self.factory = _small_pool_factory(self.tmp.name)
        self.addCleanup(self.tmp.close)
        self.addCleanup(self.factory.kw["bind"].dispose)
        patcher = mock.patch.object(db_session, "SessionLocal", self.factory)
        patcher.start()
        self.addCleanup(patcher.stop)
        limit = mock.patch.object(db_session, "slot_limit", lambda: POOL_SIZE)
        limit.start()
        self.addCleanup(limit.stop)


class ControlTests(_DeadlockTestCase):
    def test_old_sync_dependency_really_does_deadlock(self):
        factory = self.factory

        def old_get_db():
            db = factory()
            try:
                yield db
            finally:
                db.close()

        codes = asyncio.run(_hammer(_build_app(factory, old_get_db), "/me", REQUESTS))
        self.assertGreater(codes.count(500), 0, "control did not reproduce the pool timeouts")


class FixedTests(_DeadlockTestCase):
    def test_no_request_fails_far_beyond_pool_capacity(self):
        started = time.monotonic()
        codes = asyncio.run(_hammer(_build_app(self.factory, get_db), "/me", REQUESTS))
        self.assertEqual(set(codes), {200}, codes)
        # Queuing, not timeouts: well under one pool timeout's stall per batch.
        self.assertLess(time.monotonic() - started, POOL_TIMEOUT * 5)

    def test_slots_all_come_back(self):
        asyncio.run(_hammer(_build_app(self.factory, get_db), "/me", 20))
        self.assertEqual(SlotStats.in_use, 0)
        self.assertEqual(SlotStats.waiting, 0)

    def test_outside_call_frees_the_slot_for_others(self):
        # Sequentially this would take 0.5s x 30 at any pool size if slots were held
        # through the call. Released, they all overlap.
        started = time.monotonic()
        codes = asyncio.run(_hammer(_build_app(self.factory, get_db), "/slow", 30))
        self.assertEqual(set(codes), {200}, codes)
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(SlotStats.in_use, 0)

    def test_full_queue_answers_503_with_retry_after(self):
        async def scenario():
            async with own_slot(), own_slot(), own_slot():  # every slot taken
                app = _build_app(self.factory, get_db)
                transport = httpx.ASGITransport(app=app)
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                    return await client.get("/me")

        before = SlotStats.rejected
        with mock.patch.object(db_session.settings, "db_slot_wait_seconds", 0.1):
            response = asyncio.run(scenario())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers["retry-after"], "5")
        self.assertEqual(SlotStats.rejected, before + 1)
        self.assertEqual(SlotStats.in_use, 0)


class OutsideCallTests(_DeadlockTestCase):
    def _request_session(self):
        """Run `body` as a request would: with a slot and a session."""
        return get_db()

    def test_returns_connection_and_slot_then_retakes_them(self):
        async def scenario():
            dependency = get_db()
            db = await dependency.__anext__()
            db.execute(text("SELECT 1"))
            self.assertEqual(SlotStats.in_use, 1)
            self.assertEqual(self.factory.kw["bind"].pool.checkedout(), 1)
            async with outside_call():
                self.assertEqual(SlotStats.in_use, 0)
                self.assertEqual(self.factory.kw["bind"].pool.checkedout(), 0)
                async with outside_call():  # nested: already released, nothing to do
                    self.assertEqual(SlotStats.in_use, 0)
            self.assertEqual(SlotStats.in_use, 1)
            await dependency.aclose()
            self.assertEqual(SlotStats.in_use, 0)

        asyncio.run(scenario())

    def test_loaded_objects_stay_usable_without_another_query(self):
        """Giving the connection back must not make the caller re-read what it holds."""

        async def scenario():
            from sqlalchemy import Column, Integer, event
            from sqlalchemy.orm import declarative_base

            dependency = get_db()
            db = await dependency.__anext__()
            db.execute(text("CREATE TABLE IF NOT EXISTS expiry_check (a INTEGER PRIMARY KEY)"))
            db.execute(text("INSERT OR IGNORE INTO expiry_check (a) VALUES (1)"))
            db.commit()
            model = type("Row", (declarative_base(),), {"__tablename__": "expiry_check", "a": Column(Integer, primary_key=True)})
            row = db.get(model, 1)

            statements = []
            engine = self.factory.kw["bind"]
            listener = lambda conn, cursor, statement, *rest: statements.append(statement)  # noqa: E731
            event.listen(engine, "before_cursor_execute", listener)
            async with outside_call():
                pass
            self.assertEqual(row.a, 1)
            event.remove(engine, "before_cursor_execute", listener)
            self.assertEqual(statements, [])
            self.assertTrue(db.expire_on_commit, "the session's setting must be restored")
            await dependency.aclose()

        asyncio.run(scenario())

    def test_keeps_the_slot_when_there_are_unsaved_changes(self):
        """Committing here would save half of what the caller means to save as one."""

        async def scenario():
            dependency = get_db()
            db = await dependency.__anext__()
            db.execute(text("CREATE TABLE IF NOT EXISTS t (a INT)"))
            db.commit()
            from sqlalchemy import Column, Integer
            from sqlalchemy.orm import declarative_base

            model = type("T", (declarative_base(),), {"__tablename__": "t", "a": Column(Integer, primary_key=True)})
            db.add(model(a=1))
            async with outside_call():
                self.assertEqual(SlotStats.in_use, 1)
                self.assertTrue(db.new)
            await dependency.aclose()

        asyncio.run(scenario())

    def test_failure_retakes_the_slot_so_the_caller_can_record_it(self):
        async def scenario():
            dependency = get_db()
            await dependency.__anext__()
            with self.assertRaises(ValueError):
                async with outside_call():
                    raise ValueError("provider failed")
            self.assertEqual(SlotStats.in_use, 1)
            await dependency.aclose()
            self.assertEqual(SlotStats.in_use, 0)

        asyncio.run(scenario())

    def test_client_hanging_up_never_leaks_a_slot(self):
        async def scenario():
            async def request():
                dependency = get_db()
                await dependency.__anext__()
                try:
                    async with outside_call():
                        await asyncio.sleep(60)
                finally:
                    await dependency.aclose()

            task = asyncio.create_task(request())
            await asyncio.sleep(0.05)
            self.assertEqual(SlotStats.in_use, 0)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertEqual(SlotStats.in_use, 0)

        asyncio.run(scenario())

    def test_outside_a_request_is_a_no_op(self):
        async def scenario():
            async with outside_call():
                self.assertEqual(SlotStats.in_use, 0)

        import contextvars

        contextvars.Context().run(asyncio.run, scenario())


if __name__ == "__main__":
    unittest.main()
