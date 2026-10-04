"""Daily cover: absences, substitutions, candidates and suggestions
(docs/phase-2/principal_timetable_substitution_architecture.md).

Builds its own school, year, sections, staff and a published timetable for one
Monday, then removes it all. The base timetable must not change when cover is
recorded; that is checked too.
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
    PeriodSubstitution,
    School,
    Subject,
    Teacher,
    TeacherAbsence,
    TeacherSubject,
    TeachingAssignment,
    Timetable,
    TimetableCell,
)
from backend.db.session import SessionLocal

TEST_DATE = date(2026, 10, 5)  # a Monday
DAY = TEST_DATE.isoweekday()


def _phone() -> str:
    return f"+919{uuid.uuid4().int % 10**9:09d}"


class DailyCoverTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.school_ids, cls.teacher_ids, cls.section_ids = [], [], []
        db = SessionLocal()
        db.expire_on_commit = False
        try:
            district_id = db.query(School.district_id).first()[0]
            school = School(name=f"Cover test {uuid.uuid4().hex[:6]}", district_id=district_id)
            db.add(school)
            db.flush()
            cls.school_id = school.id
            cls.school_ids.append(school.id)

            def teacher(name, approved="approved"):
                t = Teacher(school_id=school.id, full_name=name, role="teacher", approval_status=approved, phone_number=_phone())
                db.add(t)
                db.flush()
                cls.teacher_ids.append(t.id)
                return t

            principal = Teacher(school_id=school.id, full_name="Cover Principal", role="principal",
                                approval_status="approved", phone_number=_phone())
            db.add(principal)
            db.flush()
            cls.teacher_ids.append(principal.id)
            cls.principal_id = principal.id

            cls.absent = teacher("Absent Maths").id      # Maths in 9A P1
            cls.busy = teacher("Busy Science").id        # Science in 9B P1
            cls.reserve = teacher("Reserve Ravi").id     # reserve for 9A, teaches nothing
            cls.subject_free = teacher("Maths Mina").id  # teaches Maths, free in P1
            cls.nothing = teacher("Free Fazal").id       # supervision only
            cls.english = teacher("English Esha").id     # English in 9A P2
            cls.not_approved = teacher("Pending Pooja", approved="pending").id

            year = AcademicYear(school_id=school.id, label=f"DC-{uuid.uuid4().hex[:6]}",
                                starts_on=date(2026, 4, 1), ends_on=date(2027, 3, 31), is_current=True)
            db.add(year)
            db.flush()
            cls.year_id = year.id

            g9 = db.query(Grade).filter(Grade.numeric_level == 9).one()
            sec_a = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=g9.id, section="A")
            sec_b = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=g9.id, section="B")
            db.add_all([sec_a, sec_b])
            db.flush()
            cls.sec_a, cls.sec_b = sec_a.id, sec_b.id
            cls.section_ids += [sec_a.id, sec_b.id]
            cls.label_a, cls.label_b = "9 · A", "9 · B"

            maths = db.query(Subject).filter(Subject.name == "Mathematics").one().id
            science = db.query(Subject).filter(Subject.name == "Science").one().id
            english = db.query(Subject).filter(Subject.name == "English").one().id
            cls.maths, cls.science, cls.english_subject = maths, science, english

            db.add_all([
                TeachingAssignment(teacher_id=cls.absent, class_section_id=sec_a.id, subject_id=maths),
                TeachingAssignment(teacher_id=cls.english, class_section_id=sec_a.id, subject_id=english),
                TeachingAssignment(teacher_id=cls.busy, class_section_id=sec_b.id, subject_id=science),
                TeachingAssignment(teacher_id=cls.reserve, class_section_id=sec_a.id, role="reserve"),
                TeacherSubject(teacher_id=cls.subject_free, subject_id=maths, grade_id=g9.id),
                TeacherSubject(teacher_id=cls.busy, subject_id=science, grade_id=g9.id),
            ])
            db.flush()

            p1 = PeriodSlot(school_id=school.id, day_of_week=DAY, period_number=1, label="P1")
            p2 = PeriodSlot(school_id=school.id, day_of_week=DAY, period_number=2, label="P2")
            db.add_all([p1, p2])
            db.flush()
            cls.p1, cls.p2 = p1.id, p2.id

            tt = Timetable(school_id=school.id, academic_year_id=year.id, name="Published", status="published")
            db.add(tt)
            db.flush()
            cls.timetable_id = tt.id
            cells = {
                "a_p1": TimetableCell(timetable_id=tt.id, class_section_id=sec_a.id, period_slot_id=p1.id, subject_id=maths, teacher_id=cls.absent),
                "a_p2": TimetableCell(timetable_id=tt.id, class_section_id=sec_a.id, period_slot_id=p2.id, subject_id=english, teacher_id=cls.english),
                "b_p1": TimetableCell(timetable_id=tt.id, class_section_id=sec_b.id, period_slot_id=p1.id, subject_id=science, teacher_id=cls.busy),
            }
            db.add_all(cells.values())
            db.flush()
            cls.cell_a_p1 = cells["a_p1"].id
            cls.cell_a_p2 = cells["a_p2"].id
            cls.cell_b_p1 = cells["b_p1"].id
            db.commit()
        finally:
            db.close()
        cls.headers = {"Authorization": f"Bearer {create_access_token(cls.principal_id, 'teacher')}"}

    @classmethod
    def tearDownClass(cls):
        db = SessionLocal()
        try:
            for school_id in cls.school_ids:
                db.query(PeriodSubstitution).filter(PeriodSubstitution.school_id == school_id).delete(synchronize_session=False)
                db.query(TeacherAbsence).filter(TeacherAbsence.school_id == school_id).delete(synchronize_session=False)
                db.query(Timetable).filter(Timetable.school_id == school_id).delete(synchronize_session=False)
                db.query(PeriodSlot).filter(PeriodSlot.school_id == school_id).delete(synchronize_session=False)
            db.query(TeachingAssignment).filter(TeachingAssignment.class_section_id.in_(cls.section_ids)).delete(synchronize_session=False)
            db.query(TeacherSubject).filter(TeacherSubject.teacher_id.in_(cls.teacher_ids)).delete(synchronize_session=False)
            db.query(ClassSection).filter(ClassSection.id.in_(cls.section_ids)).delete(synchronize_session=False)
            db.query(AcademicYear).filter(AcademicYear.school_id.in_(cls.school_ids)).delete(synchronize_session=False)
            db.query(Teacher).filter(Teacher.id.in_(cls.teacher_ids)).delete(synchronize_session=False)
            db.query(School).filter(School.id.in_(cls.school_ids)).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    def setUp(self):
        db = SessionLocal()
        try:
            db.query(PeriodSubstitution).filter(PeriodSubstitution.school_id == self.school_id).delete(synchronize_session=False)
            db.query(TeacherAbsence).filter(TeacherAbsence.school_id == self.school_id).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    # --- helpers ---

    def _board(self):
        r = self.client.get(f"/principal/day?date={TEST_DATE.isoformat()}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def _cell(self, board, cell_id):
        return next(c for c in board["cells"] if c["timetable_cell_id"] == str(cell_id))

    def _mark(self, teacher_id, **extra):
        body = {"teacher_id": str(teacher_id), "dates": [TEST_DATE.isoformat()], **extra}
        return self.client.post("/principal/absences", json=body, headers=self.headers)

    def _cover(self, cell_id, substitute=None, action="assign"):
        body = {"date": TEST_DATE.isoformat(), "timetable_cell_id": str(cell_id), "action": action}
        if substitute:
            body["substitute_teacher_id"] = str(substitute)
        return self.client.post("/principal/substitutions", json=body, headers=self.headers)

    def _base_rows(self):
        db = SessionLocal()
        try:
            return sorted(str(c.id) for c in db.query(TimetableCell).filter(TimetableCell.timetable_id == self.timetable_id))
        finally:
            db.close()

    # --- board and absences ---

    def test_marking_a_teacher_absent_turns_only_their_period_red(self):
        self.assertEqual(self._mark(self.absent).status_code, 200)
        board = self._board()
        self.assertEqual(self._cell(board, self.cell_a_p1)["state"], "needs_cover")
        self.assertEqual(self._cell(board, self.cell_b_p1)["state"], "normal")
        self.assertEqual(board["summary"], {"absent_count": 1, "needs_cover": 1, "resolved": 0})
        self.assertIn(str(self.cell_a_p1), board["candidates"])

    def test_the_base_timetable_is_never_changed_by_cover(self):
        before = self._base_rows()
        self._mark(self.absent)
        self._cover(self.cell_a_p1, self.reserve)
        self._cover(self.cell_a_p1, action="self_study")
        self.assertEqual(self._base_rows(), before)
        db = SessionLocal()
        try:
            cell = db.get(TimetableCell, self.cell_a_p1)
            self.assertEqual(cell.teacher_id, self.absent)
        finally:
            db.close()

    def test_partial_absence_only_turns_the_covered_periods_red(self):
        r = self._mark(self.english, is_full_day=False, from_period_number=2, to_period_number=2)
        self.assertEqual(r.status_code, 200, r.text)
        board = self._board()
        self.assertEqual(self._cell(board, self.cell_a_p2)["state"], "needs_cover")
        self.assertEqual(self._cell(board, self.cell_a_p1)["state"], "normal")

    def test_a_partial_absence_needs_a_period_range(self):
        r = self._mark(self.english, is_full_day=False)
        self.assertEqual(r.status_code, 422)

    # --- candidates ---

    def test_candidates_are_ranked_and_unavailable_teachers_say_why(self):
        self._mark(self.absent)
        cands = self.client.get(
            f"/principal/substitutions/candidates?date={TEST_DATE.isoformat()}&timetable_cell_id={self.cell_a_p1}",
            headers=self.headers,
        ).json()
        available = {c["name"]: c for c in cands["available"]}
        unavailable = {u["name"]: u["reason"] for u in cands["unavailable"]}

        self.assertEqual(available["Reserve Ravi"]["tier"], 1)
        self.assertEqual(available["Maths Mina"]["tier"], 2)
        self.assertEqual(available["Free Fazal"]["tier"], 3)
        self.assertEqual(unavailable["Absent Maths"], "Absent today")
        self.assertEqual(unavailable["Busy Science"], f"Teaching {self.label_b} this period")
        self.assertNotIn("Pending Pooja", unavailable)
        self.assertNotIn("Pending Pooja", available)
        order = [c["tier"] for c in cands["available"]]
        self.assertEqual(order, sorted(order))

    def test_a_reserve_teacher_is_listed_first(self):
        self._mark(self.absent)
        cands = self.client.get(
            f"/principal/substitutions/candidates?date={TEST_DATE.isoformat()}&timetable_cell_id={self.cell_a_p1}",
            headers=self.headers,
        ).json()
        self.assertEqual(cands["available"][0]["name"], "Reserve Ravi")

    # --- assigning cover ---

    def test_assigning_a_free_teacher_covers_the_period(self):
        self._mark(self.absent)
        r = self._cover(self.cell_a_p1, self.reserve)
        self.assertEqual(r.status_code, 200, r.text)
        board = self._board()
        cell = self._cell(board, self.cell_a_p1)
        self.assertEqual(cell["state"], "covered")
        self.assertEqual(cell["substitute"]["substitute_teacher_name"], "Reserve Ravi")
        self.assertEqual(board["summary"]["needs_cover"], 0)
        self.assertEqual(board["summary"]["resolved"], 1)

    def test_a_teacher_cannot_cover_two_classes_in_the_same_period(self):
        # two absences in P1, so two cells need cover in the same period
        self._mark(self.absent)
        self._mark(self.busy)
        self.assertEqual(self._cover(self.cell_a_p1, self.reserve).status_code, 200)
        r = self._cover(self.cell_b_p1, self.reserve)
        self.assertEqual(r.status_code, 422)
        self.assertIn("Already covering", r.json()["detail"])

    def test_the_database_refuses_a_second_cover_in_the_same_period(self):
        self._mark(self.absent)
        self.assertEqual(self._cover(self.cell_a_p1, self.reserve).status_code, 200)
        db = SessionLocal()
        try:
            db.add(PeriodSubstitution(
                school_id=self.school_id, date=TEST_DATE, timetable_cell_id=self.cell_b_p1,
                class_section_id=self.sec_b, period_slot_id=self.p1, subject_id=self.science,
                original_teacher_id=self.busy, substitute_teacher_id=self.reserve, status="assigned",
            ))
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.rollback()
            db.close()

    def test_a_teacher_who_is_not_absent_cannot_be_covered_for(self):
        r = self._cover(self.cell_b_p1, self.reserve)
        self.assertEqual(r.status_code, 422)
        self.assertIn("isn't absent", r.json()["detail"])

    def test_self_study_is_a_resolved_state_and_can_be_cleared(self):
        self._mark(self.absent)
        r = self._cover(self.cell_a_p1, action="self_study")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self._cell(self._board(), self.cell_a_p1)["state"], "self_study")
        self.assertEqual(self._board()["summary"]["needs_cover"], 0)

        sub_id = r.json()["id"]
        self.assertEqual(self.client.delete(f"/principal/substitutions/{sub_id}", headers=self.headers).status_code, 204)
        self.assertEqual(self._cell(self._board(), self.cell_a_p1)["state"], "needs_cover")

    # --- releasing ---

    def test_a_substitute_who_becomes_absent_releases_their_cover(self):
        self._mark(self.absent)
        self._cover(self.cell_a_p1, self.reserve)
        r = self._mark(self.reserve)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["released"], 1)
        self.assertEqual(self._cell(self._board(), self.cell_a_p1)["state"], "needs_cover")

    def test_unmarking_an_absence_with_cover_needs_confirmation(self):
        absence_id = self._mark(self.absent).json()["absences"][0]["id"]
        self._cover(self.cell_a_p1, self.reserve)

        r = self.client.delete(f"/principal/absences/{absence_id}", headers=self.headers)
        self.assertEqual(r.status_code, 409)
        self.assertIn("already have cover", r.json()["detail"])

        r = self.client.delete(f"/principal/absences/{absence_id}?force=true", headers=self.headers)
        self.assertEqual(r.status_code, 204)
        board = self._board()
        self.assertEqual(self._cell(board, self.cell_a_p1)["state"], "normal")
        self.assertEqual(board["summary"]["absent_count"], 0)

    # --- bulk and suggestions ---

    def test_a_bulk_proposal_is_all_or_nothing(self):
        self._mark(self.absent)
        self._mark(self.busy)
        body = {
            "date": TEST_DATE.isoformat(),
            "items": [
                {"date": TEST_DATE.isoformat(), "timetable_cell_id": str(self.cell_a_p1), "action": "assign", "substitute_teacher_id": str(self.reserve)},
                {"date": TEST_DATE.isoformat(), "timetable_cell_id": str(self.cell_b_p1), "action": "assign", "substitute_teacher_id": str(self.nothing)},
            ],
        }
        # the second item is valid only if Fazal is free: he is, so make it fail on purpose
        body["items"][1]["substitute_teacher_id"] = str(self.absent)
        r = self.client.post("/principal/substitutions/bulk", json=body, headers=self.headers)
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self._board()["summary"]["resolved"], 0)

    def test_suggest_all_proposes_without_committing_and_never_double_books(self):
        self._mark(self.absent)
        self._mark(self.busy)
        before = self._board()["summary"]
        r = self.client.post(f"/principal/substitutions/suggest?date={TEST_DATE.isoformat()}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        items = r.json()["items"]
        self.assertEqual(len(items), 2)
        self.assertEqual(self._board()["summary"], before)  # nothing was saved

        chosen = [(i["substitute_teacher_id"], i["period_slot_id"]) for i in items if i["substitute_teacher_id"]]
        self.assertEqual(len(chosen), len(set(chosen)))

    def test_nobody_free_is_reported_in_the_proposal(self):
        self._mark(self.absent)
        # nobody is free in P1: the rest of the staff is absent, or teaching it
        for tid in (self.reserve, self.subject_free, self.nothing, self.english):
            self._mark(tid)
        items = self.client.post(f"/principal/substitutions/suggest?date={TEST_DATE.isoformat()}", headers=self.headers).json()["items"]
        self.assertEqual(items[0]["substitute_teacher_id"], None)
        self.assertIn("Nobody is free", items[0]["reason"])

    # --- reserve teachers and the primary rule ---

    def test_reserve_teachers_are_managed_per_class(self):
        sec = str(self.sec_a)
        r = self.client.get(f"/principal/sections/{sec}/reserve-teachers", headers=self.headers)
        self.assertEqual([x["full_name"] for x in r.json()], ["Reserve Ravi"])

        r = self.client.post(f"/principal/sections/{sec}/reserve-teachers", json={"teacher_id": str(self.nothing)}, headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("Free Fazal", [x["full_name"] for x in r.json()])

        r = self.client.post(f"/principal/sections/{sec}/reserve-teachers", json={"teacher_id": str(self.nothing)}, headers=self.headers)
        self.assertEqual(r.status_code, 409)

        r = self.client.post(f"/principal/sections/{sec}/reserve-teachers", json={"teacher_id": str(self.not_approved)}, headers=self.headers)
        self.assertEqual(r.status_code, 404)

        r = self.client.delete(f"/principal/sections/{sec}/reserve-teachers/{self.nothing}", headers=self.headers)
        self.assertNotIn("Free Fazal", [x["full_name"] for x in r.json()])

    def test_a_reserve_is_not_a_subject_teacher_and_gets_no_section_access(self):
        subjects = self.client.get(f"/principal/sections/{self.sec_a}/teaching-assignments", headers=self.headers).json()
        self.assertNotIn("Reserve Ravi", [a["teacher_name"] for a in subjects])

        from backend.core.section_access import teacher_section_ids

        db = SessionLocal()
        try:
            reserve = db.get(Teacher, self.reserve)
            self.assertNotIn(self.sec_a, teacher_section_ids(db, reserve))
        finally:
            db.close()

    def test_other_schools_teachers_cannot_be_absent_here(self):
        r = self.client.post("/principal/absences", json={"teacher_id": str(self.not_approved), "dates": [TEST_DATE.isoformat()]}, headers=self.headers)
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
