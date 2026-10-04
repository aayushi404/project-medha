"""Phase 2 phone-login tests (docs/phone-login-plan.md): the student profile
picker, phone + password login for teachers and students, email login
restricted to principal/admin, staff-issued one-time reset codes, and the
approval gate for phone-only accounts.

Runs against the local dev database with seed_demo_accounts data. Anything a
test changes (passwords, phone numbers) is put back in tearDown.
"""

import os
import sys
import unittest
import uuid
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app import app
from backend.db.models import AccountAuditEvent, ApprovalEvent, Student, Teacher
from backend.db.session import SessionLocal

PW = "Password@123"
PRINCIPAL_PHONE = "+919876543210"
ANITA_PHONE = "+919876543211"  # subject teacher for Class 6 -- not the class teacher
RAJESH_PHONE = "+919876543212"  # class teacher of Class 6 A
KAVITA_PHONE = "+919876543215"
ADITI_PHONE = "+919800000001"  # Class 6 A, roll 1
AMAN_PHONE = "+919800000002"  # Class 6 A, roll 2
ANANYA_PHONE = "+919800000005"  # Class 8 A
SIBLING_PHONE = "+919700000777"  # not used by any seed account


# Throttle counters persist in the database between runs. These tests use the
# same phones and the same test client address every time, so each test starts
# from a clean slate for the scopes it exercises -- otherwise a second run
# inside the 15-minute window is refused before it tests anything.
_THROTTLE_SCOPES = [
    "phone_lookup_ip",
    "phone_lookup",
    "reset_code_ip",
    "reset_code_phone",
    "login_ip_identifier",
    "login_ip",
    "login_identifier",
]


def _reset_throttles() -> None:
    with SessionLocal() as db:
        db.execute(text("DELETE FROM auth_throttle WHERE scope = ANY(:s)"), {"s": _THROTTLE_SCOPES})
        db.commit()


def _fresh_phone() -> str:
    return f"+919{uuid.uuid4().int % 10**9:09d}"


def _phone_login(client, phone, password, role, student_id=None):
    body = {"phone": phone, "password": password, "role": role}
    if student_id is not None:
        body["student_id"] = str(student_id)
    return client.post("/auth/login/phone", json=body)


def _token_for_teacher(phone: str) -> dict:
    r = _phone_login(TestClient(app), phone, PW, "teacher")
    if r.status_code != 200:
        raise unittest.SkipTest(f"seed teacher {phone} unavailable ({r.status_code})")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _token_for_principal() -> dict:
    r = TestClient(app).post(
        "/auth/login", json={"email": "principal.patna@medhabihar.org", "password": PW, "role": "principal"}
    )
    if r.status_code != 200:
        raise unittest.SkipTest("seed principal unavailable")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _profile_id(phone: str, full_name: str) -> str:
    r = TestClient(app).post("/auth/student/lookup", json={"phone": phone})
    for profile in r.json()["profiles"]:
        if profile["full_name"] == full_name:
            return profile["id"]
    raise unittest.SkipTest(f"seed student {full_name} not on {phone}")


def _teacher_by_phone(db, phone: str) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.phone_number == phone).first()
    if teacher is None:
        raise unittest.SkipTest(f"seed teacher on {phone} missing")
    return teacher


class TestStudentPicker(unittest.TestCase):
    """Aditi and Aman are moved onto one shared number for the duration of
    these tests, so the picker has real siblings to show."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        with SessionLocal() as db:
            cls.originals = {}
            for name in ("Aditi Sharma", "Aman Kumar"):
                s = db.query(Student).filter(Student.full_name == name).one()
                cls.originals[s.id] = s.phone_number
                s.phone_number = SIBLING_PHONE
            db.commit()

    @classmethod
    def tearDownClass(cls):
        with SessionLocal() as db:
            for sid, phone in cls.originals.items():
                db.query(Student).filter(Student.id == sid).one().phone_number = phone
            db.commit()

    def setUp(self):
        _reset_throttles()

    def test_lookup_returns_every_profile_on_the_number(self):
        r = self.client.post("/auth/student/lookup", json={"phone": SIBLING_PHONE})
        self.assertEqual(r.status_code, 200)
        profiles = {p["full_name"]: p for p in r.json()["profiles"]}
        self.assertEqual(set(profiles), {"Aditi Sharma", "Aman Kumar"})
        self.assertEqual(profiles["Aditi Sharma"]["class_label"], "Class 6, Section A")
        self.assertEqual(profiles["Aditi Sharma"]["roll_number"], "1")
        # the picker shows only what it needs -- no guardian or contact fields
        self.assertEqual(set(profiles["Aditi Sharma"]), {"id", "full_name", "class_label", "roll_number"})
        self.assertNotIn("guardian_phone", profiles["Aditi Sharma"])
        self.assertNotIn("email", profiles["Aditi Sharma"])

    def test_each_sibling_logs_in_with_their_own_password(self):
        aditi = _profile_id(SIBLING_PHONE, "Aditi Sharma")
        aman = _profile_id(SIBLING_PHONE, "Aman Kumar")
        self.assertEqual(_phone_login(self.client, SIBLING_PHONE, PW, "student", aditi).status_code, 200)
        self.assertEqual(_phone_login(self.client, SIBLING_PHONE, PW, "student", aman).status_code, 200)
        # the same password is accepted here only because the seed gives everyone one;
        # a wrong one must fail for either sibling
        self.assertEqual(_phone_login(self.client, SIBLING_PHONE, "Wrong-pass-123", "student", aditi).status_code, 401)

    def test_profile_from_another_number_is_refused(self):
        # a real, correct password and a real student -- but on a different number
        ananya = _profile_id(ANANYA_PHONE, "Ananya Kumari")
        r = _phone_login(self.client, SIBLING_PHONE, PW, "student", ananya)
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()["detail"], "Invalid phone number or password.")

    def test_unknown_number_returns_an_empty_list(self):
        r = self.client.post("/auth/student/lookup", json={"phone": _fresh_phone()})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"profiles": []})

    def test_student_login_needs_a_profile_and_teacher_login_must_not_have_one(self):
        r = self.client.post("/auth/login/phone", json={"phone": SIBLING_PHONE, "password": PW, "role": "student"})
        self.assertEqual(r.status_code, 422)
        r = _phone_login(self.client, ANITA_PHONE, PW, "teacher", uuid.uuid4())
        self.assertEqual(r.status_code, 422)

    def test_lookup_is_throttled_per_phone(self):
        phone = _fresh_phone()
        codes = [self.client.post("/auth/student/lookup", json={"phone": phone}).status_code for _ in range(11)]
        self.assertEqual(codes[:10], [200] * 10)
        self.assertEqual(codes[10], 429)


class TestTeacherPhoneLogin(unittest.TestCase):
    def setUp(self):
        _reset_throttles()
        self.client = TestClient(app)

    def test_teacher_logs_in_with_phone_and_password(self):
        r = _phone_login(self.client, ANITA_PHONE, PW, "teacher")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access_token", r.json())

    def test_principal_phone_on_the_teacher_tab_is_wrong_portal(self):
        r = _phone_login(self.client, PRINCIPAL_PHONE, PW, "teacher")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()["detail"]["code"], "ROLE_MISMATCH")
        self.assertEqual(r.json()["detail"]["actual_role"], "principal")

    def test_teacher_email_on_the_principal_tab_is_wrong_portal(self):
        # the password is correct, so the wrong-portal answer reveals nothing new
        r = self.client.post("/auth/login", json={"email": "anita.science@medhabihar.org", "password": PW})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json()["detail"]["actual_role"], "teacher")

    def test_principal_still_logs_in_with_email(self):
        r = self.client.post(
            "/auth/login", json={"email": "principal.patna@medhabihar.org", "password": PW, "role": "principal"}
        )
        self.assertEqual(r.status_code, 200)


class TestStaffResetCodes(unittest.TestCase):
    """Kavita's and Aditi's passwords are restored in tearDown, whatever a
    test did to them."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        with SessionLocal() as db:
            kavita = _teacher_by_phone(db, KAVITA_PHONE)
            aditi = db.query(Student).filter(Student.phone_number == ADITI_PHONE).one()
            cls.saved = {"kavita": (kavita.id, kavita.password_hash), "aditi": (aditi.id, aditi.password_hash)}

    @classmethod
    def tearDownClass(cls):
        with SessionLocal() as db:
            kavita_id, kavita_hash = cls.saved["kavita"]
            db.query(Teacher).filter(Teacher.id == kavita_id).one().password_hash = kavita_hash
            aditi_id, aditi_hash = cls.saved["aditi"]
            db.query(Student).filter(Student.id == aditi_id).one().password_hash = aditi_hash
            db.commit()

    def setUp(self):
        _reset_throttles()

    def _issue_for_kavita(self) -> str:
        kavita_id = self.saved["kavita"][0]
        r = TestClient(app).post(f"/principal/teachers/{kavita_id}/reset-code", headers=_token_for_principal())
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["code"]

    def test_principal_issues_a_code_the_teacher_redeems_once(self):
        code = self._issue_for_kavita()
        self.assertRegex(code, r"^[2-9A-HJKMNP-TV-Z]{5}-[2-9A-HJKMNP-TV-Z]{5}$")

        payload = {"phone": KAVITA_PHONE, "role": "teacher", "code": code, "new_password": "Fresh-Pass-2026"}
        self.assertEqual(self.client.post("/auth/reset-with-code", json=payload).status_code, 200)
        self.assertEqual(_phone_login(self.client, KAVITA_PHONE, "Fresh-Pass-2026", "teacher").status_code, 200)
        self.assertEqual(_phone_login(self.client, KAVITA_PHONE, PW, "teacher").status_code, 401)
        # single use
        self.assertEqual(self.client.post("/auth/reset-with-code", json=payload).status_code, 400)

    def test_a_wrong_code_gets_the_same_answer_as_an_expired_one(self):
        self._issue_for_kavita()
        bad = self.client.post(
            "/auth/reset-with-code",
            json={"phone": KAVITA_PHONE, "role": "teacher", "code": "ZZZZZ-ZZZZZ", "new_password": "Fresh-Pass-2026"},
        )
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.json()["detail"], "That code is invalid or has expired.")

    def test_an_expired_code_is_refused_with_the_generic_answer(self):
        from datetime import datetime, timedelta, timezone

        from backend.auth.hashing import hash_password
        from backend.db.models import AuthToken

        code = self._issue_for_kavita()
        kavita_id = self.saved["kavita"][0]
        # other tests in this class change Kavita's password, so pin a known one
        with SessionLocal() as db:
            db.query(Teacher).filter(Teacher.id == kavita_id).one().password_hash = hash_password("Known-Pass-2026")
            db.commit()
        with SessionLocal() as db:
            db.query(AuthToken).filter(
                AuthToken.teacher_id == kavita_id,
                AuthToken.purpose == "reset_password",
                AuthToken.used_at.is_(None),
            ).update({AuthToken.expires_at: datetime.now(timezone.utc) - timedelta(minutes=1)}, synchronize_session=False)
            db.commit()
        r = self.client.post(
            "/auth/reset-with-code",
            json={"phone": KAVITA_PHONE, "role": "teacher", "code": code, "new_password": "Fresh-Pass-2026"},
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["detail"], "That code is invalid or has expired.")
        # the expired code changed nothing: the pinned password still works
        self.assertEqual(_phone_login(self.client, KAVITA_PHONE, "Known-Pass-2026", "teacher").status_code, 200)

    def test_a_code_for_one_account_cannot_reset_another(self):
        code = self._issue_for_kavita()
        r = self.client.post(
            "/auth/reset-with-code",
            json={"phone": RAJESH_PHONE, "role": "teacher", "code": code, "new_password": "Fresh-Pass-2026"},
        )
        self.assertEqual(r.status_code, 400)
        # and Kavita's code still works for Kavita -- the failed attempt didn't spend it
        r = self.client.post(
            "/auth/reset-with-code",
            json={"phone": KAVITA_PHONE, "role": "teacher", "code": code, "new_password": "Fresh-Pass-2026"},
        )
        self.assertEqual(r.status_code, 200)

    def test_a_subject_teacher_cannot_issue_a_student_code(self):
        aditi_id = _profile_id(ADITI_PHONE, "Aditi Sharma")
        r = TestClient(app).post(f"/teacher/students/{aditi_id}/reset-code", headers=_token_for_teacher(ANITA_PHONE))
        self.assertEqual(r.status_code, 403)

    def test_class_teacher_issues_a_student_code_which_is_audited(self):
        aditi_id = _profile_id(ADITI_PHONE, "Aditi Sharma")
        staff = _token_for_teacher(RAJESH_PHONE)
        r = TestClient(app).post(f"/teacher/students/{aditi_id}/reset-code", headers=staff)
        self.assertEqual(r.status_code, 200, r.text)
        code = r.json()["code"]

        with SessionLocal() as db:
            rajesh = _teacher_by_phone(db, RAJESH_PHONE)
            event = (
                db.query(AccountAuditEvent)
                .filter(
                    AccountAuditEvent.subject_student_id == uuid.UUID(aditi_id),
                    AccountAuditEvent.action == "reset_code_issued",
                )
                .order_by(AccountAuditEvent.created_at.desc())
                .first()
            )
            self.assertIsNotNone(event)
            self.assertEqual(event.actor_teacher_id, rajesh.id)

        r = self.client.post(
            "/auth/reset-with-code",
            json={
                "phone": ADITI_PHONE,
                "role": "student",
                "student_id": aditi_id,
                "code": code,
                "new_password": "Fresh-Pass-2026",
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            _phone_login(self.client, ADITI_PHONE, "Fresh-Pass-2026", "student", aditi_id).status_code, 200
        )

    def test_reset_code_is_refused_for_the_wrong_profile(self):
        # Aditi's code, redeemed against Aman's profile on the same number
        aditi_id = _profile_id(ADITI_PHONE, "Aditi Sharma")
        aman_id = _profile_id(AMAN_PHONE, "Aman Kumar")
        code = TestClient(app).post(
            f"/teacher/students/{aditi_id}/reset-code", headers=_token_for_teacher(RAJESH_PHONE)
        ).json()["code"]
        r = self.client.post(
            "/auth/reset-with-code",
            json={
                "phone": ADITI_PHONE,
                "role": "student",
                "student_id": aman_id,
                "code": code,
                "new_password": "Fresh-Pass-2026",
            },
        )
        self.assertEqual(r.status_code, 400)


class TestPhoneOnlyApprovalGate(unittest.TestCase):
    """Teachers registered without an email are approved by their principal
    alone while the OTP flag is off, and wait for a phone verification when
    it is on."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        with SessionLocal() as db:
            school_id = db.query(Student).filter(Student.phone_number == ADITI_PHONE).one().school_id
        cls.school_id = str(school_id)
        cls.created: list[uuid.UUID] = []

    @classmethod
    def tearDownClass(cls):
        with SessionLocal() as db:
            db.query(ApprovalEvent).filter(ApprovalEvent.subject_user_id.in_(cls.created)).delete(synchronize_session=False)
            db.query(Teacher).filter(Teacher.id.in_(cls.created)).delete(synchronize_session=False)
            db.commit()

    def setUp(self):
        _reset_throttles()

    def _register(self, phone: str) -> str:
        r = self.client.post(
            "/auth/register",
            json={
                "role": "teacher",
                "full_name": "Test Phoneonly",
                "password": "Teacher-Pass-2026",
                "mobile_number": phone,
                "school_id": self.school_id,
                "employee_code": f"TST-{uuid.uuid4().hex[:6].upper()}",
            },
        )
        self.assertEqual(r.status_code, 201, r.text)
        with SessionLocal() as db:
            teacher = db.query(Teacher).filter(Teacher.phone_number == phone).one()
            self.assertIsNone(teacher.email)  # registered without an email
            self.created.append(teacher.id)
            return str(teacher.id)

    def test_phone_only_teacher_is_approved_while_otp_is_off(self):
        teacher_id = self._register(_fresh_phone())
        r = TestClient(app).post(f"/principal/teachers/{teacher_id}/approve", headers=_token_for_principal())
        self.assertEqual(r.status_code, 200, r.text)

    def test_phone_only_teacher_waits_for_phone_verification_when_otp_is_on(self):
        teacher_id = self._register(_fresh_phone())
        with patch("backend.core.config.settings.phone_otp_required", True):
            r = TestClient(app).post(f"/principal/teachers/{teacher_id}/approve", headers=_token_for_principal())
        self.assertEqual(r.status_code, 409)
        self.assertIn("verified their phone", r.json()["detail"])


if __name__ == "__main__":
    unittest.main()
