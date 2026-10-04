"""A teacher's classes and subjects belong to the principal's assignments.
The teacher's own profile update can change the name and language, and
nothing else: a `subjects` value sent to it is ignored, never saved.

Runs against the local dev database with seed data.
"""

import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app import app
from backend.db.models import AcademicYear, ClassSection, Teacher, TeachingAssignment
from backend.db.session import SessionLocal

PW = "Password@123"
ANITA_PHONE = "+919876543211"
_THROTTLE_SCOPES = ["login_ip_identifier", "login_ip", "login_identifier", "phone_lookup_ip", "phone_lookup"]


class ProfileIsNotAssignmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with SessionLocal() as db:
            db.execute(text("DELETE FROM auth_throttle WHERE scope = ANY(:s)"), {"s": _THROTTLE_SCOPES})
            db.commit()
        cls.client = TestClient(app)
        r = cls.client.post("/auth/login/phone", json={"phone": ANITA_PHONE, "password": PW, "role": "teacher"})
        if r.status_code != 200:
            raise unittest.SkipTest(f"seed teacher unavailable ({r.status_code})")
        cls.headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        cls.original = cls.client.get("/profile", headers=cls.headers).json()

    def tearDown(self):
        self.client.patch(
            "/profile",
            json={"full_name": self.original["full_name"], "preferred_language": self.original["preferred_language"]},
            headers=self.headers,
        )

    def test_a_teacher_cannot_change_their_subjects_or_grades(self):
        before = sorted((s["subject_id"], s["grade_id"], s["is_primary"]) for s in self.original["subjects"])
        # an invented subject: the old endpoint refused this with a 400; now it is ignored
        bogus = {"subjects": [{"subject_id": str(uuid.uuid4()), "grade_id": str(uuid.uuid4()), "is_primary": True}]}
        r = self.client.patch("/profile", json=bogus, headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        after = self.client.get("/profile", headers=self.headers).json()
        self.assertEqual(sorted((s["subject_id"], s["grade_id"], s["is_primary"]) for s in after["subjects"]), before)

    def test_subjects_are_the_principal_assignments_for_the_current_year(self):
        # the dashboard's subject and class list is exactly the principal's primary
        # assignments, one entry per subject and grade, and nothing else
        with SessionLocal() as db:
            teacher = db.query(Teacher).filter(Teacher.phone_number == ANITA_PHONE).one()
            expected = {
                (a.subject_id, c.grade_id)
                for a, c, y in db.query(TeachingAssignment, ClassSection, AcademicYear)
                .join(ClassSection, TeachingAssignment.class_section_id == ClassSection.id)
                .join(AcademicYear, ClassSection.academic_year_id == AcademicYear.id)
                .filter(
                    TeachingAssignment.teacher_id == teacher.id,
                    TeachingAssignment.role == "primary",
                    AcademicYear.is_current.is_(True),
                )
            }
        got = {(s["subject_id"], s["grade_id"]) for s in self.original["subjects"]}
        self.assertEqual(got, {(str(sid), str(gid)) for sid, gid in expected})
        primaries = [s for s in self.original["subjects"] if s["is_primary"]]
        self.assertLessEqual(len(primaries), 1)

    def test_the_name_and_language_can_still_be_updated(self):
        r = self.client.patch("/profile", json={"full_name": "Anita Verma"}, headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["full_name"], "Anita Verma")


if __name__ == "__main__":
    unittest.main()
