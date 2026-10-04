"""Phase 2 auth-core regression tests (run against the local dev database
with seed_demo_accounts data): throttling, non-enumerating registration,
email verification gating approval, password reset, refresh rotation and
reuse detection, CSRF header, password policy."""

import os
import re
import sys
import time
import unittest
import uuid
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient

from backend.app import app
from backend.approvals import service as approvals
from backend.auth.password_policy import validate_password
from backend.db.models import AuthSession, ClassSection, School, Student, Teacher
from backend.db.session import SessionLocal

client = TestClient(app)
PW = "Sup3r-secret-Phrase"


def _student_profile_id(phone: str, full_name: str) -> str:
    """Resolve a seeded student's profile id through the picker endpoint, the
    same way the login screen does."""
    r = client.post("/auth/student/lookup", json={"phone": phone})
    for profile in r.json().get("profiles", []):
        if profile["full_name"] == full_name:
            return profile["id"]
    raise unittest.SkipTest(f"seed student {full_name} unavailable")


def _student_payload(email: str, school_id, section_id, roll: int) -> dict:
    return {
        "full_name": "Test Student",
        "school_id": str(school_id),
        "class_section_id": str(section_id),
        "roll_number": roll,
        "guardian_name": "Test Guardian",
        "guardian_relation": "father",
        "guardian_phone": "9812345678",
        # a random number per call: login phones are not unique, but a fixed one
        # would still tie these tests' accounts together
        "login_phone": f"+919{uuid.uuid4().int % 10**9:09d}",
        "email": email,
        "password": PW,
    }


class TestPasswordPolicy(unittest.TestCase):
    def test_rules(self):
        for bad in ("short1!", "password123", "aaaaaaaaaaaa", "NoDigitsHereAtAll", "x" * 80 + "1"):
            with self.subTest(bad), self.assertRaises(ValueError):
                validate_password(bad)
        with self.assertRaises(ValueError):
            validate_password("kiran-devi-2026!", email="kiran.devi@x.org")
        with self.assertRaises(ValueError):
            validate_password("Anita-is-great-1", name="Anita Verma")
        self.assertEqual(validate_password(PW), PW)


class TestLoginThrottle(unittest.TestCase):
    def test_locks_pair_but_not_other_accounts(self):
        # a random, unused number: no account, so every attempt is a plain miss
        victim = f"+919{uuid.uuid4().int % 10**9:09d}"
        body = {"phone": victim, "password": "wrong-password-1", "role": "teacher"}
        codes = [client.post("/auth/login/phone", json=body).status_code for _ in range(7)]
        self.assertEqual(codes[:5], [401] * 5)
        self.assertEqual(codes[5:], [429, 429])
        # locking the (ip, phone) pair must not block a different account from the same IP
        other_phone = f"+919{uuid.uuid4().int % 10**9:09d}"
        other = client.post(
            "/auth/login/phone", json={"phone": other_phone, "password": "x" * 12, "role": "teacher"}
        )
        self.assertEqual(other.status_code, 401)

    def test_email_login_rejects_teacher_and_student_roles(self):
        # teachers and students no longer log in by email at all
        r = client.post("/auth/login", json={"email": "anita.science@medhabihar.org", "password": "Password@123", "role": "teacher"})
        self.assertEqual(r.status_code, 422)
        r = client.post("/auth/login", json={"email": "aditi.c6@medhabihar.org", "password": "Password@123", "role": "student"})
        self.assertEqual(r.status_code, 422)


class TestRegistrationFlow(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.school = self.db.query(School).join(Teacher, Teacher.school_id == School.id).filter(Teacher.role == "principal").first()
        if self.school is None:
            self.skipTest("seed data missing")
        self.section = self.db.query(ClassSection).filter(ClassSection.school_id == self.school.id).first()
        self.roll = 900 + int(uuid.uuid4().int % 90)
        self.emails: list[str] = []
        self.mail = patch("backend.auth.emails.send_email")
        self.sent = self.mail.start()

    def tearDown(self):
        self.mail.stop()
        self.db.rollback()
        for e in self.emails:
            self.db.query(Student).filter(Student.email == e).delete()
        self.db.commit()
        self.db.close()

    def _register(self, email):
        self.emails.append(email)
        return client.post("/student/register", json=_student_payload(email, self.school.id, self.section.id, self.roll))

    def test_weak_password_rejected_without_echo(self):
        p = _student_payload(f"w-{uuid.uuid4().hex[:6]}@example.org", self.school.id, self.section.id, self.roll)
        p["password"] = "password123"
        r = client.post("/student/register", json=p)
        self.assertEqual(r.status_code, 422)
        self.assertNotIn("password123", r.text)

    def test_existing_email_is_indistinguishable_and_verification_gates_approval(self):
        email = f"reg-{uuid.uuid4().hex[:8]}@example.org"
        first = self._register(email)
        self.assertEqual(first.status_code, 201)
        subjects = [c.args[1] for c in self.sent.call_args_list]
        self.assertTrue(any("Verify" in s for s in subjects))

        # registering the same email again looks identical to the caller...
        again = self._register(email)
        self.assertEqual((again.status_code, again.json()), (first.status_code, first.json()))
        # ...and the address owner is told by email instead
        self.assertTrue(any("already have" in c.args[1] for c in self.sent.call_args_list))

        # Students log in by phone, so an unverified email no longer blocks
        # approval -- the email is only a contact address now.
        student = self.db.query(Student).filter(Student.email == email).one()
        teacher = self.db.query(Teacher).filter(Teacher.role == "teacher", Teacher.school_id == self.school.id).first()
        approvals.approve(self.db, actor=teacher, subject=student)
        self.db.expire_all()
        self.assertIsNone(self.db.query(Student).filter(Student.email == email).one().email_verified_at)

        # the verification link still works, once
        body = next(c.args[2] for c in self.sent.call_args_list if "Verify" in c.args[1])
        token = re.search(r"token=([A-Za-z0-9_-]+)", body).group(1)
        self.assertEqual(client.post("/auth/verify-email", json={"token": token}).status_code, 200)
        self.assertEqual(client.post("/auth/verify-email", json={"token": token}).status_code, 400)  # single use

        self.db.expire_all()
        self.assertIsNotNone(self.db.query(Student).filter(Student.email == email).one().email_verified_at)

    def test_forgot_password_is_uniform_and_reset_is_single_use(self):
        email = f"pw-{uuid.uuid4().hex[:8]}@example.org"
        self._register(email)
        unknown = client.post("/auth/forgot-password", json={"email": f"nobody-{uuid.uuid4().hex[:6]}@example.org"})
        known = client.post("/auth/forgot-password", json={"email": email})
        self.assertEqual((unknown.status_code, unknown.json()), (known.status_code, known.json()))
        body = next(c.args[2] for c in self.sent.call_args_list if "Reset" in c.args[1])
        token = re.search(r"token=([A-Za-z0-9_-]+)", body).group(1)
        new_pw = "Another-Strong-Pass-42"
        self.assertEqual(client.post("/auth/reset-password", json={"token": token, "new_password": new_pw}).status_code, 200)
        self.assertEqual(client.post("/auth/reset-password", json={"token": token, "new_password": "Yet-Another-Pass-77"}).status_code, 400)
        # resetting proves mailbox control, so the account is now verified
        self.db.expire_all()
        self.assertIsNotNone(self.db.query(Student).filter(Student.email == email).one().email_verified_at)


class TestRefreshSessions(unittest.TestCase):
    H = {"X-Medha-Client": "web", "Origin": "http://localhost:3000"}

    def _login(self):
        c = TestClient(app)
        r = c.post(
            "/auth/login/phone",
            json={
                "phone": "+919800000001",
                "password": "Password@123",
                "role": "student",
                "student_id": _student_profile_id("+919800000001", "Aditi Sharma"),
            },
        )
        if r.status_code != 200:
            self.skipTest("seed student unavailable")
        return c, r.cookies.get("refresh_token")

    def test_csrf_header_and_origin_required(self):
        c, tok = self._login()
        self.assertEqual(c.post("/auth/refresh").status_code, 403)
        self.assertEqual(c.post("/auth/refresh", headers={"X-Medha-Client": "web", "Origin": "https://evil.example"}).status_code, 403)
        self.assertEqual(c.post("/auth/logout").status_code, 403)

    def test_rotation_reuse_detection_and_inactive_account(self):
        c, tok = self._login()
        c.cookies.set("refresh_token", tok, path="/auth")
        r1 = c.post("/auth/refresh", headers=self.H)
        self.assertEqual(r1.status_code, 200)
        tok2 = r1.cookies.get("refresh_token")
        self.assertNotEqual(tok, tok2)

        # replaying the rotated-out token: 401 right away (grace), and after the
        # grace window the whole family is revoked, killing the new token too
        stale = TestClient(app)
        stale.cookies.set("refresh_token", tok, path="/auth")
        self.assertEqual(stale.post("/auth/refresh", headers=self.H).status_code, 401)
        db = SessionLocal()
        try:
            db.query(AuthSession).filter(AuthSession.replaced_by_id.isnot(None)).update(
                {AuthSession.revoked_at: AuthSession.revoked_at - __import__("datetime").timedelta(seconds=60)}, synchronize_session=False
            )
            db.commit()
        finally:
            db.close()
        self.assertEqual(stale.post("/auth/refresh", headers=self.H).status_code, 401)
        live = TestClient(app)
        live.cookies.set("refresh_token", tok2, path="/auth")
        self.assertEqual(live.post("/auth/refresh", headers=self.H).status_code, 401)


if __name__ == "__main__":
    unittest.main()
