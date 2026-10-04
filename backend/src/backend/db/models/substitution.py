"""Daily cover (docs/phase-2/principal_timetable_substitution_architecture.md).

The base timetable (`timetable_cells`) is the plan and is never edited for a
day's absence. What happened on a given date is recorded here and overrides the
plan when the day's board is read.
"""

import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class TeacherAbsence(Base):
    """One row per teacher per date. A multi-day leave writes one row per day."""

    __tablename__ = "teacher_absences"
    __table_args__ = (
        UniqueConstraint("teacher_id", "date"),
        Index("idx_absences_school_date", "school_id", "date"),
        CheckConstraint(
            "is_full_day OR (from_period_number IS NOT NULL AND to_period_number IS NOT NULL "
            "AND from_period_number <= to_period_number)",
            name="chk_absence_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    date: Mapped[date_]
    is_full_day: Mapped[bool] = mapped_column(server_default=text("true"))
    # used only when is_full_day is false ("left after lunch")
    from_period_number: Mapped[int | None]
    to_period_number: Mapped[int | None]
    reason: Mapped[str | None]  # sick | leave | official_duty | training
    note: Mapped[str | None]
    marked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class PeriodSubstitution(Base):
    """What actually happened in one period on one date, overriding the plan."""

    __tablename__ = "period_substitutions"
    __table_args__ = (
        UniqueConstraint("date", "timetable_cell_id", name="uq_sub_cell_date"),
        # A substitute cannot be in two places at once on the same date.
        Index(
            "uq_sub_teacher_slot",
            "date",
            "substitute_teacher_id",
            "period_slot_id",
            unique=True,
            postgresql_where=text("substitute_teacher_id IS NOT NULL AND status = 'assigned'"),
        ),
        Index("idx_subs_school_date", "school_id", "date"),
        CheckConstraint("status IN ('assigned','self_study','cancelled')", name="chk_sub_status"),
        CheckConstraint(
            "status <> 'assigned' OR substitute_teacher_id IS NOT NULL", name="chk_sub_teacher"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    date: Mapped[date_]
    # Goes null if the timetable is republished; the denormalised columns below
    # keep the record readable.
    timetable_cell_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetable_cells.id", ondelete="SET NULL")
    )
    class_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE")
    )
    period_slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("period_slots.id", ondelete="CASCADE")
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    original_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    substitute_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(server_default=text("'assigned'"))
    note: Mapped[str | None]
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class DailyTimetable(Base):
    """The final timetable for one school day, as the principal published it.
    A snapshot: the teachers' board reads this, so it doesn't move while the
    principal is still working on tomorrow. Finalizing again replaces it."""

    __tablename__ = "daily_timetables"
    __table_args__ = (UniqueConstraint("school_id", "date"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    date: Mapped[date_]
    timetable_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="SET NULL")
    )
    version: Mapped[int] = mapped_column(server_default=text("1"))
    payload: Mapped[dict] = mapped_column(JSONB)
    finalized_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    finalized_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
