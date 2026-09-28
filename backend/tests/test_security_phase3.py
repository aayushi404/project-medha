"""Phase 3 regression tests: tenant/section scoping of reads and writes,
upload validation, input caps, public-endpoint hardening."""

import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient

from backend.app import app
from backend.db.models import Grade, Student, Subject
from backend.db.session import SessionLocal


def _login(email: str, role: str) -> dict:
    c = TestClient(app)
    r = c.post("/auth/login", json={"email": email, "password": "Password@123", "role": role})
    if r.status_code != 200:
        raise unittest.SkipTest(f"seed account {email} unavailable")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class TestScoping(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.anita = _login("anita.science@medhabihar.org", "teacher")  # teaches classes 6-8
        cls.principal = _login("principal.patna@medhabihar.org", "principal")
        db = SessionLocal()
        try:
            cls.own = db.query(Student).filter(Student.email == "aditi.c6@medhabihar.org").one().id
            cls.other = db.query(Student).filter(Student.email == "vikram.c9@medhabihar.org").one().id  # class 9
            cls.grade10 = db.query(Grade).filter(Grade.label == "Class 10").one().id
            cls.subject = db.query(Subject).first().id
        finally:
            db.close()

    def test_report_card_read_is_limited_to_own_sections(self):
        self.assertEqual(self.client.get(f"/report-card/{self.own}", headers=self.anita).status_code, 200)
        self.assertEqual(self.client.get(f"/report-card/{self.other}", headers=self.anita).status_code, 404)
        self.assertEqual(self.client.get(f"/report-card/{self.other}", headers=self.principal).status_code, 200)

    def test_fee_log_read_is_limited_to_own_sections(self):
        self.assertEqual(self.client.get(f"/fees/{self.other}", headers=self.anita).status_code, 404)
        self.assertEqual(self.client.get(f"/fees/{self.other}", headers=self.principal).status_code, 200)

    def test_absence_calls_default_scope(self):
        rows = self.client.get("/absence-calls", headers=self.anita).json()
        self.assertTrue(all(r["student_id"] != str(self.other) for r in rows))

    def test_teacher_cannot_write_timetable_for_grade_they_dont_teach(self):
        r = self.client.put("/timetable", headers=self.anita, json={"grade_id": str(self.grade10), "slots": []})
        self.assertEqual(r.status_code, 403)

    def test_timetable_rejects_foreign_teacher(self):
        r = self.client.put(
            "/timetable",
            headers=self.principal,
            json={"grade_id": str(self.grade10), "slots": [
                {"day_of_week": 1, "period_number": 1, "subject_id": str(self.subject), "teacher_id": str(uuid.uuid4())}
            ]},
        )
        self.assertEqual(r.status_code, 400)

    def test_library_rejects_script_urls(self):
        r = self.client.post("/library/items", headers=self.principal, json={"title": "x", "url": "javascript:alert(1)"})
        self.assertEqual(r.status_code, 422)


class TestUploadsAndCaps(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.anita = _login("anita.science@medhabihar.org", "teacher")

    def test_non_audio_upload_rejected(self):
        r = self.client.post("/speech/transcribe", headers=self.anita, files={"file": ("a.wav", b"this is not audio at all", "audio/wav")})
        self.assertEqual(r.status_code, 400)

    def test_omr_upload_checks_magic_bytes_not_extension(self):
        r = self.client.post("/report-card/omr/upload", headers=self.anita, files={"file": ("sheet.pdf", b"<html>not a pdf</html>", "application/pdf")})
        self.assertEqual(r.status_code, 400)

    def test_oversized_body_rejected_early(self):
        r = self.client.post("/speech/transcribe", headers=self.anita, files={"file": ("a.wav", b"RIFF" + b"0" * (13 * 1024 * 1024), "audio/wav")})
        self.assertEqual(r.status_code, 413)

    def test_school_search_needs_three_chars_and_escapes_wildcards(self):
        self.assertEqual(self.client.get("/schools/search", params={"q": "ab"}).status_code, 422)
        self.assertEqual(self.client.get("/schools/search", params={"q": "%%%"}).json(), [])


if __name__ == "__main__":
    unittest.main()
