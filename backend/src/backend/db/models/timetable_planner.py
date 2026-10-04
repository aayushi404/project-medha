"""Principal's timetable planner (docs/phase-2/principal_timetable_planner.md).

Three tables, all new. They sit beside the older per-grade `timetable_entries`
(see models/timetable.py), which the student and teacher views still read.
The planner's cell table is `timetable_cells` for that reason: the plan's name
`timetable_entries` is already taken.
"""

import uuid
from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class PeriodSlot(Base):
    """A time slot in the school day. Keyed by day, so a school can run a
    different structure on Saturday without special-casing. `day_of_week` is
    1 = Monday .. 6 = Saturday."""

    __tablename__ = "period_slots"
    __table_args__ = (
        UniqueConstraint("school_id", "day_of_week", "period_number"),
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_slot_dow"),
        CheckConstraint("period_number >= 1", name="chk_slot_period"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    day_of_week: Mapped[int]
    period_number: Mapped[int]
    label: Mapped[str | None]  # "P1", "Assembly", "Lunch"
    starts_at: Mapped[time | None]
    ends_at: Mapped[time | None]
    # Breaks render as a full-width band and hold no cells.
    is_break: Mapped[bool] = mapped_column(server_default=text("false"))


class Timetable(Base):
    """A versioned timetable for one school and academic year. Schools revise
    mid-year, so a revision is a new row; the published one is archived when a
    newer one is published."""

    __tablename__ = "timetables"
    __table_args__ = (
        Index("idx_timetables_school_year", "school_id", "academic_year_id"),
        CheckConstraint("status IN ('draft','published','archived')", name="chk_tt_status"),
        # at most one published timetable per school and year
        Index(
            "uq_timetables_one_published",
            "school_id",
            "academic_year_id",
            unique=True,
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE")
    )
    name: Mapped[str]
    status: Mapped[str] = mapped_column(server_default=text("'draft'"))
    effective_from: Mapped[date | None]
    # Optimistic concurrency: bumped on every saved day.
    version: Mapped[int] = mapped_column(server_default=text("1"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class TimetableCell(Base):
    """One cell: this section, this slot, this subject, and optionally this
    teacher. A free period has no row."""

    __tablename__ = "timetable_cells"
    __table_args__ = (
        # A section holds one class per slot.
        UniqueConstraint("timetable_id", "class_section_id", "period_slot_id",
                         name="uq_cell_section_slot"),
        # A teacher cannot be in two places at once. Partial, so cells with no
        # teacher yet don't collide.
        Index("uq_cell_teacher_slot", "timetable_id", "teacher_id", "period_slot_id",
              unique=True, postgresql_where=text("teacher_id IS NOT NULL")),
        Index("idx_cells_timetable_slot", "timetable_id", "period_slot_id"),
        Index("idx_cells_teacher", "timetable_id", "teacher_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    timetable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE")
    )
    class_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE")
    )
    period_slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("period_slots.id", ondelete="CASCADE")
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    # Nullable: a principal often places subjects first and teachers after.
    # SET NULL keeps the lesson visible as "No teacher" if the teacher leaves.
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
