import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class AttendanceRecord(Base):
    """One row per (student, day). A teacher marks a whole grade's roster in
    one sitting (see attendance/service.py), but a student has exactly one
    status per day regardless of who marked it -- `marked_by_teacher_id` is
    audit-only, not a scoping key."""

    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("student_id", "attendance_date", name="uq_attendance_student_date"),
        Index("idx_attendance_marked_by_date", "marked_by_teacher_id", "attendance_date"),
        CheckConstraint("status IN ('present', 'absent')", name="chk_attendance_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    marked_by_teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )
    attendance_date: Mapped[date_]
    status: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
