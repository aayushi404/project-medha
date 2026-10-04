"""Principal's timetable planner (docs/phase-2/principal_timetable_planner.md).

Builds its own school, year, sections and staff, then removes them. Nothing
here touches the real school's data.

Covers the rules the screen relies on: the one-place-per-period rule (checked
in the API with readable messages, and in the database as a backstop), the
day-version check, breaks, copy-from-day, publish archiving the old timetable,
the read-only published timetable, and access by school and role.
"""

import os
import sys
import unittest
import uuid
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from backend.app import app
from backend.auth.jwt import create_access_token
from backend.db.models import (
    AcademicYear,
    ClassSection,
    Grade,
    PeriodSlot,
    School,
    Subject,
    Teacher,
    TeacherSubject,
    TeachingAssignment,
    Timetable,
    TimetableCell,
)
from backend.db.session import SessionLocal


def _fresh_phone() -> str:
    return f"+919{uuid.uuid4().int % 10**9:09d}"


def _headers(actor_id: uuid.UUID, actor_type: str = "teacher") -> dict:
    return {"Authorization": f"Bearer {create_access_token(actor_id, actor_type)}"}


def _slot(number: int, start: str, end: str, is_break: bool = False) -> dict:
    slot = {"period_number": number, "label": f"P{number}" if not is_break else "Lunch", "is_break": is_break}
    if not is_break:
        slot["starts_at"] = start
        slot["ends_at"] = end
    return slot


class TimetablePlannerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.school_ids: list[uuid.UUID] = []
        cls.teacher_ids: list[uuid.UUID] = []
        cls.year_ids: list[uuid.UUID] = []
        cls.section_ids: list[uuid.UUID] = []
        cls.assignment_ids: list[uuid.UUID] = []
        cls.subject_ids_used: list[uuid.UUID] = []
        cls.timetable_ids: list[uuid.UUID] = []

        db = SessionLocal()
        db.expire_on_commit = False
        try:
            district_id = db.query(School.district_id).first()[0]
            school = School(name=f"Planner test {uuid.uuid4().hex[:6]}", district_id=district_id)
            db.add(school)
            db.flush()
            cls.school_id = school.id
            cls.school_ids.append(school.id)

            principal = Teacher(
                school_id=school.id, full_name="Planner Principal", role="principal",
                approval_status="approved", phone_number=_fresh_phone(),
            )
            cls.anita = Teacher(
                school_id=school.id, full_name="Aarti Planner", role="teacher",
                approval_status="approved", phone_number=_fresh_phone(),
            )
            cls.ravi = Teacher(
                school_id=school.id, full_name="Ravi Planner", role="teacher",
                approval_status="approved", phone_number=_fresh_phone(),
            )
            cls.pending = Teacher(
                school_id=school.id, full_name="Not Yet Approved", role="teacher",
                approval_status="pending", phone_number=_fresh_phone(),
            )
            db.add_all([principal, cls.anita, cls.ravi, cls.pending])
            db.flush()
            cls.principal_id = principal.id
            cls.teacher_ids += [principal.id, cls.anita.id, cls.ravi.id, cls.pending.id]

            # A second school, for the cross-school check
            other_school = School(name=f"Other planner {uuid.uuid4().hex[:6]}", district_id=district_id)
            db.add(other_school)
            db.flush()
            cls.school_ids.append(other_school.id)
            other_principal = Teacher(
                school_id=other_school.id, full_name="Other Principal", role="principal",
                approval_status="approved", phone_number=_fresh_phone(),
            )
            db.add(other_principal)
            db.flush()
            cls.teacher_ids.append(other_principal.id)
            cls.other_principal_id = other_principal.id

            year = AcademicYear(
                school_id=school.id, label=f"T-{uuid.uuid4().hex[:6]}",
                starts_on=date(2026, 4, 1), ends_on=date(2027, 3, 31), is_current=True,
            )
            db.add(year)
            db.flush()
            cls.year_ids.append(year.id)

            grade9 = db.query(Grade).filter(Grade.numeric_level == 9).one()
            grade10 = db.query(Grade).filter(Grade.numeric_level == 10).one()
            sec_9a = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=grade9.id, section="A")
            sec_10a = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=grade10.id, section="A")
            db.add_all([sec_9a, sec_10a])
            db.flush()
            cls.sec_9a = sec_9a.id
            cls.sec_10a = sec_10a.id
            cls.section_ids += [sec_9a.id, sec_10a.id]

            cls.maths = db.query(Subject).filter(Subject.name == "Mathematics").one().id
            cls.science = db.query(Subject).filter(Subject.name == "Science").one().id
            cls.english = db.query(Subject).filter(Subject.name == "English").one().id

            # Anita is assigned Maths to 9A. Ravi teaches Science at Grade 9 but
            # has no assignment to 9A, so he is the "qualified" tier.
            assignment = TeachingAssignment(teacher_id=cls.anita.id, class_section_id=sec_9a.id, subject_id=cls.maths)
            db.add(assignment)
            db.flush()
            cls.assignment_ids.append(assignment.id)
            db.add(TeacherSubject(teacher_id=cls.ravi.id, subject_id=cls.science, grade_id=grade9.id))
            db.add(TeacherSubject(teacher_id=cls.anita.id, subject_id=cls.maths, grade_id=grade9.id))
            # Ravi also teaches English to 10A, so the 10A English row is assigned.
            db.add(TeachingAssignment(teacher_id=cls.ravi.id, class_section_id=sec_10a.id, subject_id=cls.english))
            db.flush()

            # Monday: P1, P2 and a lunch break at P3. Tuesday: P1 only.
            db.add_all([
                PeriodSlot(school_id=school.id, day_of_week=1, period_number=1, label="P1",
                           starts_at=None, ends_at=None, is_break=False),
                PeriodSlot(school_id=school.id, day_of_week=1, period_number=2, label="P2",
                           starts_at=None, ends_at=None, is_break=False),
                PeriodSlot(school_id=school.id, day_of_week=1, period_number=3, label="Lunch",
                           starts_at=None, ends_at=None, is_break=True),
                PeriodSlot(school_id=school.id, day_of_week=2, period_number=1, label="P1",
                           starts_at=None, ends_at=None, is_break=False),
            ])
            db.commit()
        finally:
            db.close()

        cls.principal_headers = _headers(cls.principal_id, "teacher")

    @classmethod
    def tearDownClass(cls):
        db = SessionLocal()
        try:
            if cls.timetable_ids:
                db.query(Timetable).filter(Timetable.id.in_(cls.timetable_ids)).delete(synchronize_session=False)
            for school_id in cls.school_ids:
                db.query(Timetable).filter(Timetable.school_id == school_id).delete(synchronize_session=False)
                db.query(PeriodSlot).filter(PeriodSlot.school_id == school_id).delete(synchronize_session=False)
            if cls.assignment_ids:
                db.query(TeachingAssignment).filter(TeachingAssignment.id.in_(cls.assignment_ids)).delete(synchronize_session=False)
            if cls.teacher_ids:
                db.query(TeacherSubject).filter(TeacherSubject.teacher_id.in_(cls.teacher_ids)).delete(synchronize_session=False)
            if cls.section_ids:
                db.query(TeachingAssignment).filter(TeachingAssignment.class_section_id.in_(cls.section_ids)).delete(synchronize_session=False)
                db.query(ClassSection).filter(ClassSection.id.in_(cls.section_ids)).delete(synchronize_session=False)
            if cls.year_ids:
                db.query(AcademicYear).filter(AcademicYear.id.in_(cls.year_ids)).delete(synchronize_session=False)
                db.query(Teacher).filter(Teacher.id.in_(cls.teacher_ids)).delete(synchronize_session=False)
            if cls.school_ids:
                db.query(School).filter(School.id.in_(cls.school_ids)).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    # --- helpers ---

    def _set_day(self, day: int, slots: list[dict]) -> None:
        r = self.client.put(f"/principal/period-slots?day={day}", json={"slots": slots}, headers=self.principal_headers)
        self.assertEqual(r.status_code, 200, r.text)

    def _new_timetable(self, name: str = "Main") -> dict:
        r = self.client.post("/principal/timetables", json={"name": name}, headers=self.principal_headers)
        self.assertEqual(r.status_code, 201, r.text)
        self.timetable_ids.append(uuid.UUID(r.json()["id"]))
        return r.json()

    def _grid(self, timetable_id: str, day: int) -> dict:
        r = self.client.get(f"/principal/timetables/{timetable_id}/grid?day={day}", headers=self.principal_headers)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def _save(self, timetable_id: str, day: int, version: int, cells: list[dict]):
        return self.client.put(
            f"/principal/timetables/{timetable_id}/days/{day}",
            json={"version": version, "cells": cells},
            headers=self.principal_headers,
        )

    def _cell(self, section, slot, subject, teacher=None) -> dict:
        return {
            "class_section_id": str(section),
            "period_slot_id": slot,
            "subject_id": str(subject),
            "teacher_id": str(teacher) if teacher else None,
        }

    def _slot_id(self, day: int, number: int) -> str:
        grid = self._grid_any_timetable_slots(day)
        return next(s["id"] for s in grid if s["period_number"] == number)

    def _grid_any_timetable_slots(self, day: int) -> list[dict]:
        r = self.client.get(f"/principal/period-slots?day={day}", headers=self.principal_headers)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    # --- period slots ---

    def test_period_slots_round_trip_and_duplicate_numbers_are_refused(self):
        self._set_day(1, [_slot(1, "08:00", "08:45"), _slot(2, "08:45", "09:30"), _slot(3, "", "", True)])
        r = self.client.get("/principal/period-slots?day=1", headers=self.principal_headers)
        self.assertEqual([s["period_number"] for s in r.json()], [1, 2, 3])
        self.assertTrue(r.json()[2]["is_break"])

        dup = self.client.put(
            "/principal/period-slots?day=1",
            json={"slots": [_slot(1, "08:00", "08:45"), _slot(1, "08:45", "09:30")]},
            headers=self.principal_headers,
        )
        self.assertEqual(dup.status_code, 422)

    def test_a_period_must_end_after_it_starts(self):
        r = self.client.put(
            "/principal/period-slots?day=5",
            json={"slots": [_slot(1, "09:00", "08:00")]},
            headers=self.principal_headers,
        )
        self.assertEqual(r.status_code, 422)

    def test_copying_a_day_structure_creates_the_other_days(self):
        r = self.client.post(
            "/principal/period-slots/copy",
            json={"from_day": 1, "to_days": [4]},
            headers=self.principal_headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {"copied_to": [4]})
        copied = self.client.get("/principal/period-slots?day=4", headers=self.principal_headers).json()
        self.assertEqual([s["period_number"] for s in copied], [1, 2, 3])

    # --- timetable and grid ---

    def test_new_timetable_starts_empty_and_lists_eligible_teachers_in_tiers(self):
        tt = self._new_timetable("Tiers")
        grid = self._grid(tt["id"], 1)
        self.assertTrue(grid["editable"])
        self.assertEqual(grid["cells"], [])
        self.assertIn("9 · A", [s["label"] for s in grid["class_sections"]])

        key = f"{self.sec_9a}:{self.maths}"
        names = {t["name"]: t["tier"] for t in grid["eligible_teachers"][key]}
        self.assertEqual(names, {"Aarti Planner": "assigned"})
        science_key = f"{self.sec_9a}:{self.science}"
        self.assertEqual(
            {t["name"]: t["tier"] for t in grid["eligible_teachers"][science_key]},
            {"Ravi Planner": "qualified"},
        )
        self.assertNotIn("Not Yet Approved", str(grid["eligible_teachers"]))

    def test_a_saved_day_is_returned_with_workload_and_bumps_the_version(self):
        tt = self._new_timetable("Save")
        p1, p2 = self._slot_id(1, 1), self._slot_id(1, 2)
        r = self._save(tt["id"], 1, 1, [
            self._cell(self.sec_9a, p1, self.maths, self.anita.id),
            self._cell(self.sec_10a, p1, self.english, self.ravi.id),
            self._cell(self.sec_9a, p2, self.science),  # no teacher yet
        ])
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["version"], 2)
        self.assertEqual(len(body["cells"]), 3)

        maths = next(
            t for t in body["eligible_teachers"][f"{self.sec_9a}:{self.maths}"] if t["name"] == "Aarti Planner"
        )
        self.assertEqual(maths["periods_today"], 1)
        self.assertEqual(maths["periods_week"], 1)

    def test_a_stale_version_is_refused_with_409(self):
        tt = self._new_timetable("Stale")
        first = self._save(tt["id"], 1, 1, [self._cell(self.sec_9a, self._slot_id(1, 1), self.maths)])
        self.assertEqual(first.status_code, 200)
        stale = self._save(tt["id"], 1, 1, [])
        self.assertEqual(stale.status_code, 409)
        self.assertIn("another tab", stale.json()["detail"])

    def test_one_teacher_in_two_sections_in_the_same_period_is_refused_with_both_names(self):
        tt = self._new_timetable("Clash")
        p1 = self._slot_id(1, 1)
        r = self._save(tt["id"], 1, 1, [
            self._cell(self.sec_9a, p1, self.maths, self.anita.id),
            self._cell(self.sec_10a, p1, self.maths, self.anita.id),
        ])
        self.assertEqual(r.status_code, 422)
        detail = r.json()["detail"]
        self.assertIn("Aarti Planner", detail)
        self.assertIn("9 · A", detail)
        self.assertIn("10 · A", detail)

    def test_the_database_refuses_a_teacher_in_two_places_even_without_the_api(self):
        tt = self._new_timetable("Backstop")
        p1 = uuid.UUID(self._slot_id(1, 1))
        db = SessionLocal()
        try:
            db.add(TimetableCell(timetable_id=uuid.UUID(tt["id"]), class_section_id=self.sec_9a,
                                 period_slot_id=p1, subject_id=self.maths, teacher_id=self.anita.id))
            db.add(TimetableCell(timetable_id=uuid.UUID(tt["id"]), class_section_id=self.sec_10a,
                                 period_slot_id=p1, subject_id=self.maths, teacher_id=self.anita.id))
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.rollback()
            db.close()

    def test_a_section_cannot_have_two_subjects_in_one_period(self):
        tt = self._new_timetable("Twice")
        p1 = self._slot_id(1, 1)
        r = self._save(tt["id"], 1, 1, [
            self._cell(self.sec_9a, p1, self.maths),
            self._cell(self.sec_9a, p1, self.science),
        ])
        self.assertEqual(r.status_code, 422)

    def test_a_break_period_holds_no_cells(self):
        tt = self._new_timetable("Break")
        lunch = self._slot_id(1, 3)
        r = self._save(tt["id"], 1, 1, [self._cell(self.sec_9a, lunch, self.maths)])
        self.assertEqual(r.status_code, 422)
        self.assertIn("break", r.json()["detail"])

    def test_copying_from_another_day_skips_periods_the_target_day_lacks(self):
        tt = self._new_timetable("Copy")
        p1, p2 = self._slot_id(1, 1), self._slot_id(1, 2)
        saved = self._save(tt["id"], 1, 1, [
            self._cell(self.sec_9a, p1, self.maths, self.anita.id),
            self._cell(self.sec_9a, p2, self.science),
        ])
        self.assertEqual(saved.status_code, 200, saved.text)

        r = self.client.post(
            f"/principal/timetables/{tt['id']}/days/2/copy-from/1",
            json={"version": 2},
            headers=self.principal_headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["copied"], 1)
        self.assertEqual(r.json()["skipped"], 1)
        self.assertEqual(len(r.json()["grid"]["cells"]), 1)

    def test_validation_lists_empty_periods_and_cells_without_a_teacher(self):
        tt = self._new_timetable("Validate")
        p1 = self._slot_id(1, 1)
        self._save(tt["id"], 1, 1, [self._cell(self.sec_9a, p1, self.science)])
        r = self.client.get(f"/principal/timetables/{tt['id']}/validate", headers=self.principal_headers)
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(len(body["no_teacher"]), 1)
        self.assertEqual(body["no_teacher"][0]["class_label"], "9 · A")
        # 10 · A has no cell in P1 on Monday, so it's an empty period
        self.assertTrue(any(e["class_label"] == "10 · A" and e["day_of_week"] == 1 for e in body["empty_slots"]))

    def test_publishing_archives_the_timetable_it_replaces_and_locks_it(self):
        first = self._new_timetable("First")
        p1 = self._slot_id(1, 1)
        self._save(first["id"], 1, 1, [self._cell(self.sec_9a, p1, self.maths, self.anita.id)])
        pub1 = self.client.post(
            f"/principal/timetables/{first['id']}/publish", json={"version": 2}, headers=self.principal_headers
        )
        self.assertEqual(pub1.status_code, 200, pub1.text)
        self.assertEqual(pub1.json()["status"], "published")

        locked = self._save(first["id"], 1, 3, [])
        self.assertEqual(locked.status_code, 409)
        self.assertIn("read-only", locked.json()["detail"])

        second = self._new_timetable("Revision")
        copied = self.client.post(
            "/principal/timetables",
            json={"name": "Revision 2", "copy_from_id": first["id"]},
            headers=self.principal_headers,
        )
        self.assertEqual(copied.status_code, 201, copied.text)
        self.timetable_ids.append(uuid.UUID(copied.json()["id"]))
        self.assertEqual(len(self._grid(copied.json()["id"], 1)["cells"]), 1)

        pub2 = self.client.post(
            f"/principal/timetables/{second['id']}/publish", json={"version": 1}, headers=self.principal_headers
        )
        self.assertEqual(pub2.status_code, 200, pub2.text)
        listing = {t["id"]: t["status"] for t in self.client.get(
            "/principal/timetables", headers=self.principal_headers).json()}
        self.assertEqual(listing[first["id"]], "archived")
        self.assertEqual(listing[second["id"]], "published")

    def test_another_schools_timetable_is_not_found(self):
        tt = self._new_timetable("Mine")
        r = self.client.get(
            f"/principal/timetables/{tt['id']}/grid?day=1",
            headers=_headers(self.other_principal_id, "teacher"),
        )
        self.assertEqual(r.status_code, 404)

    def test_teachers_cannot_use_the_planner(self):
        r = self.client.get("/principal/timetables", headers=_headers(self.anita.id, "teacher"))
        self.assertIn(r.status_code, (401, 403))
        r = self.client.get("/principal/period-slots?day=1", headers=_headers(self.anita.id, "teacher"))
        self.assertIn(r.status_code, (401, 403))


if __name__ == "__main__":
    unittest.main()
