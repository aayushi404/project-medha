import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class Homework(Base):
    """One assignment, set by a teacher for a whole grade at their school.
    Per-student completion lives in `HomeworkStatus` -- rows there are
    created lazily (see `homework/service.py`), same "roster + status join"
    shape as `AttendanceRecord`."""

    __tablename__ = "homework"
    __table_args__ = (Index("idx_homework_grade", "school_id", "grade_id", text("created_at DESC")),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    title: Mapped[str]
    description: Mapped[str | None]
    due_date: Mapped[date_ | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class HomeworkStatus(Base):
    """A student's own "done / not done" flag for one homework item --
    self-reported by the student, not graded by the teacher (V1 scope; see
    the module docstring in `homework/service.py` for what's deliberately
    deferred)."""

    __tablename__ = "homework_status"
    __table_args__ = (UniqueConstraint("homework_id", "student_id", name="uq_homework_status_student"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    homework_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("homework.id", ondelete="CASCADE"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    done: Mapped[bool] = mapped_column(server_default=text("false"))
    done_at: Mapped[datetime | None]
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
