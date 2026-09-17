import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class AcademicYear(Base):
    """e.g. 2026-27. Enrolment is always year-scoped -- without this, last
    year's roster and this year's are indistinguishable."""

    __tablename__ = "academic_years"
    __table_args__ = (UniqueConstraint("school_id", "label"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    label: Mapped[str]  # "2026-27"
    starts_on: Mapped[date_]
    ends_on: Mapped[date_]
    is_current: Mapped[bool] = mapped_column(server_default=text("false"))


class ClassSection(Base):
    """A real class at a real school: Class 8, section A, 2026-27. Distinct
    from `grades`, which is the curriculum-level Class 6-10 lookup shared
    across every school."""

    __tablename__ = "class_sections"
    __table_args__ = (
        UniqueConstraint("school_id", "academic_year_id", "grade_id", "section"),
        Index("idx_sections_school_year", "school_id", "academic_year_id"),
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
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    section: Mapped[str] = mapped_column(server_default=text("'A'"))  # A, B, C
    class_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Student(Base):
    """A student directory record, deliberately minimal and separate from
    login credentials -- see docs/phase-2/Medha-principal-dashboard.md #3.
    Independent of whether this student (or anyone) has a Medha account."""

    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("school_id", "admission_number"),
        Index("idx_students_school", "school_id"),
        CheckConstraint(
            "status IN ('active','transferred','dropped_out','graduated')",
            name="chk_student_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    full_name: Mapped[str]
    admission_number: Mapped[str | None]
    guardian_name: Mapped[str | None]
    guardian_relation: Mapped[str | None]  # father | mother | guardian
    guardian_phone: Mapped[str | None]
    status: Mapped[str] = mapped_column(server_default=text("'active'"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class StudentEnrollment(Base):
    """Which section a student sits in, for which year. Separate from
    `students` so a student's history survives promotion to the next class."""

    __tablename__ = "student_enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "academic_year_id"),
        UniqueConstraint("class_section_id", "roll_number"),
        Index("idx_enrollments_section", "class_section_id", "roll_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE")
    )
    class_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE")
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE")
    )
    roll_number: Mapped[int | None]
    enrolled_on: Mapped[date_ | None]
    left_on: Mapped[date_ | None]
