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
from backend.db.session import (  # noqa: E402
    DatabaseBusy,
    ReleaseDatabaseBeforeSending,
    SlotStats,
    get_db,
    in_db_thread,
    outside_call,
    own_slot,
)
from sse_starlette.sse import EventSourceResponse  # noqa: E402

_REAL_SLOT_LIMIT = db_session.slot_limit

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
        return {"value": await in_db_thread(lambda: db.execute(text("SELECT 2")).scalar_one())}

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
            self.assertEqual(SlotStats.in_use, 0, "not retaken until something needs the database")
            value = await in_db_thread(lambda: db.execute(text("SELECT 2")).scalar_one())
            self.assertEqual(value, 2)
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

    def test_a_failed_call_can_still_record_it_in_the_database(self):
        async def scenario():
            dependency = get_db()
            db = await dependency.__anext__()
            with self.assertRaises(ValueError):
                async with outside_call():
                    raise ValueError("provider failed")
            self.assertEqual(SlotStats.in_use, 0)
            self.assertEqual(await in_db_thread(lambda: db.execute(text("SELECT 1")).scalar_one()), 1)
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


class SlotSafetyTests(_DeadlockTestCase):
    def test_a_failed_close_still_returns_the_slot(self):
        class BreaksOnClose:
            info: dict = {}

            def close(self):
                raise RuntimeError("the connection died")

        async def scenario():
            with mock.patch.object(db_session, "SessionLocal", BreaksOnClose):
                for _ in range(POOL_SIZE + 2):  # more than the slots there are
                    dependency = get_db()
                    await asyncio.wait_for(dependency.__anext__(), 2)
                    await dependency.aclose()
            self.assertEqual(SlotStats.in_use, 0)

        asyncio.run(scenario())

    def test_db_slots_can_never_exceed_the_pool(self):
        with mock.patch.object(db_session, "slot_limit", _REAL_SLOT_LIMIT), \
                mock.patch.object(db_session.settings, "db_pool_size", 5), \
                mock.patch.object(db_session.settings, "db_max_overflow", 10):
            with mock.patch.object(db_session.settings, "db_slots", 20):
                self.assertEqual(db_session.slot_limit(), 13)
            with mock.patch.object(db_session.settings, "db_slots", 4):
                self.assertEqual(db_session.slot_limit(), 4)
            with mock.patch.object(db_session.settings, "db_slots", 0):
                self.assertEqual(db_session.slot_limit(), 13)

    def test_each_request_closes_its_session_once(self):
        closes = []
        real = self.factory

        def counting():
            db = real()
            original = db.close
            db.close = lambda: (closes.append(1), original())[1]
            return db

        async def scenario():
            with mock.patch.object(db_session, "SessionLocal", counting):
                async def inner(scope, receive, send):
                    dependency = get_db()
                    await dependency.__anext__()
                    await send({"type": "http.response.start", "status": 200, "headers": []})
                    await dependency.aclose()

                async def send(_message):
                    pass

                await ReleaseDatabaseBeforeSending(inner)({"type": "http"}, None, send)

        asyncio.run(scenario())
        self.assertEqual(len(closes), 1)


class ReleaseBeforeSendingTests(_DeadlockTestCase):
    def _slots_when_sending(self, path: str, *, release: bool = True) -> list[int]:
        app = _build_app(self.factory, get_db)

        @app.get("/stream")
        async def stream(db: Session = Depends(get_db)):
            async def events():
                db.execute(text("SELECT 1"))
                yield {"event": "done", "data": "{}"}

            return EventSourceResponse(events())

        inner = ReleaseDatabaseBeforeSending(app) if release else app
        seen: list[int] = []

        async def recording(scope, receive, send):
            async def recording_send(message):
                if message["type"] == "http.response.start":
                    seen.append(SlotStats.in_use)
                await send(message)

            await inner(scope, receive, recording_send)

        async def scenario():
            transport = httpx.ASGITransport(app=recording)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(path)
            self.assertEqual(response.status_code, 200)

        asyncio.run(scenario())
        self.assertEqual(SlotStats.in_use, 0)
        return seen

    def test_control_without_it_the_slot_is_held_while_sending(self):
        self.assertEqual(self._slots_when_sending("/me", release=False), [1])

    def test_a_normal_response_gives_the_slot_back_before_sending(self):
        self.assertEqual(self._slots_when_sending("/me"), [0])

    def test_a_stream_keeps_its_slot_because_it_still_uses_the_session(self):
        self.assertEqual(self._slots_when_sending("/stream"), [1])


class OutsideCallFailureTests(_DeadlockTestCase):
    def test_flushed_writes_are_not_committed_early(self):
        from sqlalchemy import Column, Integer
        from sqlalchemy.orm import declarative_base

        model = type("F", (declarative_base(),), {"__tablename__": "flushed", "a": Column(Integer, primary_key=True)})

        async def scenario():
            dependency = get_db()
            db = await dependency.__anext__()
            db.execute(text("CREATE TABLE IF NOT EXISTS flushed (a INTEGER PRIMARY KEY)"))
            db.commit()
            db.add(model(a=1))
            db.flush()
            self.assertFalse(db.new)
            async with outside_call():
                self.assertEqual(SlotStats.in_use, 1, "must keep the slot, not commit half the work")
            db.rollback()
            self.assertEqual(db.execute(text("SELECT count(*) FROM flushed")).scalar_one(), 0)
            db.commit()
            async with outside_call():
                self.assertEqual(SlotStats.in_use, 0, "a commit clears it")
            await dependency.aclose()

        asyncio.run(scenario())

    def test_a_dead_connection_before_the_call_does_not_stop_the_call(self):
        from sqlalchemy import Column, Integer
        from sqlalchemy.exc import OperationalError
        from sqlalchemy.orm import declarative_base

        model = type("D", (declarative_base(),), {"__tablename__": "dead_conn", "a": Column(Integer, primary_key=True)})

        async def scenario():
            dependency = get_db()
            db = await dependency.__anext__()
            db.execute(text("CREATE TABLE IF NOT EXISTS dead_conn (a INTEGER PRIMARY KEY)"))
            db.execute(text("INSERT OR IGNORE INTO dead_conn (a) VALUES (7)"))
            db.commit()
            row = db.get(model, 7)
            ran = False
            with mock.patch.object(db, "commit", side_effect=OperationalError("x", {}, Exception("gone"))):
                async with outside_call():
                    ran = True
                    self.assertEqual(SlotStats.in_use, 0)
            self.assertTrue(ran)
            self.assertIn(row, db, "what the caller holds must stay usable")
            self.assertEqual(await in_db_thread(lambda: row.a), 7, "and it reloads over a fresh connection")
            await dependency.aclose()

        asyncio.run(scenario())

    def _with_every_slot_taken_during_the_call(self, after_call):
        async def scenario():
            dependency = get_db()
            db = await dependency.__anext__()
            with mock.patch.object(db_session.settings, "db_slot_wait_seconds", 0.05):
                async with outside_call():
                    for _ in range(POOL_SIZE):
                        await db_session._take_slot(None)
                try:
                    return await after_call(db)
                finally:
                    for _ in range(POOL_SIZE):
                        db_session._return_slot()
                    await dependency.aclose()
                    self.assertEqual(SlotStats.in_use, 0)

        return asyncio.run(scenario())

    def test_a_finished_result_does_not_need_a_slot(self):
        async def finish(_db):
            return "the paid answer"

        self.assertEqual(self._with_every_slot_taken_during_the_call(finish), "the paid answer")

    def test_using_the_database_with_no_slot_free_answers_busy_and_runs_nothing(self):
        ran = []

        async def save(db):
            with self.assertRaises(DatabaseBusy) as caught:
                await in_db_thread(ran.append, 1)
            return caught.exception.status_code

        self.assertEqual(self._with_every_slot_taken_during_the_call(save), 503)
        self.assertEqual(ran, [], "must not touch the database without a slot")


class RealClientsGiveBackTheSlotTests(_DeadlockTestCase):
    """Each real client must release the slot around its outside call, with only the
    provider's SDK or HTTP call replaced. A fake client would prove nothing here."""

    def _slots_during(self, call) -> list[int]:
        seen: list[int] = []

        async def scenario():
            dependency = get_db()
            await dependency.__anext__()
            self.assertEqual(SlotStats.in_use, 1)
            await call(seen)
            await dependency.aclose()
            self.assertEqual(SlotStats.in_use, 0)

        asyncio.run(scenario())
        self.assertTrue(seen, "the provider was never called")
        return seen

    def test_gemini_complete(self):
        from backend.llm.gemini import GeminiClient

        async def call(seen):
            async def generate_content(**_):
                seen.append(SlotStats.in_use)
                return mock.Mock(usage_metadata=None, text="hi")

            client = GeminiClient(api_key="x", model="m")
            client._client = mock.Mock()
            client._client.aio.models.generate_content = generate_content
            self.assertEqual((await client.complete(system="s", messages=[])).text, "hi")

        self.assertEqual(self._slots_during(call), [0])

    def test_gemini_stream(self):
        from backend.llm.gemini import GeminiClient

        async def call(seen):
            async def chunks():
                seen.append(SlotStats.in_use)
                yield mock.Mock(text="hi", usage_metadata=None)

            async def generate_content_stream(**_):
                seen.append(SlotStats.in_use)
                return chunks()

            client = GeminiClient(api_key="x", model="m")
            client._client = mock.Mock()
            client._client.aio.models.generate_content_stream = generate_content_stream
            events = [event async for event in client.stream(system="s", messages=[])]
            self.assertEqual(events[0].text, "hi")

        self.assertEqual(self._slots_during(call), [0, 0])

    def test_claude_complete(self):
        from backend.llm.claude import ClaudeClient

        async def call(seen):
            async def create(**_):
                seen.append(SlotStats.in_use)
                return mock.Mock(content=[], usage=mock.Mock(input_tokens=1, output_tokens=1))

            client = ClaudeClient(api_key="x", model="m")
            client._client = mock.Mock()
            client._client.messages.create = create
            await client.complete(system="s", messages=[])

        self.assertEqual(self._slots_during(call), [0])

    def test_claude_stream(self):
        from backend.llm.claude import ClaudeClient

        async def call(seen):
            class Stream:
                async def __aenter__(self):
                    seen.append(SlotStats.in_use)
                    return self

                async def __aexit__(self, *_):
                    return False

                async def __aiter__(self):
                    yield mock.Mock(type="text", text="hi")

                async def get_final_message(self):
                    return mock.Mock(usage=mock.Mock(input_tokens=1, output_tokens=1))

            client = ClaudeClient(api_key="x", model="m")
            client._client = mock.Mock()
            client._client.messages.stream = lambda **_: Stream()
            events = [event async for event in client.stream(system="s", messages=[])]
            self.assertEqual(events[0].text, "hi")

        self.assertEqual(self._slots_during(call), [0])

    def test_voyage_embeddings(self):
        from backend.retrieval.embedder import VoyageEmbedder

        async def call(seen):
            async def embed(*_a, **_k):
                seen.append(SlotStats.in_use)
                return mock.Mock(embeddings=[[0.1]])

            client = VoyageEmbedder(api_key="x", model="m", dim=1)
            client._client = mock.Mock(embed=embed)
            self.assertEqual(await client.embed(["q"], input_type="query"), [[0.1]])

        self.assertEqual(self._slots_during(call), [0])

    def _sarvam(self, seen, payload):
        class Http:
            def __init__(self, **_):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return False

            async def post(self, *_a, **_k):
                seen.append(SlotStats.in_use)
                return mock.Mock(status_code=200, json=lambda: payload, text="")

        return mock.patch("backend.speech.client.httpx.AsyncClient", Http)

    def test_sarvam_speech_to_text(self):
        from backend.speech import client as speech

        async def call(seen):
            with self._sarvam(seen, {"transcript": "namaste", "language_code": "hi-IN"}), \
                    mock.patch.object(speech.settings, "sarvam_api_key", "x"):
                await speech.transcribe(b"x" * 600, filename="a.wav", content_type="audio/wav")

        self.assertEqual(self._slots_during(call), [0])

    def test_sarvam_text_to_speech(self):
        from backend.speech import client as speech

        async def call(seen):
            with self._sarvam(seen, {"audios": ["AAAA"]}), mock.patch.object(speech.settings, "sarvam_api_key", "x"):
                await speech.synthesize("namaste", language="hi")

        self.assertEqual(self._slots_during(call), [0])


class CancellationTests(_DeadlockTestCase):
    def test_cancelled_while_holding_a_slot_returns_it(self):
        async def scenario():
            started = asyncio.Event()

            async def request():
                dependency = get_db()
                await dependency.__anext__()
                try:
                    started.set()
                    await asyncio.sleep(60)
                finally:
                    await dependency.aclose()

            task = asyncio.create_task(request())
            await started.wait()
            self.assertEqual(SlotStats.in_use, 1)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertEqual(SlotStats.in_use, 0)
            self.assertEqual(SlotStats.waiting, 0)

        asyncio.run(scenario())

    def test_cancelled_while_waiting_to_retake_a_slot_leaves_nothing_taken(self):
        async def scenario():
            waiting = asyncio.Event()

            async def request():
                dependency = get_db()
                await dependency.__anext__()
                try:
                    async with outside_call():
                        for _ in range(POOL_SIZE):
                            await db_session._take_slot(None)
                    waiting.set()
                    await in_db_thread(lambda: None)
                finally:
                    await dependency.aclose()

            task = asyncio.create_task(request())
            await waiting.wait()
            await asyncio.sleep(0.01)
            self.assertEqual(SlotStats.waiting, 1)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertEqual(SlotStats.waiting, 0)
            self.assertEqual(SlotStats.in_use, POOL_SIZE, "only the slots this test took itself")
            for _ in range(POOL_SIZE):
                db_session._return_slot()

        asyncio.run(scenario())

    def test_client_disconnecting_from_a_real_stream_returns_the_slot(self):
        app = FastAPI()
        streaming = asyncio.Event()

        @app.get("/stream")
        async def stream(db: Session = Depends(get_db)):
            async def events():
                await in_db_thread(lambda: db.execute(text("SELECT 1")).scalar_one())
                yield {"event": "token", "data": "1"}
                streaming.set()
                await asyncio.sleep(60)
                yield {"event": "done", "data": "{}"}

            return EventSourceResponse(events())

        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "GET", "path": "/stream",
                 "raw_path": b"/stream", "query_string": b"", "headers": [], "scheme": "http",
                 "server": ("test", 80), "client": ("test", 1), "root_path": ""}

        async def scenario():
            asked = False

            async def receive():
                nonlocal asked
                if not asked:
                    asked = True
                    return {"type": "http.request", "body": b"", "more_body": False}
                await streaming.wait()
                return {"type": "http.disconnect"}

            async def send(_message):
                pass

            await asyncio.wait_for(ReleaseDatabaseBeforeSending(app)(scope, receive, send), 5)
            self.assertEqual(SlotStats.in_use, 0)

        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
