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
from backend.db.models import AbsenceCall, AttendanceRecord, Student, Teacher
from backend.db.session import SessionLocal

logger = logging.getLogger("backend.absence_calls")

_TERMINAL_STATUSES = ("completed", "no_answer", "failed", "no_guardian_phone", "not_configured")

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
    own DB session (the request's session is closed by then).

    Every outcome is recorded truthfully: a student with no guardian number
    gets `no_guardian_phone`, calling switched off/unconfigured gets
    `not_configured`, a provider failure gets `failed` with a reason. Nothing
    here ever invents a guardian statement."""
    db = SessionLocal()
    try:
        record = db.get(AttendanceRecord, record_id)
        if record is None or record.status != "absent":
            return  # marked back to present before we got to it

        student = db.get(Student, record.student_id)
        # ABSENCE_CALL_FORCE_PHONE is a demo-only override (config refuses it in production)
        guardian_phone = settings.absence_call_force_phone or (student.guardian_phone if student else None)
        call = AbsenceCall(
            attendance_record_id=record.id,
            student_id=record.student_id,
            guardian_phone=guardian_phone,
        )
        db.add(call)
        db.commit()
        db.refresh(call)

        if not guardian_phone:
            call.status = "no_guardian_phone"
            call.failure_reason = "No guardian phone number on file."
            db.commit()
            return

        if not settings.absence_calling_enabled:
            call.status = "not_configured"
            call.failure_reason = "Automated guardian calling is switched off."
            db.commit()
            return

        try:
            provider = get_telephony_provider()
            placed = await provider.place_call(to_number=guardian_phone, correlation_id=str(call.id))
        except TelephonyNotConfigured:
            call.status = "not_configured"
            call.failure_reason = "Telephony provider is not configured."
            db.commit()
            return
        except TelephonyError as exc:
            logger.info("absence_call_failed call_id=%s error=%s", call.id, exc)
            call.status = "failed"
            call.failure_reason = "The call could not be placed."
            call.completed_at = datetime.now(timezone.utc)
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
    # A finished call never goes backwards (a late or replayed webhook can't reopen it)
    if call.status in _TERMINAL_STATUSES:
        return
    call.status = mapped
    call.updated_at = datetime.now(timezone.utc)
    if mapped in ("completed", "no_answer", "failed"):
        call.completed_at = datetime.now(timezone.utc)
    db.commit()


def save_transcript_and_reason(
    db, call: AbsenceCall, *, transcript: str, reason_text: str
) -> None:
    # The transcript is write-once: a replayed/late stream can't overwrite it. (A
    # webhook may already have marked the call `completed` just before the
    # voicebot finishes summarizing, so a terminal status alone isn't a reason to skip.)
    if call.transcript is not None or call.status in ("no_guardian_phone", "not_configured"):
        return
    call.transcript = transcript
    call.reason_text = reason_text
    call.status = "completed"
    call.completed_at = datetime.now(timezone.utc)
    db.commit()


def list_recent_for_teacher(
    db, teacher: Teacher, *, class_section_id: uuid.UUID | None = None, limit: int = 50
) -> list[tuple[AbsenceCall, Student, AttendanceRecord]]:
    from backend.core.section_access import assert_can_act_on_section, teacher_section_ids
    from backend.db.models import StudentEnrollment

    query = (
        db.query(AbsenceCall, Student, AttendanceRecord)
        .join(Student, Student.id == AbsenceCall.student_id)
        .join(AttendanceRecord, AttendanceRecord.id == AbsenceCall.attendance_record_id)
        .filter(Student.school_id == teacher.school_id)
    )
    if class_section_id is not None:
        assert_can_act_on_section(db, teacher, class_section_id)
        query = query.join(
            StudentEnrollment,
            (StudentEnrollment.student_id == Student.id)
            & (StudentEnrollment.left_on.is_(None))
            & (StudentEnrollment.class_section_id == class_section_id),
        )
    elif teacher.role != "principal":
        # no section chosen: a teacher sees only calls about their own classes'
        # students (guardian phones and transcripts are sensitive); a principal
        # sees the whole school
        section_ids = teacher_section_ids(db, teacher)
        if not section_ids:
            return []
        query = query.join(
            StudentEnrollment,
            (StudentEnrollment.student_id == Student.id)
            & (StudentEnrollment.left_on.is_(None))
            & (StudentEnrollment.class_section_id.in_(section_ids)),
        )
    return (
        query.order_by(AbsenceCall.created_at.desc()).limit(limit).all()
    )
