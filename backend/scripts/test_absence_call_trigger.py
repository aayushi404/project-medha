"""Script to test triggering the absence call feature for +917050020815."""

import sys
import os
import asyncio
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from backend.db.session import SessionLocal
from backend.db.models import Teacher, AttendanceRecord, AbsenceCall
from backend.absence_calls.service import queue_call_for_absence, DEFAULT_GUARDIAN_PHONE
from backend.core.config import settings

async def main():
    print(f"=== ABSENCE CALL FEATURE VERIFICATION ===")
    print(f"Default fallback guardian phone: {DEFAULT_GUARDIAN_PHONE}")
    print(f"Absence calling enabled: {settings.absence_calling_enabled}")
    print(f"Telephony provider: {settings.telephony_provider}")
    
    db = SessionLocal()
    try:
        student = db.query(Teacher).filter(Teacher.role == "student").first()
        teacher = db.query(Teacher).filter(Teacher.role == "teacher").first()
        
        if not student or not teacher:
            print("ERROR: Could not find seed student/teacher in DB.")
            return
            
        print(f"Testing with student: {student.full_name} (ID: {student.id})")
        print(f"Student guardian phone in DB: {student.guardian_phone}")
        
        # Create a test attendance record for today
        rec = AttendanceRecord(
            student_id=student.id,
            marked_by_teacher_id=teacher.id,
            attendance_date=date.today(),
            status="absent"
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        print(f"Created AttendanceRecord (ID: {rec.id}) marked ABSENT for today.")
        
        # Trigger the automated queue_call_for_absence workflow
        print("Triggering queue_call_for_absence background workflow...")
        await queue_call_for_absence(rec.id)
        
        # Inspect created AbsenceCall row
        call = db.query(AbsenceCall).filter(AbsenceCall.attendance_record_id == rec.id).first()
        if call:
            print("\n--- AbsenceCall Record Created ---")
            print(f"Call ID: {call.id}")
            print(f"Target Guardian Phone: {call.guardian_phone}")
            print(f"Status: {call.status}")
            print(f"Failure / Config Reason: {call.failure_reason}")
            print(f"Provider Call SID: {call.provider_call_sid}")
        else:
            print("ERROR: No AbsenceCall record created!")
            
        # Cleanup test record
        if call:
            db.delete(call)
        db.delete(rec)
        db.commit()
        print("Cleaned up test DB records.")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
