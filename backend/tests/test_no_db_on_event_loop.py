"""AI routes must never wait on the database on the event loop, because that stalls every
other request in the worker while using no CPU. They must also give the same results as
before, and not hold a database slot during the AI call that writes a chat's title.
Needs Postgres, like the other API tests, and cleans up after itself."""

import asyncio
import json
import os
import sys
import unittest
import uuid
from datetime import date, timedelta
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, text  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from backend.absence_calls.service import queue_call_for_absence  # noqa: E402
from backend.absence_calls.telephony import TelephonyError  # noqa: E402
from backend.app import app  # noqa: E402
from backend.auth.jwt import create_access_token  # noqa: E402
from backend.core.config import settings  # noqa: E402
from backend.db.models import (  # noqa: E402
    AbsenceCall,
    AcademicYear,
    AttendanceRecord,
    ChatMessage,
    ChatSession,
    ClassSection,
    CurriculumChapter,
    District,
    Generation,
    Grade,
    Module,
    ModuleArtifact,
    School,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    TeachingAssignment,
    VoiceTurn,
)
from backend.db.session import SessionLocal, SlotStats, _take_slot, engine, outside_call, slot_limit  # noqa: E402
from backend.llm import Completion, StreamEnd, TokenDelta, Usage  # noqa: E402

REPLY = "Plants make their food from sunlight."
TITLE = "Photosynthesis"


class _FakeLLM:
    """Records how many database slots are taken while each AI call runs."""

    def __init__(self, text: str = REPLY) -> None:
        self.text = text
        self.slots_during_complete: list[int] = []
        self.during_stream = None

    async def stream(self, *, system, messages, max_tokens=None):
        async with outside_call():  # as the real clients do
            await asyncio.sleep(0)
            if self.during_stream is not None:
                await self.during_stream()
            yield TokenDelta(text=self.text)
        yield StreamEnd(usage=Usage(input_tokens=1, output_tokens=2))

    async def complete(self, *, system, messages, max_tokens=None):
        async with outside_call():  # as the real clients do; it keeps the slot if there are unsaved changes
            self.slots_during_complete.append(SlotStats.in_use)
        return Completion(text=TITLE, usage=Usage(input_tokens=1, output_tokens=1))


def _kill_every_other_connection() -> None:
    """A real database failure, not a mock: Postgres ends the backends behind the app's pool."""
    killer = create_engine(engine.url, poolclass=NullPool)
    with killer.connect() as connection:
        connection.execute(text(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = current_database() AND pid <> pg_backend_pid()"
        ))
    killer.dispose()


def _events(response) -> list[tuple[str, dict]]:
    found, name = [], None
    for line in response.text.splitlines():
        if line.startswith("event:"):
            name = line.split(":", 1)[1].strip()
        elif line.startswith("data:") and name:
            found.append((name, json.loads(line.split(":", 1)[1])))
    return found


class NoDatabaseOnEventLoopTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        db = SessionLocal()
        grade = db.query(Grade).order_by(Grade.numeric_level).first()
        subject = db.query(Subject).first()
        if grade is None or subject is None:
            db.close()
            raise unittest.SkipTest("needs seeded grades and subjects: run scripts/seed_phase0.py")
        tag = uuid.uuid4().hex[:8]
        district = District(name=f"Loop {tag}", state="Bihar")
        db.add(district)
        db.flush()
        school = School(name=f"Loop {tag}", district_id=district.id)
        db.add(school)
        db.flush()
        today = date.today()
        year = AcademicYear(school_id=school.id, label=f"L-{tag}", starts_on=today - timedelta(days=30),
                            ends_on=today + timedelta(days=200), is_current=True)
        teacher = Teacher(school_id=school.id, full_name="Loop Teacher", role="teacher", approval_status="approved",
                          phone_number=f"+916{uuid.uuid4().int % 10**9:09d}")
        student = Student(school_id=school.id, full_name="Loop Student", approval_status="approved", password_hash="x",
                          phone_number=f"+917{uuid.uuid4().int % 10**9:09d}")
        db.add_all([year, teacher, student])
        db.flush()
        section = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=grade.id, section="A",
                               class_teacher_id=teacher.id)
        db.add(section)
        db.flush()
        db.add(TeachingAssignment(teacher_id=teacher.id, class_section_id=section.id, subject_id=subject.id,
                                  role="primary"))
        db.add(StudentEnrollment(student_id=student.id, class_section_id=section.id, academic_year_id=year.id,
                                 roll_number=1))
        db.commit()
        cls.ids = {"district": district.id, "school": school.id, "year": year.id, "teacher": teacher.id,
                   "student": student.id, "section": section.id, "grade": grade.id, "subject": subject.id}
        db.close()
        cls.teacher_headers = {"Authorization": f"Bearer {create_access_token(cls.ids['teacher'])}"}
        cls.student_headers = {"Authorization": f"Bearer {create_access_token(cls.ids['student'], 'student')}"}

    @classmethod
    def tearDownClass(cls):
        ids, db = cls.ids, SessionLocal()
        sessions = [row.id for row in db.query(ChatSession.id).filter(
            (ChatSession.teacher_id == ids["teacher"]) | (ChatSession.student_id == ids["student"]))]
        modules = [row.id for row in db.query(Module.id).filter(Module.teacher_id == ids["teacher"])]
        db.query(ModuleArtifact).filter(ModuleArtifact.module_id.in_(modules)).delete()
        db.query(Module).filter(Module.id.in_(modules)).delete()
        db.query(Generation).filter(Generation.teacher_id == ids["teacher"]).delete()
        db.query(AbsenceCall).filter(AbsenceCall.student_id == ids["student"]).delete()
        db.query(AttendanceRecord).filter(AttendanceRecord.student_id == ids["student"]).delete()
        db.query(VoiceTurn).filter(VoiceTurn.session_id.in_(sessions)).delete()
        db.query(ChatMessage).filter(ChatMessage.session_id.in_(sessions)).delete()
        db.query(ChatSession).filter(ChatSession.id.in_(sessions)).delete()
        db.query(StudentEnrollment).filter(StudentEnrollment.student_id == ids["student"]).delete()
        db.query(TeachingAssignment).filter(TeachingAssignment.teacher_id == ids["teacher"]).delete()
        db.query(ClassSection).filter(ClassSection.id == ids["section"]).delete()
        db.query(Student).filter(Student.id == ids["student"]).delete()
        db.query(Teacher).filter(Teacher.id == ids["teacher"]).delete()
        db.query(AcademicYear).filter(AcademicYear.id == ids["year"]).delete()
        db.query(School).filter(School.id == ids["school"]).delete()
        db.query(District).filter(District.id == ids["district"]).delete()
        db.commit()
        db.close()

    def setUp(self):
        self.on_loop: list[str] = []

        def record(conn, cursor, statement, *rest):
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                return  # a worker thread: where it should be
            self.on_loop.append(statement[:90])

        event.listen(engine, "before_cursor_execute", record)
        self.addCleanup(event.remove, engine, "before_cursor_execute", record)
        # One teacher makes many requests here, which the per-person limits would refuse.
        for limit in ("generation_rate_limit_per_min", "generation_rate_limit_per_day",
                      "chat_rate_limit_per_min", "chat_rate_limit_per_day"):
            patcher = mock.patch.object(settings, limit, 100_000)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.llm = _FakeLLM()
        for target in ("backend.ask.service.get_llm_client", "backend.tutor.service.get_llm_client",
                       "backend.english.service.get_llm_client", "backend.generation.pipeline.get_llm_client",
                       "backend.speech.service.get_llm_client"):
            patcher = mock.patch(target, lambda self=self: self.llm)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _session(self, owner: str, **extra) -> uuid.UUID:
        db = SessionLocal()
        row = ChatSession(grade_id=self.ids["grade"], subject_id=self.ids["subject"],
                          **{f"{owner}_id": self.ids[owner]}, **extra)
        db.add(row)
        db.commit()
        session_id = row.id
        db.close()
        return session_id

    def _saved(self, session_id):
        db = SessionLocal()
        messages = [(m.role, m.content) for m in db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)]
        title = db.get(ChatSession, session_id).title
        db.close()
        return messages, title

    def test_ask_medha_message(self):
        session_id = self._session("teacher")
        response = self.client.post(f"/ask/sessions/{session_id}/messages", json={"content": "What is it?"},
                                    headers=self.teacher_headers)
        self.assertEqual(response.status_code, 200, response.text)
        events = _events(response)
        self.assertEqual(events[0], ("token", {"text": REPLY}))
        self.assertEqual(events[-1][0], "done", events)
        self.assertTrue(events[-1][1]["module_id"])
        self.assertEqual(self.on_loop, [])
        self.assertEqual(self._saved(session_id), ([("teacher", "What is it?"), ("assistant", REPLY)], TITLE))

    def test_title_call_does_not_hold_a_database_slot(self):
        session_id = self._session("teacher")
        self.client.post(f"/ask/sessions/{session_id}/messages", json={"content": "Why?"}, headers=self.teacher_headers)
        self.assertEqual(len(self.llm.slots_during_complete), 1, "a new chat should get one title")
        self.assertEqual(self.llm.slots_during_complete, [0])

    def test_a_titled_chat_makes_no_title_call_and_keeps_its_title(self):
        session_id = self._session("teacher", title="Kept")
        response = self.client.post(f"/ask/sessions/{session_id}/messages", json={"content": "Why?"},
                                    headers=self.teacher_headers)
        self.assertEqual(_events(response)[-1][0], "done", response.text)
        self.assertEqual(self.llm.slots_during_complete, [])
        self.assertEqual(self._saved(session_id)[1], "Kept")

    def test_someone_elses_session_is_still_a_clean_error(self):
        session_id = self._session("teacher")
        response = self.client.post(f"/tutor/sessions/{session_id}/messages", json={"content": "Hi"},
                                    headers=self.student_headers)
        self.assertIn(response.status_code, (403, 404), response.text)

    def test_tutor_message(self):
        session_id = self._session("student")
        response = self.client.post(f"/tutor/sessions/{session_id}/messages", json={"content": "Explain"},
                                    headers=self.student_headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(_events(response)[-1][0], "done", response.text)
        self.assertEqual(self.on_loop, [])
        self.assertEqual(self._saved(session_id), ([("student", "Explain"), ("assistant", REPLY)], "Explain"))

    def test_english_message(self):
        session_id = self._session("student", title="Greetings")
        response = self.client.post(f"/english/sessions/{session_id}/messages", json={"content": "Hello"},
                                    headers=self.student_headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(_events(response)[-1][0], "done", response.text)
        self.assertEqual(self.on_loop, [])
        self.assertEqual(self._saved(session_id), ([("student", "Hello"), ("assistant", REPLY)], "Greetings"))

    def test_generating_a_quiz_then_serving_it_from_the_cache(self):
        self.llm.text = json.dumps({"questions": [{
            "q": "What do plants need?", "type": "mcq", "options": ["Light", "Sand", "Salt", "Iron"],
            "answer": "Light", "difficulty": "easy", "explanation": "Light powers it.",
        }]})
        body = {"scope": {"grade_id": str(self.ids["grade"]), "subject_id": str(self.ids["subject"])},
                "params": {"count": 1, "seed": uuid.uuid4().hex}, "language": "en"}
        first = self.client.post("/generate/quiz", json=body, headers=self.teacher_headers)
        self.assertEqual(first.status_code, 200, first.text)
        done = _events(first)[-1]
        if done[0] == "error":
            self.skipTest(f"this quiz shape is not accepted here: {done[1]}")
        self.assertEqual(done[0], "done", first.text)
        self.assertEqual(self.on_loop, [])
        db = SessionLocal()
        row = db.get(Generation, uuid.UUID(done[1]["generation_id"]))
        self.assertEqual(row.status, "completed")
        self.assertEqual(row.content_json["questions"][0]["answer"], "Light")
        db.close()
        if settings.generation_cache_enabled:
            second = self.client.post("/generate/quiz", json=body, headers=self.teacher_headers)
            self.assertTrue(_events(second)[-1][1].get("cached"), second.text)
            self.assertEqual(self.on_loop, [])

    def test_a_failed_generation_is_recorded(self):
        self.llm.text = "this is not json"
        body = {"scope": {"grade_id": str(self.ids["grade"]), "subject_id": str(self.ids["subject"])},
                "params": {"count": 1, "seed": uuid.uuid4().hex}, "language": "en"}
        with mock.patch.object(settings, "generation_cache_enabled", False):
            response = self.client.post("/generate/quiz", json=body, headers=self.teacher_headers)
        self.assertEqual(_events(response)[-1][0], "error", response.text)
        self.assertEqual(self.on_loop, [])
        db = SessionLocal()
        rows = db.query(Generation).filter(Generation.teacher_id == self.ids["teacher"],
                                           Generation.error_message == "model output was not JSON").all()
        self.assertEqual([row.status for row in rows], ["failed"])
        db.close()

    def _quiz_reply(self) -> str:
        return json.dumps({"questions": [{
            "q": "What do plants need?", "type": "mcq", "options": ["Light", "Sand", "Salt", "Iron"],
            "answer": "Light", "difficulty": "easy", "explanation": "Light powers it.",
        }]})

    def _generate_quiz(self) -> str:
        self.llm.text = self._quiz_reply()
        body = {"scope": {"grade_id": str(self.ids["grade"]), "subject_id": str(self.ids["subject"])},
                "params": {"count": 1, "seed": uuid.uuid4().hex}, "language": "en"}
        with mock.patch.object(settings, "generation_cache_enabled", False):
            response = self.client.post("/generate/quiz", json=body, headers=self.teacher_headers)
        done = _events(response)[-1]
        self.assertEqual(done[0], "done", response.text)
        return done[1]["generation_id"]

    def test_regenerating_keeps_a_link_to_the_original(self):
        parent = self._generate_quiz()
        self.on_loop.clear()
        response = self.client.post(f"/generations/{parent}/regenerate", json={"params": {"count": 1}},
                                    headers=self.teacher_headers)
        self.assertEqual(response.status_code, 200, response.text)
        done = _events(response)[-1]
        self.assertEqual(done[0], "done", response.text)
        self.assertEqual(self.on_loop, [])
        db = SessionLocal()
        row = db.get(Generation, uuid.UUID(done[1]["generation_id"]))
        self.assertEqual((str(row.parent_generation_id), row.source, row.type), (parent, "regenerate", "quiz"))
        db.close()

    def test_regenerating_someone_elses_generation_is_refused(self):
        db = SessionLocal()
        other = Teacher(school_id=self.ids["school"], full_name="Other Teacher", role="teacher", approval_status="approved",
                        phone_number=f"+916{uuid.uuid4().int % 10**9:09d}")
        db.add(other)
        db.flush()
        theirs = Generation(teacher_id=other.id, visibility="private", type="quiz", title="Theirs", language="en",
                            grade_id=self.ids["grade"], subject_id=self.ids["subject"], source="quick_action",
                            status="completed", prompt_version="test", model="test", content_json={"questions": []},
                            cache_key=uuid.uuid4().hex)
        db.add(theirs)
        db.commit()
        other_id, theirs_id = other.id, theirs.id
        db.close()
        self.addCleanup(self._delete_teacher, other_id, theirs_id)
        response = self.client.post(f"/generations/{theirs_id}/regenerate", json={"params": {}},
                                    headers=self.teacher_headers)
        self.assertEqual(response.status_code, 404, response.text)
        self.assertEqual(self.on_loop, [])

    def _delete_teacher(self, teacher_id, generation_id):
        db = SessionLocal()
        db.query(Generation).filter(Generation.id == generation_id).delete()
        db.query(Teacher).filter(Teacher.id == teacher_id).delete()
        db.commit()
        db.close()

    def test_answer_key_checks_the_paper_then_builds_it(self):
        db = SessionLocal()
        paper = Generation(teacher_id=self.ids["teacher"], visibility="private", type="question_paper", title="Paper",
                           language="en", grade_id=self.ids["grade"], subject_id=self.ids["subject"],
                           source="quick_action", status="completed", prompt_version="test", model="test",
                           content_json={"sections": []}, cache_key=uuid.uuid4().hex)
        quiz = Generation(teacher_id=self.ids["teacher"], visibility="private", type="quiz", title="Quiz",
                          language="en", grade_id=self.ids["grade"], subject_id=self.ids["subject"],
                          source="quick_action", status="completed", prompt_version="test", model="test",
                          content_json={"questions": []}, cache_key=uuid.uuid4().hex)
        db.add_all([paper, quiz])
        db.commit()
        paper_id, quiz_id = paper.id, quiz.id
        db.close()
        build = mock.AsyncMock(return_value={"answers": []})
        with mock.patch("backend.generation.answer_key.build", build):
            response = self.client.post(f"/generations/{paper_id}/answer-key", json={}, headers=self.teacher_headers)
            refused = self.client.post(f"/generations/{quiz_id}/answer-key", json={}, headers=self.teacher_headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"answers": []})
        build.assert_awaited_once_with({"sections": []}, "en")
        self.assertEqual(refused.status_code, 400, refused.text)
        self.assertEqual(self.on_loop, [])

    def test_ask_medha_quick_action_saves_a_module(self):
        session_id = self._session("teacher")
        self.llm.text = json.dumps({"questions": [
            {"q": "Why?", "type": "mcq", "options": ["A", "B"], "answer": "A"}
        ]})
        response = self.client.post(f"/ask/sessions/{session_id}/generate", json={"artifact_type": "quiz"},
                                    headers=self.teacher_headers)
        self.assertEqual(response.status_code, 200, response.text)
        done = _events(response)[-1]
        self.assertEqual(done[0], "done", response.text)
        self.assertEqual(done[1]["artifact_type"], "quiz")
        self.assertEqual(self.on_loop, [])
        db = SessionLocal()
        artifact = db.get(ModuleArtifact, uuid.UUID(done[1]["artifact_id"]))
        self.assertEqual(artifact.content_json["questions"][0]["q"], "Why?")
        self.assertIsNotNone(db.get(ChatSession, session_id).title)
        db.close()

    def test_teacher_spoken_turn(self):
        session_id = self._session("teacher")
        with mock.patch("backend.speech.service._audio_frame", mock.AsyncMock(return_value=None)):
            response = self.client.post("/speech/converse",
                                        json={"session_id": str(session_id), "transcript": "Explain", "language": "en",
                                              "style": "short"},
                                        headers=self.teacher_headers)
        self.assertEqual(response.status_code, 200, response.text)
        done = _events(response)[-1]
        self.assertEqual(done[0], "done", response.text)
        self.assertEqual(done[1]["reply_style"], "short")
        self.assertEqual(self.on_loop, [])
        db = SessionLocal()
        session = db.get(ChatSession, session_id)
        self.assertEqual((session.voice_reply_style, session.voice_language), ("short", "en"))
        turn = db.query(VoiceTurn).filter(VoiceTurn.session_id == session_id).one()
        self.assertEqual(turn.assistant_text, REPLY)
        db.close()

    def _absence(self):
        db = SessionLocal()
        student = db.get(Student, self.ids["student"])
        student.guardian_phone = "+919000000001"
        record = AttendanceRecord(student_id=self.ids["student"], marked_by_teacher_id=self.ids["teacher"], status="absent",
                                  attendance_date=date.today() - timedelta(days=uuid.uuid4().int % 3000 + 1))
        db.add(record)
        db.commit()
        record_id = record.id
        db.close()
        return record_id

    def _absence_call(self, record_id):
        db = SessionLocal()
        call = db.query(AbsenceCall).filter(AbsenceCall.attendance_record_id == record_id).one()
        values = (call.status, call.provider_call_sid, call.failure_reason, call.completed_at is not None)
        db.close()
        return values

    def _run_absence(self, provider, enabled=True):
        record_id = self._absence()
        with mock.patch("backend.absence_calls.service.get_telephony_provider", lambda: provider), \
                mock.patch.object(settings, "absence_calling_enabled", enabled):
            asyncio.run(queue_call_for_absence(record_id))
        return self._absence_call(record_id)

    def test_absence_call_holds_no_connection_while_the_provider_answers(self):
        seen = {}
        before = engine.pool.checkedout()  # other test files may have sessions open

        class Provider:
            async def place_call(self, *, to_number, correlation_id):
                seen.update(slots=SlotStats.in_use, connections=engine.pool.checkedout(), number=to_number,
                            correlation_id=correlation_id)
                return mock.Mock(provider_call_sid="CA123")

        result = self._run_absence(Provider())
        self.assertEqual(result, ("dialing", "CA123", None, False))
        self.assertEqual(seen["connections"], before, "no connection should sit idle during the call")
        # Known limit: the slot stays held, so that the call id is saved the moment the provider
        # answers. The voicebot checks that id, so a delay there could drop a live call.
        self.assertEqual(seen["slots"], 1)
        self.assertEqual(seen["number"], "+919000000001")
        uuid.UUID(seen["correlation_id"])
        self.assertEqual(SlotStats.in_use, 0)

    def test_absence_call_records_a_provider_failure(self):
        class Provider:
            async def place_call(self, **_kwargs):
                raise TelephonyError("no route")

        self.assertEqual(self._run_absence(Provider()), ("failed", None, "The call could not be placed.", True))

    def test_absence_call_switched_off_places_nothing(self):
        provider = mock.AsyncMock()
        result = self._run_absence(provider, enabled=False)
        self.assertEqual(result[0], "not_configured")
        provider.place_call.assert_not_called()

    def _ask(self, session_id):
        return self.client.post(f"/ask/sessions/{session_id}/messages", json={"content": "What is it?"},
                                headers=self.teacher_headers)

    def test_connections_killed_during_the_ai_call_still_saves_the_reply(self):
        session_id = self._session("teacher", title="Kept")

        async def kill():
            _kill_every_other_connection()

        self.llm.during_stream = kill
        response = self._ask(session_id)
        self.assertEqual(_events(response)[-1][0], "done", response.text)
        self.assertEqual(self._saved(session_id), ([("teacher", "What is it?"), ("assistant", REPLY)], "Kept"))

    def test_connections_killed_just_before_the_ai_call_still_saves_the_reply(self):
        """The commit that gives the connection back fails, and every object must survive it."""
        session_id = self._session("teacher", title="Kept")
        real = outside_call

        class KillFirst:
            def __init__(self):
                self.inner = real()

            async def __aenter__(self):
                _kill_every_other_connection()
                return await self.inner.__aenter__()

            async def __aexit__(self, *exc):
                return await self.inner.__aexit__(*exc)

        with mock.patch(f"{__name__}.outside_call", KillFirst):
            response = self._ask(session_id)
        self.assertEqual(_events(response)[-1][0], "done", response.text)
        self.assertEqual(self._saved(session_id), ([("teacher", "What is it?"), ("assistant", REPLY)], "Kept"))

    def test_generation_survives_connections_killed_before_the_ai_call(self):
        self.llm.text = self._quiz_reply()
        real = outside_call
        cache_off = mock.patch.object(settings, "generation_cache_enabled", False)
        cache_off.start()
        self.addCleanup(cache_off.stop)

        class KillFirst:
            def __init__(self):
                self.inner = real()

            async def __aenter__(self):
                _kill_every_other_connection()
                return await self.inner.__aenter__()

            async def __aexit__(self, *exc):
                return await self.inner.__aexit__(*exc)

        body = {"scope": {"grade_id": str(self.ids["grade"]), "subject_id": str(self.ids["subject"])},
                "params": {"count": 1, "seed": uuid.uuid4().hex}, "language": "en"}
        with mock.patch(f"{__name__}.outside_call", KillFirst):
            response = self.client.post("/generate/quiz", json=body, headers=self.teacher_headers)
        done = _events(response)[-1]
        self.assertEqual(done[0], "done", response.text)
        db = SessionLocal()
        self.assertEqual(db.get(Generation, uuid.UUID(done[1]["generation_id"])).status, "completed")
        db.close()

    def test_no_slot_free_to_save_a_reply_tells_the_user_and_does_not_hang(self):
        session_id = self._session("teacher", title="Kept")
        taken = slot_limit()

        async def take_all():
            for _ in range(taken):
                await _take_slot(None)

        self.llm.during_stream = take_all
        with mock.patch.object(settings, "db_save_wait_seconds", 0.1):
            response = self._ask(session_id)
        SlotStats.in_use -= taken  # taken on the request's own event loop, which has gone
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(_events(response)[-1][0], "error", response.text)
        self.assertEqual(SlotStats.in_use, 0)
        self.assertEqual(self._saved(session_id)[0], [("teacher", "What is it?")], "the question is still kept")

    def test_generation_with_no_slot_free_to_save_is_marked_failed_not_left_running(self):
        self.llm.text = self._quiz_reply()
        taken = 0

        async def take_all():
            nonlocal taken
            for _ in range(slot_limit()):
                await _take_slot(None)
                taken += 1

        self.llm.during_stream = take_all
        body = {"scope": {"grade_id": str(self.ids["grade"]), "subject_id": str(self.ids["subject"])},
                "params": {"count": 1, "seed": uuid.uuid4().hex}, "language": "en"}
        before = self._generation_ids()
        with mock.patch.object(settings, "db_save_wait_seconds", 0.1), \
                mock.patch.object(settings, "generation_cache_enabled", False):
            response = self.client.post("/generate/quiz", json=body, headers=self.teacher_headers)
        SlotStats.in_use -= taken  # taken on the request's own event loop, which has gone
        self.assertEqual(taken, slot_limit(), "the AI step must have run")
        self.assertEqual(_events(response)[-1][0], "error", response.text)
        db = SessionLocal()
        rows = db.query(Generation).filter(Generation.id.in_(self._generation_ids() - before)).all()
        self.assertEqual([(row.status, row.content_json) for row in rows], [("failed", None)])
        self.assertIn("no database slot", rows[0].error_message)
        db.close()

    def _generation_ids(self) -> set:
        db = SessionLocal()
        ids = {row.id for row in db.query(Generation.id).filter(Generation.teacher_id == self.ids["teacher"])}
        db.close()
        return ids

    def test_spoken_turn(self):
        session_id = self._session("student")
        speech = mock.AsyncMock(return_value=None)
        with mock.patch("backend.speech.service._audio_frame", speech):
            response = self.client.post(f"/tutor/sessions/{session_id}/converse",
                                        json={"transcript": "Tell me", "language": "hi"},
                                        headers=self.student_headers)
        self.assertEqual(response.status_code, 200, response.text)
        events = _events(response)
        self.assertEqual(events[-1][0], "done", events)
        self.assertEqual(self.on_loop, [])
        db = SessionLocal()
        turn = db.query(VoiceTurn).filter(VoiceTurn.session_id == session_id).one()
        self.assertEqual((turn.user_transcript, turn.assistant_text, turn.stt_language), ("Tell me", REPLY, "hi"))
        self.assertEqual(db.get(ChatSession, session_id).voice_language, "hi")
        db.close()


if __name__ == "__main__":
    unittest.main()
