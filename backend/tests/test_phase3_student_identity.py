"""Phase 3 (docs/phone-login-plan.md): students are identified by login phone,
email is optional, and admission numbers are gone from the reads and writes.

Covers self-registration without an email, re-application by a rejected
applicant, the claim flow's phone check, the bulk importer (required phone,
siblings sharing a number, legacy "Admission No" column ignored), and the
principal's student profile.

Runs against the local dev database with seed data. Every student the tests
create is deleted in tearDown.
"""

import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from backend.app import app
from backend.auth.hashing import verify_password
from backend.db.models import ClassSection, Student, StudentEnrollment, Teacher
from backend.db.session import SessionLocal

PW = "Password@123"
IMPORT_PW = "Kite-River-2026"  # the principal's choice for imported students
PRINCIPAL_EMAIL = "principal.patna@medhabihar.org"
ADITI_PHONE = "+919800000001"
CLASS_6A_TEACHER_PHONE = "+919876543212"

_THROTTLE_SCOPES = ["student_register", "student_claim", "phone_lookup_ip", "phone_lookup", "login_ip_identifier", "login_ip", "login_identifier"]


def _fresh_phone() -> str:
    return f"+919{uuid.uuid4().int % 10**9:09d}"


def _reset_throttles() -> None:
    with SessionLocal() as db:
        db.execute(text("DELETE FROM auth_throttle WHERE scope = ANY(:s)"), {"s": _THROTTLE_SCOPES})
        db.commit()


def _principal_headers() -> dict:
    r = TestClient(app).post("/auth/login", json={"email": PRINCIPAL_EMAIL, "password": PW, "role": "principal"})
    if r.status_code != 200:
        raise unittest.SkipTest("seed principal unavailable")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class _SchoolFixture:
    """The seeded school, its current academic year, and Class 6 A."""

    def __init__(self):
        with SessionLocal() as db:
            aditi = db.query(Student).filter(Student.phone_number == ADITI_PHONE).one()
            self.school_id = aditi.school_id
            section = (
                db.query(ClassSection)
                .join(StudentEnrollment, StudentEnrollment.class_section_id == ClassSection.id)
                .filter(StudentEnrollment.student_id == aditi.id)
                .one()
            )
            self.section_id = section.id
            self.academic_year_id = section.academic_year_id


class _Cleanup(unittest.TestCase):
    """Tracks student ids the test created so tearDown can remove them."""

    def setUp(self):
        _reset_throttles()
        self.created: list[uuid.UUID] = []
        self.client = TestClient(app)

    def tearDown(self):
        with SessionLocal() as db:
            db.query(Student).filter(Student.id.in_(self.created)).delete(synchronize_session=False)
            db.commit()


def _register_payload(fixture: _SchoolFixture, roll: int, **overrides) -> dict:
    body = {
        "full_name": f"Phase Three {uuid.uuid4().hex[:6]}",
        "school_id": str(fixture.school_id),
        "class_section_id": str(fixture.section_id),
        "roll_number": roll,
        "guardian_name": "Test Guardian",
        "guardian_relation": "father",
        "guardian_phone": "9812345678",
        "login_phone": _fresh_phone(),
        "password": PW,
    }
    body.update(overrides)
    return body


class TestSelfRegistration(_Cleanup):
    @classmethod
    def setUpClass(cls):
        cls.fixture = _SchoolFixture()

    def _student(self, phone: str) -> Student:
        with SessionLocal() as db:
            return db.query(Student).filter(Student.phone_number == phone).one()

    def test_registers_with_a_phone_and_no_email(self):
        body = _register_payload(self.fixture, roll=70)
        r = self.client.post("/student/register", json=body)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertNotIn("verify", r.json()["message"].lower())
        student = self._student(body["login_phone"])
        self.created.append(student.id)
        self.assertIsNone(student.email)
        self.assertEqual(student.approval_status, "pending")

    def test_login_phone_is_required(self):
        body = _register_payload(self.fixture, roll=71)
        del body["login_phone"]
        self.assertEqual(self.client.post("/student/register", json=body).status_code, 422)

    def test_login_phone_must_be_an_indian_mobile(self):
        body = _register_payload(self.fixture, roll=72, login_phone="12345")
        self.assertEqual(self.client.post("/student/register", json=body).status_code, 422)

    def test_a_rejected_applicant_re_applies_by_phone_and_name(self):
        body = _register_payload(self.fixture, roll=73)
        self.assertEqual(self.client.post("/student/register", json=body).status_code, 201)
        first = self._student(body["login_phone"])
        self.created.append(first.id)
        with SessionLocal() as db:
            db.query(Student).filter(Student.id == first.id).update({"approval_status": "rejected"})
            db.commit()

        again = self.client.post("/student/register", json=body)
        self.assertEqual(again.status_code, 201, again.text)
        self.assertEqual(self._student(body["login_phone"]).id, first.id)  # same row, not a duplicate

    def test_someone_else_cannot_take_a_rejected_roll_slot(self):
        body = _register_payload(self.fixture, roll=74)
        self.assertEqual(self.client.post("/student/register", json=body).status_code, 201)
        first = self._student(body["login_phone"])
        self.created.append(first.id)
        with SessionLocal() as db:
            db.query(Student).filter(Student.id == first.id).update({"approval_status": "rejected"})
            db.commit()

        other = _register_payload(self.fixture, roll=74, full_name="Someone Else")
        r = self.client.post("/student/register", json=other)
        self.assertEqual(r.status_code, 409)

    def test_siblings_may_register_on_one_phone(self):
        phone = _fresh_phone()
        for roll in (75, 76):
            r = self.client.post("/student/register", json=_register_payload(self.fixture, roll=roll, login_phone=phone))
            self.assertEqual(r.status_code, 201, r.text)
        with SessionLocal() as db:
            ids = [s.id for s in db.query(Student).filter(Student.phone_number == phone)]
        self.created += ids
        self.assertEqual(len(ids), 2)


class TestClaim(_Cleanup):
    @classmethod
    def setUpClass(cls):
        cls.fixture = _SchoolFixture()

    def _imported_student(self, roll: int, phone: str | None) -> uuid.UUID:
        """A principal-imported shape: approved, no email, no password."""
        with SessionLocal() as db:
            principal = db.query(Teacher).filter(Teacher.role == "principal", Teacher.school_id == self.fixture.school_id).one()
            student = Student(
                school_id=self.fixture.school_id,
                full_name="Claim Me Student",
                phone_number=phone,
                approval_status="approved",
                is_active=True,
                approved_by=principal.id,
            )
            db.add(student)
            db.flush()
            db.add(
                StudentEnrollment(
                    student_id=student.id,
                    class_section_id=self.fixture.section_id,
                    academic_year_id=self.fixture.academic_year_id,
                    roll_number=roll,
                )
            )
            db.commit()
            self.created.append(student.id)
            return student.id

    def _claim(self, roll: int, phone: str):
        return self.client.post(
            "/student/claim",
            json={
                "school_id": str(self.fixture.school_id),
                "class_section_id": str(self.fixture.section_id),
                "roll_number": roll,
                "full_name": "Claim Me Student",
                "login_phone": phone,
                "password": PW,
            },
        )

    def test_claim_with_the_recorded_phone_sets_a_password_and_logs_in(self):
        phone = _fresh_phone()
        sid = self._imported_student(roll=80, phone=phone)
        self.assertEqual(self._claim(80, phone).status_code, 200)
        r = self.client.post(
            "/auth/login/phone",
            json={"phone": phone, "password": PW, "role": "student", "student_id": str(sid)},
        )
        self.assertEqual(r.status_code, 200, r.text)

    def test_claim_with_a_different_phone_is_refused_when_one_was_recorded(self):
        sid = self._imported_student(roll=81, phone=_fresh_phone())
        r = self._claim(81, _fresh_phone())
        self.assertEqual(r.status_code, 404)
        with SessionLocal() as db:
            self.assertIsNone(db.get(Student, sid).password_hash)

    def test_a_student_without_a_login_phone_cannot_be_stored(self):
        # 0032 makes the phone required at the database, so a phone-less row
        # (the old "claim sets the phone" shape) can't exist any more.
        with self.assertRaises(IntegrityError):
            self._imported_student(roll=82, phone=None)

    def test_claim_cannot_be_repeated(self):
        phone = _fresh_phone()
        self._imported_student(roll=83, phone=phone)
        self.assertEqual(self._claim(83, phone).status_code, 200)
        self.assertEqual(self._claim(83, phone).status_code, 404)


class TestImporter(_Cleanup):
    @classmethod
    def setUpClass(cls):
        cls.fixture = _SchoolFixture()

    def _row(self, line: int, roll: str, **extra) -> dict:
        row = {
            "line": line,
            "full_name": f"Import Student {uuid.uuid4().hex[:6]}",
            "grade": "Class 6",
            "section": "A",
            "roll_number": roll,
            "login_phone": _fresh_phone(),
            "password": IMPORT_PW,
        }
        row.update(extra)
        return row

    def _import(self, rows: list[dict], dry_run: bool):
        return self.client.post(
            "/principal/students/import",
            json={"rows": rows, "dry_run": dry_run},
            headers=_principal_headers(),
        )

    def _remember(self, phone: str) -> None:
        with SessionLocal() as db:
            self.created += [s.id for s in db.query(Student).filter(Student.phone_number == phone)]

    def test_a_row_without_a_login_phone_is_an_error_on_its_line(self):
        row = self._row(1, "90")
        del row["login_phone"]
        r = self._import([row], dry_run=True)
        self.assertEqual(r.status_code, 200, r.text)
        result = r.json()["rows"][0]
        self.assertEqual(result["status"], "error")
        self.assertIn("Login phone is missing", result["message"])

    def test_a_legacy_admission_column_is_ignored(self):
        row = self._row(1, "91", admission_number="ADM-2026-001")
        r = self._import([row], dry_run=True)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["rows"][0]["status"], "ready")

    def test_import_stores_the_login_phone_and_siblings_may_share_it(self):
        phone = _fresh_phone()
        rows = [self._row(1, "92", login_phone=phone), self._row(2, "93", login_phone=phone)]
        dry = self._import(rows, dry_run=True)
        self.assertEqual([r["status"] for r in dry.json()["rows"]], ["ready", "ready"])

        real = self._import(rows, dry_run=False)
        self.assertEqual([r["status"] for r in real.json()["rows"]], ["created", "created"], real.text)
        self._remember(phone)
        with SessionLocal() as db:
            stored = db.query(Student).filter(Student.phone_number == phone).all()
            self.assertEqual(len(stored), 2)
            self.assertTrue(all(s.approval_status == "approved" and s.password_hash for s in stored))
            self.assertTrue(all(verify_password(IMPORT_PW, s.password_hash) for s in stored))

    def test_a_row_without_a_password_is_an_error_on_its_line(self):
        row = self._row(1, "95")
        del row["password"]
        result = self._import([row], dry_run=True).json()["rows"][0]
        self.assertEqual(result["status"], "error")
        self.assertIn("Password is missing", result["message"])

    def test_a_weak_password_is_refused_and_never_echoed(self):
        result = self._import([self._row(1, "96", password="password123")], dry_run=True).json()["rows"][0]
        self.assertEqual(result["status"], "error")
        self.assertIn("too common", result["message"])
        self.assertNotIn("password123", result["message"])

    def test_a_malformed_phone_is_reported_not_stored(self):
        r = self._import([self._row(1, "94", login_phone="98765")], dry_run=True)
        self.assertEqual(r.json()["rows"][0]["status"], "error")
        self.assertIn("isn't a 10-digit mobile", r.json()["rows"][0]["message"])


class TestAdmission(_Cleanup):
    """The principal's one-student form. Same checks as a CSV row, approved at once."""

    @classmethod
    def setUpClass(cls):
        cls.fixture = _SchoolFixture()

    def _admit(self, **overrides):
        body = {
            "full_name": f"Admitted {uuid.uuid4().hex[:6]}",
            "grade": "Class 6",
            "section": "A",
            "roll_number": overrides.pop("roll_number", "80"),
            "login_phone": _fresh_phone(),
            "password": IMPORT_PW,
            "guardian_name": "Test Guardian",
            "guardian_relation": "father",
            "guardian_phone": "9812345678",
        }
        body.update(overrides)
        return self.client.post("/principal/students/admit", json=body, headers=_principal_headers())

    def test_an_admitted_student_is_approved_and_logs_in_with_phone_and_password(self):
        r = self._admit()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["status"], "created")
        with SessionLocal() as db:
            student = db.query(Student).filter(Student.full_name == r.json()["full_name"]).one()
            phone = student.phone_number
            self.created.append(student.id)
            self.assertEqual(student.approval_status, "approved")
            self.assertTrue(verify_password(IMPORT_PW, student.password_hash))
            student_id = student.id
        login = self.client.post(
            "/auth/login/phone",
            json={"phone": phone, "password": IMPORT_PW, "role": "student", "student_id": str(student_id)},
        )
        self.assertEqual(login.status_code, 200, login.text)

    def test_a_weak_password_is_refused(self):
        r = self._admit(password="letmein123")
        self.assertEqual(r.status_code, 422)
        self.assertIn("too common", r.json()["detail"])

    def test_the_same_roll_twice_is_a_conflict(self):
        first = self._admit(roll_number="81")
        self.assertEqual(first.status_code, 200, first.text)
        with SessionLocal() as db:
            self.created += [s.id for s in db.query(Student).filter(Student.full_name == first.json()["full_name"])]
        second = self._admit(roll_number="81")
        self.assertEqual(second.status_code, 409)
        self.assertIn("already belongs", second.json()["detail"])


class TestStudentSearch(_Cleanup):
    """The Admission screen's search: one student found by name, phone or email."""

    @classmethod
    def setUpClass(cls):
        cls.fixture = _SchoolFixture()

    def _admit(self, name: str, phone: str, roll: str, email: str | None = None) -> dict:
        body = {
            "full_name": name,
            "grade": "Class 6",
            "section": "A",
            "roll_number": roll,
            "login_phone": phone,
            "password": IMPORT_PW,
            "email": email,
        }
        r = self.client.post("/principal/students/admit", json=body, headers=_principal_headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.created.append(uuid.UUID(r.json()["student_id"]))
        return r.json()

    def _search(self, q: str):
        return self.client.get("/principal/students/search", params={"q": q}, headers=_principal_headers())

    def test_the_admit_response_carries_the_new_students_id(self):
        row = self._admit("Searchable Zephyr", _fresh_phone(), "70")
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(Student, uuid.UUID(row["student_id"])))

    def test_finds_by_name_phone_and_email_and_never_returns_a_password(self):
        phone = "+919876501234"
        self._admit("Anjali Quartz", phone, "71", email="anjali.quartz@example.org")
        by_name = self._search("quartz").json()
        by_phone = self._search("98765 01234").json()
        by_email = self._search("anjali.quartz@").json()
        for found in (by_name, by_phone, by_email):
            self.assertTrue(any(item["full_name"] == "Anjali Quartz" for item in found), found)
        self.assertNotIn("password", self._search("quartz").text.lower())

    def test_a_one_letter_query_returns_nothing(self):
        self.assertEqual(self._search("a").status_code, 422)

    def test_wildcards_are_matched_literally(self):
        self._admit("Percent Sign Tester", _fresh_phone(), "72")
        self.assertEqual(self._search("%%").json(), [])
        self.assertEqual(self._search("__").json(), [])

    def test_results_are_capped(self):
        self.assertLessEqual(len(self._search("the").json()), 25)


class TestPrincipalProfile(unittest.TestCase):
    def test_profile_shows_login_phone_and_no_admission_number(self):
        with SessionLocal() as db:
            aditi = db.query(Student).filter(Student.phone_number == ADITI_PHONE).one()
            sid = aditi.id
        r = TestClient(app).get(f"/principal/students/{sid}", headers=_principal_headers())
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["login_phone"], ADITI_PHONE)
        self.assertNotIn("admission_number", body)


if __name__ == "__main__":
    unittest.main()
