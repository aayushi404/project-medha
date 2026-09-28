"""Regression tests for the Phase 1 hardening: JWT strictness, production
config guards, and cross-tenant report-card writes."""

import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

import jwt as pyjwt
from fastapi import HTTPException

from backend.auth.jwt import create_access_token, decode_access_token
from backend.core.config import JWT_SECRET_KEY, Settings
from backend.db.models import Student, Subject, Teacher
from backend.db.session import SessionLocal
from backend.report_card import service as report_card


class TestJwtStrictness(unittest.TestCase):
    def test_roundtrip(self):
        i = uuid.uuid4()
        self.assertEqual(decode_access_token(create_access_token(i, "student")), (i, "student"))

    def test_rejects_alg_none_missing_claims_and_wrong_audience(self):
        i = str(uuid.uuid4())
        cases = {
            "none": pyjwt.encode({"sub": i}, None, algorithm="none"),
            "no aud/iss/actor": pyjwt.encode({"sub": i, "type": "access", "exp": 9999999999, "iat": 1}, JWT_SECRET_KEY, algorithm="HS256"),
            "wrong aud": pyjwt.encode(
                {"sub": i, "type": "access", "actor_type": "teacher", "iss": "medha-api", "aud": "other", "exp": 9999999999, "iat": 1},
                JWT_SECRET_KEY, algorithm="HS256"),
            "wrong secret": pyjwt.encode(
                {"sub": i, "type": "access", "actor_type": "teacher", "iss": "medha-api", "aud": "medha-web", "exp": 9999999999, "iat": 1},
                "x" * 40, algorithm="HS256"),
            "bad actor_type": pyjwt.encode(
                {"sub": i, "type": "access", "actor_type": "admin", "iss": "medha-api", "aud": "medha-web", "exp": 9999999999, "iat": 1},
                JWT_SECRET_KEY, algorithm="HS256"),
            "bad sub": pyjwt.encode(
                {"sub": "not-a-uuid", "type": "access", "actor_type": "teacher", "iss": "medha-api", "aud": "medha-web", "exp": 9999999999, "iat": 1},
                JWT_SECRET_KEY, algorithm="HS256"),
        }
        for name, token in cases.items():
            with self.subTest(name):
                with self.assertRaises(pyjwt.PyJWTError):
                    decode_access_token(token)


class TestConfigGuards(unittest.TestCase):
    BASE = dict(jwt_secret_key="k" * 40, absence_call_force_phone="")

    def test_production_requires_strong_secret_https_and_no_force_phone(self):
        ok = dict(
            self.BASE, environment="production", frontend_origin="https://app.example.gov.in", cookie_secure=True,
            allowed_hosts="api.example.gov.in", mail_backend="smtp", smtp_host="smtp.example.gov.in", smtp_from="Medha <no-reply@example.gov.in>",
        )
        Settings(**ok)
        for bad in (
            dict(jwt_secret_key="changeme"),
            dict(jwt_secret_key="short"),
            dict(frontend_origin="http://app.example.gov.in"),
            dict(cookie_secure=False),
            dict(absence_call_force_phone="+919800000000"),
            dict(mail_backend="console"),
            dict(allowed_hosts=""),
        ):
            with self.subTest(bad), self.assertRaises(Exception):
                Settings(**{**ok, **bad})

    def test_always_on_checks(self):
        for bad in (
            dict(jwt_algorithm="none"),
            dict(cookie_samesite="bogus"),
            dict(cookie_samesite="none", cookie_secure=False),
            dict(frontend_origin="http://localhost:3000/"),
            dict(frontend_origin="localhost:3000"),
        ):
            with self.subTest(bad), self.assertRaises(Exception):
                Settings(**{**self.BASE, **bad})


class TestReportCardTenancy(unittest.TestCase):
    def test_teacher_from_another_school_cannot_touch_student_marks(self):
        db = SessionLocal()
        try:
            student = db.query(Student).first()
            subject = db.query(Subject).first()
            if student is None or subject is None:
                self.skipTest("no seed data")
            outsider = Teacher(id=uuid.uuid4(), school_id=uuid.uuid4(), role="teacher")
            with self.assertRaises(HTTPException) as cm:
                report_card.delete_mark(db, outsider, student.id, subject.id, "Mid Term Examination")
            self.assertEqual(cm.exception.status_code, 404)
        finally:
            db.close()

    def test_same_school_teacher_without_assignment_is_forbidden(self):
        db = SessionLocal()
        try:
            student = db.query(Student).filter(Student.approval_status == "approved").first()
            subject = db.query(Subject).first()
            if student is None or subject is None:
                self.skipTest("no seed data")
            unassigned = Teacher(id=uuid.uuid4(), school_id=student.school_id, role="teacher")
            with self.assertRaises(HTTPException) as cm:
                report_card.delete_mark(db, unassigned, student.id, subject.id, "Mid Term Examination")
            self.assertIn(cm.exception.status_code, (403, 409))
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
