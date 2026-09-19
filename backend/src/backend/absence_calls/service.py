"""Orchestrates one absence call end to end: fired as a background task the
instant backend.attendance.service.mark_day newly marks a student absent, it
creates the AbsenceCall row, resolves the guardian's number, and asks the
telephony provider to dial it. The rest of the conversation happens later,
driven by Exotel's status-callback webhook and voicebot websocket (see
backend.absence_calls.router) -- this module only owns the row's lifecycle
and the "should we even try" checks, not the live call audio.
"""

import logging
import uuid
from datetime import datetime, timezone

from backend.absence_calls.telephony import (
    TelephonyError,
    TelephonyNotConfigured,
    get_telephony_provider,
)
from backend.core.config import settings
from backend.db.models import AbsenceCall, AttendanceRecord, Teacher
from backend.db.session import SessionLocal

logger = logging.getLogger("backend.absence_calls")

# Fallback guardian number, used whenever a student has no guardian_phone on
# file, so the calling pipeline can actually be exercised before every
# student has a real number recorded. Remove once guardian numbers are
# collected for the whole roster.
DEFAULT_GUARDIAN_PHONE = "+919572704600"

# Call-status values from both providers -- Exotel
# (https://developer.exotel.com/api/make-a-call-api) and Twilio
# (CallStatus, https://www.twilio.com/docs/voice/twiml) use overlapping
# wording for the same states, so one map covers both; "initiated" is
# Twilio-only (Exotel has no equivalent intermediate value).
_PROVIDER_STATUS_MAP = {
    "queued": "dialing",
    "initiated": "dialing",
    "in-progress": "in_progress",
    "ringing": "ringing",
    "completed": "completed",
    "failed": "failed",
    "busy": "no_answer",
    "no-answer": "no_answer",
    "canceled": "failed",
}


async def queue_call_for_absence(record_id: uuid.UUID) -> None:
    """The BackgroundTasks entrypoint -- see attendance/service.py::mark_day.
    Runs after the HTTP response has already gone back to the teacher, on its
    own DB session (the request's session is closed by then)."""
    db = SessionLocal()
    try:
        record = db.get(AttendanceRecord, record_id)
        if record is None or record.status != "absent":
            return  # marked back to present before we got to it

        student = db.get(Teacher, record.student_id)
        guardian_phone = (
            settings.absence_call_force_phone
            or (student.guardian_phone if student else None)
            or DEFAULT_GUARDIAN_PHONE
        )
        call = AbsenceCall(
            attendance_record_id=record.id,
            student_id=record.student_id,
            guardian_phone=guardian_phone,
        )
        db.add(call)
        db.commit()
        db.refresh(call)

        if not settings.absence_calling_enabled:
            call.status = "not_configured"
            call.failure_reason = "Absence calling is disabled (ABSENCE_CALLING_ENABLED=false)."
            db.commit()
            return

        if student is None:
            call.status = "no_guardian_phone"
            db.commit()
            return

        try:
            provider = get_telephony_provider()
            placed = await provider.place_call(
                to_number=guardian_phone, correlation_id=str(call.id)
            )
        except TelephonyNotConfigured as exc:
            call.status = "not_configured"
            call.failure_reason = str(exc)
            db.commit()
            return
        except TelephonyError as exc:
            logger.warning("absence_call_place_failed call_id=%s error=%s", call.id, exc)
            call.status = "failed"
            call.failure_reason = str(exc)
            db.commit()
            return

        call.status = "dialing"
        call.provider_call_sid = placed.provider_call_sid
        db.commit()
    except Exception:
        logger.exception("absence_call_workflow_error record_id=%s", record_id)
        db.rollback()
    finally:
        db.close()


def get_call(db, call_id: uuid.UUID) -> AbsenceCall | None:
    return db.get(AbsenceCall, call_id)


def update_status_from_provider_status(db, call: AbsenceCall, provider_status: str) -> None:
    mapped = _PROVIDER_STATUS_MAP.get(provider_status.lower())
    if mapped is None:
        return
    call.status = mapped
    call.updated_at = datetime.now(timezone.utc)
    if mapped in ("completed", "no_answer", "failed"):
        call.completed_at = datetime.now(timezone.utc)
    db.commit()


def save_transcript_and_reason(
    db, call: AbsenceCall, *, transcript: str, reason_text: str
) -> None:
    call.transcript = transcript
    call.reason_text = reason_text
    call.status = "completed"
    call.completed_at = datetime.now(timezone.utc)
    db.commit()


def list_recent_for_teacher(
    db, teacher: Teacher, *, grade_id: uuid.UUID | None = None, limit: int = 50
) -> list[tuple[AbsenceCall, Teacher, AttendanceRecord]]:
    query = (
        db.query(AbsenceCall, Teacher, AttendanceRecord)
        .join(Teacher, Teacher.id == AbsenceCall.student_id)
        .join(AttendanceRecord, AttendanceRecord.id == AbsenceCall.attendance_record_id)
        .filter(Teacher.school_id == teacher.school_id, Teacher.role == "student")
    )
    if grade_id is not None:
        query = query.filter(Teacher.grade_id == grade_id)
    return (
        query.order_by(AbsenceCall.created_at.desc()).limit(limit).all()
    )
