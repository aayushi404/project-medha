"""A class teacher must teach at least one subject in that class section.

Covers: setting a class teacher who teaches nothing there is refused; once they
teach a subject there it works; and when a subject change leaves the class
teacher teaching nothing in the section, the seat is released.

Builds its own school, year, section and staff, then removes them.
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
    Grade,
    School,
    Subject,
    Teacher,
    TeachingAssignment,
)
from backend.db.session import SessionLocal


def _fresh_phone() -> str:
    return f"+919{uuid.uuid4().int % 10**9:09d}"


class ClassTeacherRuleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        db = SessionLocal()
        db.expire_on_commit = False
        try:
            district_id = db.query(School.district_id).first()[0]
            school = School(name=f"Class teacher test {uuid.uuid4().hex[:6]}", district_id=district_id)
            db.add(school)
            db.flush()
            cls.school_id = school.id

            principal = Teacher(school_id=school.id, full_name="CT Principal", role="principal",
                                approval_status="approved", phone_number=_fresh_phone())
            cls.teacher = Teacher(school_id=school.id, full_name="CT Teacher", role="teacher",
                                  approval_status="approved", phone_number=_fresh_phone())
            cls.other = Teacher(school_id=school.id, full_name="CT Other", role="teacher",
                                approval_status="approved", phone_number=_fresh_phone())
            db.add_all([principal, cls.teacher, cls.other])
            db.flush()
            cls.principal_id = principal.id
            cls.teacher_id = cls.teacher.id
            cls.other_id = cls.other.id

            year = AcademicYear(school_id=school.id, label=f"CT-{uuid.uuid4().hex[:6]}",
                                starts_on=date(2026, 4, 1), ends_on=date(2027, 3, 31), is_current=True)
            db.add(year)
            db.flush()
            cls.year_id = year.id

            grade = db.query(Grade).filter(Grade.numeric_level == 9).one()
            section = ClassSection(school_id=school.id, academic_year_id=year.id, grade_id=grade.id, section="A")
            db.add(section)
            db.flush()
            cls.section_id = section.id
            cls.section_label = f"{grade.label} · A"

            cls.science = db.query(Subject).filter(Subject.name == "Science").one().id
            cls.english = db.query(Subject).filter(Subject.name == "English").one().id
            db.commit()
        finally:
            db.close()
        cls.headers = {"Authorization": f"Bearer {create_access_token(cls.principal_id, 'teacher')}"}

    @classmethod
    def tearDownClass(cls):
        db = SessionLocal()
        try:
            db.query(TeachingAssignment).filter(TeachingAssignment.class_section_id == cls.section_id).delete(synchronize_session=False)
            db.query(ClassSection).filter(ClassSection.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(AcademicYear).filter(AcademicYear.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(Teacher).filter(Teacher.school_id == cls.school_id).delete(synchronize_session=False)
            db.query(School).filter(School.id == cls.school_id).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    def setUp(self):
        # each test starts with an empty section, whatever the one before left
        self._set_subject_teacher(self.science, None)
        self._set_subject_teacher(self.english, None)
        self._set_class_teacher(None)

    def _set_class_teacher(self, teacher_id):
        return self.client.patch(
            f"/principal/sections/{self.section_id}",
            json={"class_teacher_id": str(teacher_id) if teacher_id else None},
            headers=self.headers,
        )

    def _set_subject_teacher(self, subject_id, teacher_id):
        return self.client.put(
            f"/principal/sections/{self.section_id}/subjects/{subject_id}/teacher",
            json={"teacher_id": str(teacher_id) if teacher_id else None},
            headers=self.headers,
        )

    def _class_teacher(self):
        r = self.client.get(f"/principal/sections/{self.section_id}", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["class_teacher_id"]

    def test_a_teacher_who_teaches_nothing_in_the_class_cannot_be_class_teacher(self):
        r = self._set_class_teacher(self.teacher_id)
        self.assertEqual(r.status_code, 422, r.text)
        self.assertIn("doesn't teach any subject", r.json()["detail"])
        self.assertIn("CT Teacher", r.json()["detail"])
        self.assertIsNone(self._class_teacher())

    def test_once_they_teach_a_subject_in_the_class_they_can_be_class_teacher(self):
        self.assertEqual(self._set_subject_teacher(self.science, self.teacher_id).status_code, 200)
        r = self._set_class_teacher(self.teacher_id)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self._class_teacher(), str(self.teacher_id))

    def test_removing_their_last_subject_in_the_class_releases_the_class_teacher_seat(self):
        self.assertEqual(self._set_subject_teacher(self.science, self.teacher_id).status_code, 200)
        self.assertEqual(self._set_class_teacher(self.teacher_id).status_code, 200)

        r = self._set_subject_teacher(self.science, None)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(self._class_teacher())

    def test_handing_their_subject_to_someone_else_releases_the_seat(self):
        self.assertEqual(self._set_subject_teacher(self.english, self.teacher_id).status_code, 200)
        self.assertEqual(self._set_class_teacher(self.teacher_id).status_code, 200)

        self.assertEqual(self._set_subject_teacher(self.english, self.other_id).status_code, 200)
        self.assertIsNone(self._class_teacher())

    def test_keeping_another_subject_keeps_the_class_teacher(self):
        self.assertEqual(self._set_subject_teacher(self.science, self.teacher_id).status_code, 200)
        self.assertEqual(self._set_subject_teacher(self.english, self.teacher_id).status_code, 200)
        self.assertEqual(self._set_class_teacher(self.teacher_id).status_code, 200)

        self.assertEqual(self._set_subject_teacher(self.science, None).status_code, 200)
        self.assertEqual(self._class_teacher(), str(self.teacher_id))


if __name__ == "__main__":
    unittest.main()
