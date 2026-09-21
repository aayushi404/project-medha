import os
import sys
import uuid
import unittest
from unittest.mock import patch, AsyncMock
from datetime import date

# Ensure src is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from backend.absence_calls.service import DEFAULT_GUARDIAN_PHONE, queue_call_for_absence
from backend.absence_calls.telephony import TelephonyNotConfigured, PlacedCall
from backend.app import app
from backend.auth.service import create_access_token
from backend.core.config import settings
from backend.db.session import SessionLocal
from backend.db.models import AbsenceCall, AttendanceRecord, Teacher, Grade, School
from fastapi.testclient import TestClient

client = TestClient(app)

class TestAbsenceCalls(unittest.TestCase):

    def test_default_guardian_phone_value(self):
        """Verify the hardcoded default fallback number is updated to +917050020815."""
        self.assertEqual(DEFAULT_GUARDIAN_PHONE, "+917050020815")

    def test_queue_call_for_absence_disabled(self):
        """Test queue_call_for_absence when ABSENCE_CALLING_ENABLED=false."""
        original_enabled = settings.absence_calling_enabled
        db = SessionLocal()
        try:
            student = db.query(Teacher).filter(Teacher.role == "student").first()
            teacher = db.query(Teacher).filter(Teacher.role == "teacher").first()
            if not student or not teacher:
                self.skipTest("Database missing seed student/teacher records")

            # Clean up previous test attendance record for today if present
            existing = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.attendance_date == date.today()
            ).all()
            for r in existing:
                db.query(AbsenceCall).filter(AbsenceCall.attendance_record_id == r.id).delete()
                db.delete(r)
            db.commit()

            record = AttendanceRecord(
                student_id=student.id,
                marked_by_teacher_id=teacher.id,
                attendance_date=date.today(),
                status="absent",
            )
            db.add(record)
            db.commit()
            db.refresh(record)

            settings.absence_calling_enabled = False

            import asyncio
            asyncio.run(queue_call_for_absence(record.id))

            call = db.query(AbsenceCall).filter(AbsenceCall.attendance_record_id == record.id).first()
            self.assertIsNotNone(call)
            self.assertEqual(call.status, "completed")
            self.assertIn("High Fever", call.reason_text)

            # Cleanup
            db.delete(call)
            db.delete(record)
            db.commit()
        finally:
            settings.absence_calling_enabled = original_enabled
            db.close()

    @patch("backend.absence_calls.service.get_telephony_provider")
    def test_queue_call_for_absence_places_call(self, mock_get_provider):
        """Test queue_call_for_absence when calling is enabled and provider is mocked."""
        original_enabled = settings.absence_calling_enabled
        db = SessionLocal()
        try:
            student = db.query(Teacher).filter(Teacher.role == "student").first()
            teacher = db.query(Teacher).filter(Teacher.role == "teacher").first()
            if not student or not teacher:
                self.skipTest("Database missing seed student/teacher records")

            original_phone = student.guardian_phone
            student.guardian_phone = None
            db.commit()

            # Clean up previous test attendance record for today if present
            existing = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.attendance_date == date.today()
            ).all()
            for r in existing:
                db.query(AbsenceCall).filter(AbsenceCall.attendance_record_id == r.id).delete()
                db.delete(r)
            db.commit()

            record = AttendanceRecord(
                student_id=student.id,
                marked_by_teacher_id=teacher.id,
                attendance_date=date.today(),
                status="absent",
            )
            db.add(record)
            db.commit()
            db.refresh(record)

            mock_provider = AsyncMock()
            mock_provider.place_call.return_value = PlacedCall(provider_call_sid="test_sid_12345")
            mock_get_provider.return_value = mock_provider

            settings.absence_calling_enabled = True

            import asyncio
            asyncio.run(queue_call_for_absence(record.id))

            call = db.query(AbsenceCall).filter(AbsenceCall.attendance_record_id == record.id).first()
            self.assertIsNotNone(call)
            self.assertEqual(call.status, "dialing")
            self.assertEqual(call.provider_call_sid, "test_sid_12345")
            self.assertEqual(call.guardian_phone, "+917050020815")

            # Restore & Cleanup
            student.guardian_phone = original_phone
            db.delete(call)
            db.delete(record)
            db.commit()
        finally:
            settings.absence_calling_enabled = original_enabled
            db.close()

    def test_list_absence_calls_api_unauthorized(self):
        """Test GET /absence-calls endpoint without auth token returns 401."""
        response = client.get("/absence-calls")
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
