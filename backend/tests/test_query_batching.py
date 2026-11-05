"""List and bulk endpoints must return the same results with a query count that does not
grow per row. Needs Postgres, like the other API tests, and cleans up after itself."""

import os
import sys
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event  # noqa: E402

from backend.app import app  # noqa: E402
from backend.auth.jwt import create_access_token  # noqa: E402
from backend.db.models import (  # noqa: E402
    AcademicYear,
    AttendanceRecord,
    ClassSection,
    District,
    Grade,
    Homework,
    HomeworkStatus,
    ReportCardMark,
    School,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    TeachingAssignment,
)
from backend.db.session import SessionLocal, engine  # noqa: E402

HOMEWORK_COUNT = 12
ROSTER_SIZE = 10


def _phone(prefix: int) -> str:
    return f"+91{prefix}{uuid.uuid4().int % 10**9:09d}"


class _CountQueries:
    def __enter__(self):
        self.count = 0
        event.listen(engine, "before_cursor_execute", self._on_query)
        return self

    def _on_query(self, *_args):
        self.count += 1

    def __exit__(self, *_exc):
        event.remove(engine, "before_cursor_execute", self._on_query)


class QueryBatchingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        db = SessionLocal()
        tag = uuid.uuid4().hex[:8]
        grade = db.query(Grade).order_by(Grade.numeric_level).first()
        subject = db.query(Subject).first()
        if grade is None or subject is None:
            db.close()
            raise unittest.SkipTest("needs seeded grades and subjects: run scripts/seed_phase0.py")
        district = District(name=f"QB {tag}", state="Bihar")
        db.add(district)
        db.flush()
        school = School(name=f"QB School {tag}", district_id=district.id)
        db.add(school)
        db.flush()
        today = date.today()
        year = AcademicYear(school_id=school.id, label=f"QB-{tag}", starts_on=today - timedelta(days=90),
                            ends_on=today + timedelta(days=200), is_current=True)
        teacher = Teacher(school_id=school.id, full_name="QB Teacher", phone_number=_phone(6), role="teacher",
                          approval_status="approved")
        db.add_all([year, teacher])
        db.flush()
        section = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=grade.id, section="A",
                               class_teacher_id=teacher.id)
        db.add(section)
        db.flush()
        db.add(TeachingAssignment(teacher_id=teacher.id, class_section_id=section.id, subject_id=subject.id,
                                  role="primary"))
        students = []
        for roll in range(1, ROSTER_SIZE + 1):
            student = Student(school_id=school.id, full_name=f"QB Student {roll}", phone_number=_phone(7),
                              approval_status="approved", password_hash="x")
            db.add(student)
            db.flush()
            db.add(StudentEnrollment(student_id=student.id, class_section_id=section.id,
                                     academic_year_id=year.id, roll_number=roll))
            students.append(student)
        homework = []
        for n in range(HOMEWORK_COUNT):
            item = Homework(teacher_id=teacher.id, school_id=school.id, class_section_id=section.id,
                            subject_id=subject.id, title=f"HW {n}",
                            created_at=datetime.now(timezone.utc) - timedelta(days=n))
            db.add(item)
            db.flush()
            homework.append(item)
        # The first student finished homework 0 and 1, and un-finished homework 2.
        db.add_all([
            HomeworkStatus(homework_id=homework[0].id, student_id=students[0].id, done=True),
            HomeworkStatus(homework_id=homework[1].id, student_id=students[0].id, done=True),
            HomeworkStatus(homework_id=homework[2].id, student_id=students[0].id, done=False),
            HomeworkStatus(homework_id=homework[0].id, student_id=students[1].id, done=True),
        ])
        db.add_all([
            AttendanceRecord(student_id=students[0].id, marked_by_teacher_id=teacher.id, status="present",
                             attendance_date=today - timedelta(days=n))
            for n in range(1, 6)
        ])
        db.commit()
        cls.ids = {
            "district": district.id, "school": school.id, "year": year.id, "teacher": teacher.id,
            "section": section.id, "subject": subject.id,
            "students": [s.id for s in students], "homework": [h.id for h in homework],
        }
        db.close()
        cls.teacher_headers = {"Authorization": f"Bearer {create_access_token(cls.ids['teacher'])}"}
        cls.student_headers = {"Authorization": f"Bearer {create_access_token(cls.ids['students'][0], 'student')}"}

    @classmethod
    def tearDownClass(cls):
        # Children first: most of these foreign keys do not cascade.
        ids = cls.ids
        db = SessionLocal()
        db.query(HomeworkStatus).filter(HomeworkStatus.homework_id.in_(ids["homework"])).delete()
        db.query(Homework).filter(Homework.id.in_(ids["homework"])).delete()
        db.query(AttendanceRecord).filter(AttendanceRecord.student_id.in_(ids["students"])).delete()
        db.query(ReportCardMark).filter(ReportCardMark.student_id.in_(ids["students"])).delete()
        db.query(StudentEnrollment).filter(StudentEnrollment.student_id.in_(ids["students"])).delete()
        db.query(TeachingAssignment).filter(TeachingAssignment.class_section_id == ids["section"]).delete()
        db.query(Student).filter(Student.id.in_(ids["students"])).delete()
        db.query(ClassSection).filter(ClassSection.id == ids["section"]).delete()
        db.query(Teacher).filter(Teacher.id == ids["teacher"]).delete()
        db.query(AcademicYear).filter(AcademicYear.id == ids["year"]).delete()
        db.query(School).filter(School.id == ids["school"]).delete()
        db.query(District).filter(District.id == ids["district"]).delete()
        db.commit()
        db.close()

    def test_student_homework_flags_are_correct(self):
        rows = self.client.get("/homework/mine", headers=self.student_headers).json()
        self.assertEqual(len(rows), HOMEWORK_COUNT)
        done = {row["title"]: row["done"] for row in rows}
        self.assertTrue(done["HW 0"])
        self.assertTrue(done["HW 1"])
        self.assertFalse(done["HW 2"], "a status row with done=false must not count as done")
        self.assertFalse(done["HW 3"], "no status row means not done")
        self.assertEqual([row["title"] for row in rows], [f"HW {n}" for n in range(HOMEWORK_COUNT)])

    def test_student_homework_query_count_does_not_grow_per_item(self):
        with _CountQueries() as queries:
            self.client.get("/homework/mine", headers=self.student_headers)
        self.assertLess(queries.count, 10, f"{queries.count} queries for {HOMEWORK_COUNT} items")

    def test_teacher_homework_counts_are_correct(self):
        rows = self.client.get("/homework", headers=self.teacher_headers).json()
        by_title = {row["title"]: row for row in rows}
        self.assertEqual(len(rows), HOMEWORK_COUNT)
        self.assertEqual(by_title["HW 0"]["done_count"], 2)
        self.assertEqual(by_title["HW 1"]["done_count"], 1)
        self.assertEqual(by_title["HW 2"]["done_count"], 0, "done=false must not be counted")
        self.assertEqual(by_title["HW 3"]["done_count"], 0)
        self.assertTrue(all(row["total_count"] == ROSTER_SIZE for row in rows))

    def test_teacher_homework_query_count_does_not_grow_per_item(self):
        with _CountQueries() as queries:
            self.client.get("/homework", headers=self.teacher_headers)
        self.assertLess(queries.count, 10, f"{queries.count} queries for {HOMEWORK_COUNT} items")

    def test_attendance_history_is_correct(self):
        rows = self.client.get("/attendance/mine", headers=self.student_headers).json()
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[0]["date"], (date.today() - timedelta(days=1)).isoformat())
        self.assertTrue(all(row["status"] == "present" for row in rows))

    def test_marking_attendance_updates_existing_and_creates_new(self):
        day = (date.today() - timedelta(days=30)).isoformat()
        students = self.ids["students"]
        body = {
            "class_section_id": str(self.ids["section"]), "date": day,
            "records": [{"student_id": str(s), "status": "present"} for s in students],
        }
        with _CountQueries() as queries:
            first = self.client.post("/attendance", json=body, headers=self.teacher_headers)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertLess(queries.count, ROSTER_SIZE + 12, "should not run one lookup per student")

        body["records"][0]["status"] = "absent"
        second = self.client.post("/attendance", json=body, headers=self.teacher_headers)
        self.assertEqual(second.status_code, 200, second.text)
        marks = {row["student_id"]: row["status"] for row in second.json()["students"]}
        self.assertEqual(marks[str(students[0])], "absent", "the existing row must be updated")
        self.assertEqual(marks[str(students[1])], "present")

        db = SessionLocal()
        rows = db.query(AttendanceRecord).filter(AttendanceRecord.attendance_date == date.fromisoformat(day),
                                                 AttendanceRecord.student_id.in_(students)).count()
        db.close()
        self.assertEqual(rows, ROSTER_SIZE, "a repeat save must not add rows")

    def test_bulk_marks_save_update_and_return_every_student(self):
        students = self.ids["students"]
        body = {
            "class_section_id": str(self.ids["section"]), "subject_id": str(self.ids["subject"]),
            "term": "QB Term", "max_marks": 100,
            "marks": [{"student_id": str(s), "marks_obtained": 50 + i} for i, s in enumerate(students)],
        }
        with _CountQueries() as queries:
            created = self.client.post("/report-card/bulk-marks", json=body, headers=self.teacher_headers)
        self.assertEqual(created.status_code, 200, created.text)
        self.assertEqual(created.json()["saved_count"], ROSTER_SIZE)
        self.assertEqual([m["marks_obtained"] for m in created.json()["marks"]], [50 + i for i in range(ROSTER_SIZE)])
        self.assertTrue(all(m["updated_at"] for m in created.json()["marks"]))
        # One INSERT per student remains: the id comes from the database, so SQLAlchemy cannot batch them.
        self.assertLess(queries.count, ROSTER_SIZE + 10, "should not run lookups and reloads per student")

        body["marks"][0]["marks_obtained"] = 99
        updated = self.client.post("/report-card/bulk-marks", json=body, headers=self.teacher_headers)
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["marks"][0]["marks_obtained"], 99)
        self.assertEqual(updated.json()["marks"][1]["marks_obtained"], 51)

        db = SessionLocal()
        count = db.query(ReportCardMark).filter(ReportCardMark.term == "QB Term",
                                                ReportCardMark.student_id.in_(students)).count()
        db.close()
        self.assertEqual(count, ROSTER_SIZE, "updating must not add rows")

    def test_bulk_marks_reject_someone_outside_the_class_and_save_nothing(self):
        body = {
            "class_section_id": str(self.ids["section"]), "subject_id": str(self.ids["subject"]),
            "term": "QB Reject", "max_marks": 100,
            "marks": [
                {"student_id": str(self.ids["students"][0]), "marks_obtained": 40},
                {"student_id": str(uuid.uuid4()), "marks_obtained": 40},
            ],
        }
        response = self.client.post("/report-card/bulk-marks", json=body, headers=self.teacher_headers)
        self.assertEqual(response.status_code, 400, response.text)
        db = SessionLocal()
        saved = db.query(ReportCardMark).filter(ReportCardMark.term == "QB Reject").count()
        db.close()
        self.assertEqual(saved, 0, "a rejected request must save nothing")


if __name__ == "__main__":
    unittest.main()
