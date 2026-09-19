import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class AbsenceCall(Base):
    """One outbound guardian call per marked-absent attendance record. Created
    the instant a teacher marks a student absent (see
    backend.attendance.service.mark_day), then driven forward by the
    telephony provider's status webhook and the voicebot websocket -- see
    backend.absence_calls.service."""

    __tablename__ = "absence_calls"
    __table_args__ = (
        Index("idx_absence_calls_student", "student_id", "created_at"),
        Index("idx_absence_calls_provider_sid", "provider_call_sid"),
        CheckConstraint(
            "status IN ("
            "'queued', 'no_guardian_phone', 'not_configured', 'dialing', "
            "'ringing', 'in_progress', 'completed', 'no_answer', 'failed'"
            ")",
            name="chk_absence_call_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    attendance_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attendance_records.id", ondelete="CASCADE")
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    # snapshot at call time -- a later guardian_phone edit shouldn't rewrite history
    guardian_phone: Mapped[str | None]
    status: Mapped[str] = mapped_column(server_default="queued")
    provider_call_sid: Mapped[str | None]
    # the AI's one-line takeaway ("Guardian says: fever, will be back tomorrow")
    reason_text: Mapped[str | None]
    transcript: Mapped[str | None]
    failure_reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    completed_at: Mapped[datetime | None]
