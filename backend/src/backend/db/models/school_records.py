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
        # A teacher may be class_teacher of at most one section -- see
        # 0030_class_teacher_exclusivity.py.
        Index(
            "idx_one_section_per_class_teacher",
            "class_teacher_id",
            unique=True,
            postgresql_where=text("class_teacher_id IS NOT NULL"),
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
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    section: Mapped[str] = mapped_column(server_default=text("'A'"))  # A, B, C
    class_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Student(Base):
    """The single source of truth for a student: school-records identity
    (name, guardian contact) AND login credential (login phone + password) AND
    grade/roll placement, all on one row. Originally built deliberately login-less (see
    docs/phase-2/Medha-principal-dashboard.md #3) -- that changed once student
    login moved off `teachers` onto this table; keeping them apart would have
    just recreated the same "two disconnected guardian-data stores" problem
    in reverse."""

    __tablename__ = "students"
    __table_args__ = (
        Index("idx_students_school", "school_id"),
        Index(
            "idx_students_pending",
            "school_id",
            "approval_status",
            postgresql_where=text("approval_status = 'pending'"),
        ),
        Index("uq_students_email", "email", unique=True, postgresql_where=text("email IS NOT NULL")),
        # NOT unique: siblings share a parent's phone, each with their own
        # password. Lookup by phone returns every student on that number.
        Index("idx_students_phone", "phone_number", postgresql_where=text("phone_number IS NOT NULL")),
        Index(
            "uq_students_google_sub",
            "google_sub",
            unique=True,
            postgresql_where=text("google_sub IS NOT NULL"),
        ),
        CheckConstraint(
            "status IN ('active','transferred','dropped_out','graduated')",
            name="chk_student_status",
        ),
        CheckConstraint(
            "approval_status IN ('pending','approved','rejected')",
            name="chk_students_approval_status",
        ),
        # 0032: every student logs in by phone, in E.164 form (+91XXXXXXXXXX).
        CheckConstraint("phone_number IS NOT NULL", name="chk_students_phone_required"),
        CheckConstraint(
            r"phone_number ~ '^\+91[6-9][0-9]{9}$'", name="chk_students_phone_format"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    full_name: Mapped[str]
    guardian_name: Mapped[str | None]
    guardian_relation: Mapped[str | None]  # father | mother | guardian
    guardian_phone: Mapped[str | None]
    status: Mapped[str] = mapped_column(server_default=text("'active'"))
    # Cloudinary secure_url, set only via core/images.py's upload/delete flow --
    # never accepted as raw client input.
    photo_url: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    # --- login credential (moved here from `teachers`) ---
    email: Mapped[str | None]
    password_hash: Mapped[str | None]
    google_sub: Mapped[str | None]
    # E.164 (+91XXXXXXXXXX). Not unique -- see idx_students_phone.
    phone_number: Mapped[str | None]
    preferred_language: Mapped[str] = mapped_column(server_default="hi-BiharBoli")
    email_verified_at: Mapped[datetime | None]
    # OTP hook: null until phone OTP is switched on (settings.phone_otp_required)
    phone_verified_at: Mapped[datetime | None]
    mfa_secret: Mapped[str | None]
    mfa_enabled: Mapped[bool] = mapped_column(server_default=text("false"))

    # class placement lives in `student_enrollments`/`class_sections` (see
    # below), not denormalized here -- attendance, homework, report cards,
    # tutor, OMR, and notifications all resolve it via that join.

    # --- registration/approval workflow (moved here from `teachers`) ---
    approval_status: Mapped[str] = mapped_column(server_default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )
    approved_at: Mapped[datetime | None]
    rejection_reason: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))

    @property
    def role(self) -> str:
        """Python-only convenience, NOT a database column -- lets code written
        against a generic `Teacher`-shaped actor (`.role == "student"`,
        `.role != "teacher"`) keep working unchanged when the actor is
        actually a `Student`. Never filter on this in SQL; it doesn't exist
        as a queryable column."""
        return "student"


class TeachingAssignment(Base):
    """A teacher's link to a real class: teaches `subject_id` to
    `class_section_id`. Additive alongside `teacher_subjects` (curriculum
    grade-level, used by onboarding + report-card `_assert_teaches`) -- this
    is the school-level "teaches Science to 8A and 8B" answer proposed in
    docs/phase-2/Medha-principal-dashboard.md, previously unbuilt."""

    __tablename__ = "teaching_assignments"
    __table_args__ = (
        UniqueConstraint("teacher_id", "class_section_id", "subject_id"),
        Index("idx_assignments_section", "class_section_id"),
        # 0034: a primary assignment teaches one subject in the section. A reserve
        # is a teacher on standby for any period in the section, subject-agnostic.
        Index(
            "uq_assign_reserve",
            "teacher_id",
            "class_section_id",
            unique=True,
            postgresql_where=text("role = 'reserve'"),
        ),
        CheckConstraint("role IN ('primary','reserve')", name="chk_assign_role"),
        CheckConstraint("role = 'reserve' OR subject_id IS NOT NULL", name="chk_assign_subject"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    class_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE")
    )
    # Null only for reserve teachers, who may cover any subject in the section.
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    role: Mapped[str] = mapped_column(server_default=text("'primary'"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


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
