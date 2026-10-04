"""The school card: who can read it, who can change it, and the rules for
the name, logo and current academic year. Cloudinary is mocked; nothing here
uploads a real image.

Runs against the local dev database with seed data. Each test restores
whatever it changed.
"""

import os
import sys
import unittest
import uuid
from datetime import date
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app import app
from backend.db.models import AcademicYear, School, Student
from backend.db.session import SessionLocal

PW = "Password@123"
PRINCIPAL_EMAIL = "principal.patna@medhabihar.org"
ANITA_PHONE = "+919876543211"  # a teacher, not the principal
ADITI_PHONE = "+919800000001"  # a student

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
FAKE_URL = "https://res.cloudinary.com/demo/image/upload/v1/school_logos/x.png"

_THROTTLE_SCOPES = ["login_ip_identifier", "login_ip", "login_identifier", "phone_lookup_ip", "phone_lookup"]


def _reset_throttles() -> None:
    with SessionLocal() as db:
        db.execute(text("DELETE FROM auth_throttle WHERE scope = ANY(:s)"), {"s": _THROTTLE_SCOPES})
        db.commit()


def _login_principal() -> dict:
    r = TestClient(app).post("/auth/login", json={"email": PRINCIPAL_EMAIL, "password": PW, "role": "principal"})
    if r.status_code != 200:
        raise unittest.SkipTest("seed principal unavailable")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _login_phone(phone: str, role: str, student_id: uuid.UUID | None = None) -> dict:
    body = {"phone": phone, "password": PW, "role": role}
    if student_id is not None:
        body["student_id"] = str(student_id)
    r = TestClient(app).post("/auth/login/phone", json=body)
    if r.status_code != 200:
        raise unittest.SkipTest(f"seed {role} unavailable ({r.status_code})")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class SchoolCardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _reset_throttles()
        cls.client = TestClient(app)
        cls.principal = _login_principal()
        cls.teacher = _login_phone(ANITA_PHONE, "teacher")
        with SessionLocal() as db:
            aditi = db.query(Student).filter(Student.phone_number == ADITI_PHONE).one()
            cls.student_id = aditi.id
            cls.school_id = aditi.school_id
            cls.original_name = db.get(School, cls.school_id).name
        cls.student = _login_phone(ADITI_PHONE, "student", cls.student_id)

    def tearDown(self):
        # restore the seeded name whatever the test did
        with SessionLocal() as db:
            school = db.get(School, self.school_id)
            school.name = self.original_name
            school.logo_url = None
            db.commit()

    # --- reading the card ------------------------------------------------

    def test_a_teacher_and_a_student_can_read_the_card_but_cannot_edit(self):
        for headers in (self.teacher, self.student):
            r = self.client.get("/school", headers=headers)
            self.assertEqual(r.status_code, 200, r.text)
            body = r.json()
            self.assertEqual(body["name"], self.original_name)
            self.assertFalse(body["can_edit"])
            self.assertIsNotNone(body["academic_year"])

    def test_the_principal_card_is_editable(self):
        r = self.client.get("/school", headers=self.principal)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["can_edit"])

    def test_the_card_needs_a_signed_in_user(self):
        self.assertEqual(self.client.get("/school").status_code, 401)

    # --- name ------------------------------------------------------------

    def test_only_the_principal_can_rename_the_school(self):
        r = self.client.patch("/principal/school", json={"name": "Changed By Teacher"}, headers=self.teacher)
        self.assertEqual(r.status_code, 403)
        # a student token is refused by the principal guard (401 there, as on every principal route)
        r = self.client.patch("/principal/school", json={"name": "Changed By Student"}, headers=self.student)
        self.assertIn(r.status_code, (401, 403))
        self.assertEqual(self.client.get("/school", headers=self.student).json()["name"], self.original_name)

    def test_the_principal_renames_and_the_card_shows_it(self):
        r = self.client.patch("/principal/school", json={"name": "  Govt   Model  School  "}, headers=self.principal)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["name"], "Govt Model School")
        self.assertEqual(self.client.get("/school", headers=self.teacher).json()["name"], "Govt Model School")

    def test_a_bad_name_is_refused_with_a_reason(self):
        for name in ["ab", "<script>x</script>", "123456", "A\x00B school"]:
            r = self.client.patch("/principal/school", json={"name": name}, headers=self.principal)
            self.assertEqual(r.status_code, 422, name)

    # --- logo ------------------------------------------------------------

    def test_only_the_principal_can_change_the_logo(self):
        files = {"file": ("logo.png", PNG, "image/png")}
        r = self.client.post("/principal/school/logo", files=files, headers=self.teacher)
        self.assertEqual(r.status_code, 403)

    def test_a_logo_must_be_a_real_image(self):
        files = {"file": ("logo.png", b"<html>not an image</html>", "image/png")}
        r = self.client.post("/principal/school/logo", files=files, headers=self.principal)
        self.assertEqual(r.status_code, 400)
        self.assertIn("JPEG, PNG or WebP", r.json()["detail"])

    def test_a_logo_that_is_too_large_is_refused(self):
        big = b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024 + 1)
        files = {"file": ("logo.png", big, "image/png")}
        r = self.client.post("/principal/school/logo", files=files, headers=self.principal)
        self.assertEqual(r.status_code, 413)

    def test_the_principal_uploads_and_removes_a_logo(self):
        files = {"file": ("logo.png", PNG, "image/png")}
        with mock.patch("backend.school.service.upload_school_logo", return_value=FAKE_URL + "?v=abc") as up:
            r = self.client.post("/principal/school/logo", files=files, headers=self.principal)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["logo_url"], FAKE_URL + "?v=abc")
        up.assert_called_once()
        self.assertEqual(self.client.get("/school", headers=self.student).json()["logo_url"], FAKE_URL + "?v=abc")

        with mock.patch("backend.school.service.delete_school_logo") as rm:
            r = self.client.delete("/principal/school/logo", headers=self.principal)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(r.json()["logo_url"])
        rm.assert_called_once()

    # --- academic year ---------------------------------------------------

    def test_only_the_principal_can_change_the_academic_year(self):
        with SessionLocal() as db:
            current = db.query(AcademicYear).filter(
                AcademicYear.school_id == self.school_id, AcademicYear.is_current.is_(True)
            ).one()
            year_id = current.id
        r = self.client.post(f"/principal/academic-years/{year_id}/current", headers=self.teacher)
        self.assertEqual(r.status_code, 403)

    def test_the_principal_switches_the_current_year_and_can_switch_back(self):
        with SessionLocal() as db:
            original = db.query(AcademicYear).filter(
                AcademicYear.school_id == self.school_id, AcademicYear.is_current.is_(True)
            ).one()
            original_id = original.id
        label = f"TEST-{uuid.uuid4().hex[:4]}"
        created = self.client.post(
            "/principal/academic-years",
            json={"label": label, "starts_on": "2099-04-01", "ends_on": "2100-03-31", "set_current": False},
            headers=self.principal,
        )
        self.assertEqual(created.status_code, 200, created.text)
        test_year_id = created.json()["id"]
        try:
            r = self.client.post(f"/principal/academic-years/{test_year_id}/current", headers=self.principal)
            self.assertEqual(r.status_code, 200, r.text)
            self.assertEqual(self.client.get("/school", headers=self.principal).json()["academic_year"]["label"], label)
        finally:
            self.client.post(f"/principal/academic-years/{original_id}/current", headers=self.principal)
            with SessionLocal() as db:
                db.query(AcademicYear).filter(AcademicYear.id == uuid.UUID(test_year_id)).delete()
                db.commit()
        # exactly one current year again
        with SessionLocal() as db:
            count = db.query(AcademicYear).filter(
                AcademicYear.school_id == self.school_id, AcademicYear.is_current.is_(True)
            ).count()
            self.assertEqual(count, 1)

    def test_another_schools_year_is_not_found(self):
        r = self.client.post(f"/principal/academic-years/{uuid.uuid4()}/current", headers=self.principal)
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
