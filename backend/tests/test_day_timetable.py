"""The final timetable for a day (teachers' board).

Finalizing is refused while a period still needs cover. Once the day is
finalized, teachers read a snapshot that doesn't move when the cover changes
later, and the principal sees that the snapshot is out of date until they
finalize again.

Builds its own school and published timetable for one Monday, then removes it.
"""

import os
import sys
import unittest
import uuid
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient

from backend.app import app
from backend.auth.jwt import create_access_token
from backend.db.models import (
    AcademicYear,
    ClassSection,
    DailyTimetable,
    Grade,
    PeriodSlot,
    PeriodSubstitution,
    School,
    Subject,
    Teacher,
    TeacherAbsence,
    TeachingAssignment,
    Timetable,
    TimetableCell,
)
from backend.db.session import SessionLocal

TEST_DATE = date(2026, 10, 5)  # Monday
DAY = TEST_DATE.isoweekday()


def _phone() -> str:
    return f"+919{uuid.uuid4().int % 10**9:09d}"


class DayTimetableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        db = SessionLocal()
        db.expire_on_commit = False
        try:
            district_id = db.query(School.district_id).first()[0]
            school = School(name=f"Day board test {uuid.uuid4().hex[:6]}", district_id=district_id)
            db.add(school)
            db.flush()
            cls.school_id = school.id

            def staff(name, role="teacher"):
                t = Teacher(school_id=school.id, full_name=name, role=role, approval_status="approved", phone_number=_phone())
                db.add(t)
                db.flush()
                return t

            principal = staff("Board Principal", role="principal")
            cls.absent = staff("Board Absent")
            cls.cover = staff("Board Cover")
            cls.principal_id = principal.id
            cls.absent_id, cls.cover_id = cls.absent.id, cls.cover.id

            year = AcademicYear(school_id=school.id, label=f"DB-{uuid.uuid4().hex[:6]}",
                                starts_on=date(2026, 4, 1), ends_on=date(2027, 3, 31), is_current=True)
            db.add(year)
            db.flush()
            grade = db.query(Grade).filter(Grade.numeric_level == 9).one()
            section = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=grade.id, section="A")
            db.add(section)
            db.flush()
            cls.section_id = section.id
            maths = db.query(Subject).filter(Subject.name == "Mathematics").one().id
            db.add(TeachingAssignment(teacher_id=cls.absent.id, class_section_id=section.id, subject_id=maths))

            slot = PeriodSlot(school_id=school.id, day_of_week=DAY, period_number=1, label="P1")
            db.add(slot)
            db.flush()
            cls.slot_id = slot.id

            tt = Timetable(school_id=school.id, academic_year_id=year.id, name="Published", status="published")
            db.add(tt)
            db.flush()
            cls.timetable_id = tt.id
            cell = TimetableCell(timetable_id=tt.id, class_section_id=section.id, period_slot_id=slot.id,
                                 subject_id=maths, teacher_id=cls.absent.id)
            db.add(cell)
            db.flush()
            cls.cell_id = cell.id
            cls.school_ids = [school.id]
            cls.teacher_ids = [principal.id, cls.absent.id, cls.cover.id]
            cls.year_id = year.id
            cls.section_ids = [section.id]
            db.commit()
        finally:
            db.close()
        cls.principal_headers = {"Authorization": f"Bearer {create_access_token(cls.principal_id, 'teacher')}"}
        cls.cover_headers = {"Authorization": f"Bearer {create_access_token(cls.cover_id, 'teacher')}"}

    @classmethod
    def tearDownClass(cls):
        db = SessionLocal()
        try:
            db.query(DailyTimetable).filter(DailyTimetable.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(PeriodSubstitution).filter(PeriodSubstitution.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(TeacherAbsence).filter(TeacherAbsence.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(Timetable).filter(Timetable.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(PeriodSlot).filter(PeriodSlot.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(TeachingAssignment).filter(TeachingAssignment.class_section_id.in_(cls.section_ids)).delete(synchronize_session=False)
            db.query(ClassSection).filter(ClassSection.id.in_(cls.section_ids)).delete(synchronize_session=False)
            db.query(AcademicYear).filter(AcademicYear.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(Teacher).filter(Teacher.id.in_(cls.teacher_ids)).delete(synchronize_session=False)
            db.query(School).filter(School.id == cls.school_id).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    def setUp(self):
        db = SessionLocal()
        try:
            db.query(DailyTimetable).filter(DailyTimetable.school_id == self.school_id).delete(synchronize_session=False)
            db.query(PeriodSubstitution).filter(PeriodSubstitution.school_id == self.school_id).delete(synchronize_session=False)
            db.query(TeacherAbsence).filter(TeacherAbsence.school_id == self.school_id).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
        # the absence the tests start from
        self.client.post(
            "/principal/absences",
            json={"teacher_id": str(self.absent_id), "dates": [TEST_DATE.isoformat()]},
            headers=self.principal_headers,
        )

    def _finalize(self):
        return self.client.post(f"/principal/day/finalize?date={TEST_DATE.isoformat()}", headers=self.principal_headers)

    def _teacher_day(self, headers=None):
        return self.client.get(f"/day-timetable?date={TEST_DATE.isoformat()}", headers=headers or self.cover_headers)

    def _cover(self, action="assign", substitute=None):
        body = {"date": TEST_DATE.isoformat(), "timetable_cell_id": str(self.cell_id), "action": action}
        if substitute:
            body["substitute_teacher_id"] = str(substitute)
        return self.client.post("/principal/substitutions", json=body, headers=self.principal_headers)

    def test_finalizing_is_refused_while_a_period_needs_cover(self):
        r = self._finalize()
        self.assertEqual(r.status_code, 422, r.text)
        self.assertIn("still needs cover", r.json()["detail"])
        self.assertFalse(self._teacher_day().json()["finalized"])

    def test_once_covered_the_day_can_be_finalized_and_teachers_see_the_cover(self):
        self.assertEqual(self._cover(substitute=self.cover_id).status_code, 200)
        r = self._finalize()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["finalized"])
        self.assertTrue(r.json()["up_to_date"])

        day = self._teacher_day().json()
        self.assertTrue(day["finalized"])
        cell = day["payload"]["cells"][0]
        self.assertEqual(cell["state"], "covered")
        self.assertEqual(cell["teacher_id"], str(self.cover_id))
        self.assertEqual(cell["base_teacher_name"], "Board Absent")

    def test_self_study_counts_as_resolved_and_nobody_teaches_it(self):
        self.assertEqual(self._cover(action="self_study").status_code, 200)
        self.assertEqual(self._finalize().status_code, 200)
        cell = self._teacher_day().json()["payload"]["cells"][0]
        self.assertEqual(cell["state"], "self_study")
        self.assertIsNone(cell["teacher_id"])

    def test_teachers_keep_the_snapshot_until_the_principal_finalizes_again(self):
        self._cover(substitute=self.cover_id)
        self._finalize()
        self.assertEqual(self._teacher_day().json()["payload"]["cells"][0]["state"], "covered")

        # the cover changes after finalizing: the teachers' board doesn't move
        self.client.delete(
            f"/principal/substitutions/{self._sub_id()}", headers=self.principal_headers
        )
        status = self.client.get(f"/principal/day/final?date={TEST_DATE.isoformat()}", headers=self.principal_headers).json()
        self.assertFalse(status["up_to_date"])
        self.assertEqual(self._teacher_day().json()["payload"]["cells"][0]["state"], "covered")

        # the principal covers again and finalizes: now the teachers see the new version
        self._cover(action="self_study")
        r = self._finalize()
        self.assertEqual(r.json()["version"], 2)
        self.assertTrue(r.json()["up_to_date"])
        self.assertEqual(self._teacher_day().json()["payload"]["cells"][0]["state"], "self_study")

    def _sub_id(self):
        db = SessionLocal()
        try:
            return str(db.query(PeriodSubstitution.id).filter(PeriodSubstitution.school_id == self.school_id).first()[0])
        finally:
            db.close()

    def test_a_school_with_no_final_day_says_so(self):
        r = self._teacher_day()
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["finalized"])
        self.assertIsNone(r.json()["payload"])

    def test_the_board_needs_a_signed_in_staff_member(self):
        r = self.client.get(f"/day-timetable?date={TEST_DATE.isoformat()}")
        self.assertEqual(r.status_code, 401)


if __name__ == "__main__":
    unittest.main()
