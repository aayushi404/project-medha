"""Teacher access to students, by class (docs/teacher-students-plan.md).

A teacher acts on the students of the classes they teach (a teaching
assignment for the class, any subject) or are homeroom teacher of. That rule
drives the pending list, the class lists, approve/reject, and the full profile.
The principal sees any student in the school. Everyone else gets 404.

Builds its own data in two temporary class sections of the seeded school, and
removes it afterwards.
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
    ApprovalEvent,
    ClassSection,
    Grade,
    School,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    TeachingAssignment,
)
from backend.db.session import SessionLocal

ADITI_PHONE = "+919800000001"


def _fresh_phone() -> str:
    return f"+919{uuid.uuid4().int % 10**9:09d}"


def _headers(actor_id: uuid.UUID, actor_type: str = "teacher") -> dict:
    return {"Authorization": f"Bearer {create_access_token(actor_id, actor_type)}"}


class TeacherStudentScopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.created_students: list[uuid.UUID] = []
        cls.created_teachers: list[uuid.UUID] = []
        cls.created_sections: list[uuid.UUID] = []
        cls.created_assignments: list[uuid.UUID] = []
        # one session for the whole setup; objects stay readable after commit
        db = SessionLocal()
        db.expire_on_commit = False
        try:
            aditi = db.query(Student).filter(Student.phone_number == ADITI_PHONE).one_or_none()
            if aditi is None:
                raise unittest.SkipTest("seed student unavailable")
            cls.school_id = aditi.school_id
            year = db.query(AcademicYear).filter(
                AcademicYear.school_id == cls.school_id, AcademicYear.is_current.is_(True)
            ).one()
            cls.year_id = year.id
            grade = db.query(Grade).filter(Grade.label == "Class 6").one()
            cls.grade_id = grade.id
            subject = db.query(Subject).first()
            cls.subject_id = subject.id
            other = db.query(School).filter(School.id != cls.school_id).first()
            cls.other_school_id = other.id

            # two temporary classes at the seeded school
            t1 = cls._section(db, "T1")
            t2 = cls._section(db, "T2")
            t3 = cls._section(db, "T3")
            cls.t1, cls.t2, cls.t3 = t1.id, t2.id, t3.id

            # the homeroom teacher of T1 has no subject rows: the case the old rule hid
            cls.homeroom = cls._teacher(db, "Scope Homeroom", school_id=cls.school_id)
            t1.class_teacher_id = cls.homeroom.id
            # teaches T1 and T2 (6A and 6B style)
            cls.both = cls._teacher(db, "Scope Both Classes", school_id=cls.school_id)
            cls._assign(db, cls.both.id, t1.id)
            cls._assign(db, cls.both.id, t2.id)
            # teaches only T3
            cls.outsider = cls._teacher(db, "Scope Outsider", school_id=cls.school_id)
            cls._assign(db, cls.outsider.id, t3.id)
            # a teacher at another school
            cls.stranger = cls._teacher(db, "Scope Stranger", school_id=cls.other_school_id)
            cls._assign(db, cls.stranger.id, t1.id)  # section of another school would be refused anyway

            cls.pending_t1 = cls._student(db, "Scope Pending T1", t1.id, 1, "pending", email="pending@example.org")
            cls.approved_t1 = cls._student(db, "Scope Approved T1", t1.id, 2, "approved")
            cls.approved_t2 = cls._student(db, "Scope Approved T2", t2.id, 1, "approved")
            db.commit()
        finally:
            db.commit()
            db.close()

    @classmethod
    def tearDownClass(cls):
        with SessionLocal() as db:
            db.query(ApprovalEvent).filter(
                ApprovalEvent.subject_student_id.in_(cls.created_students)
            ).delete(synchronize_session=False)
            db.query(StudentEnrollment).filter(
                StudentEnrollment.student_id.in_(cls.created_students)
            ).delete(synchronize_session=False)
            db.query(Student).filter(Student.id.in_(cls.created_students)).delete(synchronize_session=False)
            db.query(TeachingAssignment).filter(
                TeachingAssignment.id.in_(cls.created_assignments)
            ).delete(synchronize_session=False)
            db.query(ClassSection).filter(ClassSection.id.in_(cls.created_sections)).update(
                {ClassSection.class_teacher_id: None}, synchronize_session=False
            )
            db.query(ClassSection).filter(ClassSection.id.in_(cls.created_sections)).delete(synchronize_session=False)
            db.query(Teacher).filter(Teacher.id.in_(cls.created_teachers)).delete(synchronize_session=False)
            db.commit()

    # --- fixture helpers ------------------------------------------------------

    @classmethod
    def _section(cls, db, letter: str) -> ClassSection:
        section = ClassSection(
            school_id=cls.school_id,
            academic_year_id=cls.year_id,
            grade_id=cls.grade_id,
            section=f"{letter}-{uuid.uuid4().hex[:4]}",
        )
        db.add(section)
        db.flush()
        cls.created_sections.append(section.id)
        return section

    @classmethod
    def _teacher(cls, db, name: str, *, school_id) -> Teacher:
        teacher = Teacher(
            school_id=school_id,
            full_name=name,
            role="teacher",
            approval_status="approved",
            is_active=True,
            phone_number=_fresh_phone(),
        )
        db.add(teacher)
        db.flush()
        cls.created_teachers.append(teacher.id)
        return teacher

    @classmethod
    def _assign(cls, db, teacher_id, section_id) -> None:
        row = TeachingAssignment(teacher_id=teacher_id, class_section_id=section_id, subject_id=cls.subject_id)
        db.add(row)
        db.flush()
        cls.created_assignments.append(row.id)

    @classmethod
    def _student(cls, db, name: str, section_id, roll: int, approval: str, email: str | None = None) -> Student:
        student = Student(
            school_id=cls.school_id,
            full_name=name,
            phone_number=_fresh_phone(),
            email=email,
            guardian_name="Test Guardian",
            guardian_relation="father",
            guardian_phone="9812345678",
            approval_status=approval,
            is_active=True,
        )
        db.add(student)
        db.flush()
        db.add(
            StudentEnrollment(
                student_id=student.id,
                class_section_id=section_id,
                academic_year_id=cls.year_id,
                roll_number=roll,
                enrolled_on=date.today(),
            )
        )
        db.flush()
        cls.created_students.append(student.id)
        return student

    # --- the cases ------------------------------------------------------------

    def test_homeroom_teacher_with_no_subject_sees_and_approves_the_pending_student(self):
        client = TestClient(app)
        h = _headers(self.homeroom.id)
        pending = client.get("/teacher/students/pending", params={"class_section_id": str(self.t1)}, headers=h)
        self.assertEqual(pending.status_code, 200, pending.text)
        self.assertIn(str(self.pending_t1.id), [s["id"] for s in pending.json()])

        approved = client.post(f"/teacher/students/{self.pending_t1.id}/approve", headers=h)
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(approved.json()["approval_status"], "approved")
        # restore so the other cases see a pending student again
        with SessionLocal() as db:
            db.query(Student).filter(Student.id == self.pending_t1.id).update({"approval_status": "pending"})
            db.commit()

    def test_a_teacher_of_two_classes_opens_profiles_in_both(self):
        client = TestClient(app)
        h = _headers(self.both.id)
        for sid in (self.approved_t1.id, self.approved_t2.id):
            r = client.get(f"/students/{sid}", headers=h)
            self.assertEqual(r.status_code, 200, r.text)
        lists = client.get("/teacher/students", headers=h).json()
        ids = {s["id"] for s in lists}
        self.assertIn(str(self.approved_t1.id), ids)
        self.assertIn(str(self.approved_t2.id), ids)

    def test_the_class_filter_narrows_to_one_class(self):
        client = TestClient(app)
        h = _headers(self.both.id)
        only_t2 = client.get("/teacher/students", params={"class_section_id": str(self.t2)}, headers=h).json()
        self.assertEqual({s["id"] for s in only_t2}, {str(self.approved_t2.id)})

    def test_a_class_the_teacher_does_not_teach_gives_nothing(self):
        client = TestClient(app)
        h = _headers(self.outsider.id)
        self.assertEqual(
            client.get("/teacher/students", params={"class_section_id": str(self.t1)}, headers=h).json(), []
        )
        self.assertEqual(
            client.get("/teacher/students/pending", params={"class_section_id": str(self.t1)}, headers=h).json(), []
        )

    def test_a_teacher_outside_the_class_gets_404_on_the_profile_and_cannot_approve(self):
        client = TestClient(app)
        h = _headers(self.outsider.id)
        self.assertEqual(client.get(f"/students/{self.approved_t1.id}", headers=h).status_code, 404)
        self.assertEqual(client.post(f"/teacher/students/{self.pending_t1.id}/approve", headers=h).status_code, 404)

    def test_a_teacher_of_another_school_gets_404(self):
        client = TestClient(app)
        r = client.get(f"/students/{self.approved_t1.id}", headers=_headers(self.stranger.id))
        self.assertEqual(r.status_code, 404)

    def test_a_student_token_cannot_open_any_profile(self):
        client = TestClient(app)
        r = client.get(f"/students/{self.approved_t1.id}", headers=_headers(self.approved_t1.id, "student"))
        self.assertIn(r.status_code, (401, 403))

    def test_the_list_carries_phone_and_no_email_while_the_profile_carries_email(self):
        client = TestClient(app)
        h = _headers(self.homeroom.id)
        item = next(
            s for s in client.get("/teacher/students/pending", headers=h).json() if s["id"] == str(self.pending_t1.id)
        )
        self.assertEqual(item["login_phone"], self.pending_t1.phone_number)
        self.assertNotIn("email", item)
        profile = client.get(f"/students/{self.pending_t1.id}", headers=h).json()
        self.assertEqual(profile["email"], "pending@example.org")
        self.assertEqual(profile["login_phone"], self.pending_t1.phone_number)
        self.assertEqual(profile["guardian_phone"], "9812345678")

    def test_only_the_homeroom_teacher_may_reset_the_login(self):
        client = TestClient(app)
        home = client.get(f"/students/{self.approved_t1.id}", headers=_headers(self.homeroom.id)).json()
        self.assertTrue(home["viewer"]["can_reset_login"])
        subject = client.get(f"/students/{self.approved_t1.id}", headers=_headers(self.both.id)).json()
        self.assertFalse(subject["viewer"]["can_reset_login"])
        self.assertFalse(subject["viewer"]["can_approve"])

    def test_principal_sees_any_student_in_the_school(self):
        client = TestClient(app)
        with SessionLocal() as db:
            principal = db.query(Teacher).filter(
                Teacher.role == "principal", Teacher.school_id == self.school_id
            ).one()
            principal_id = principal.id
        r = client.get(f"/students/{self.approved_t2.id}", headers=_headers(principal_id))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["viewer"], {"can_approve": False, "can_reject": False, "can_reset_login": False})

    def test_the_principal_roster_still_builds_and_carries_phone(self):
        client = TestClient(app)
        with SessionLocal() as db:
            principal_id = db.query(Teacher.id).filter(
                Teacher.role == "principal", Teacher.school_id == self.school_id
            ).scalar()
        r = client.get("/principal/students", headers=_headers(principal_id))
        self.assertEqual(r.status_code, 200, r.text)
        row = next(s for s in r.json() if s["id"] == str(self.approved_t2.id))
        self.assertEqual(row["login_phone"], self.approved_t2.phone_number)
        self.assertNotIn("email", row)

    def test_the_class_chooser_counts_approved_and_pending(self):
        client = TestClient(app)
        sections = client.get("/teacher/sections", headers=_headers(self.homeroom.id)).json()
        t1 = next(s for s in sections if s["id"] == str(self.t1))
        self.assertEqual((t1["students"], t1["pending_students"]), (1, 1))
        self.assertTrue(t1["is_class_teacher"])


if __name__ == "__main__":
    unittest.main()
