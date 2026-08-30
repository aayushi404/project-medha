import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class Teacher(Base):
    __tablename__ = "teachers"
    __table_args__ = (
        Index("idx_teachers_school", "school_id"),
        Index("idx_teachers_phone", "phone_number"),
        Index("idx_teachers_grade", "grade_id"),
        Index(
            "idx_teachers_pending",
            "school_id",
            "role",
            "approval_status",
            postgresql_where=text("approval_status = 'pending'"),
        ),
        # at most one approved principal per school
        Index(
            "idx_one_approved_principal_per_school",
            "school_id",
            unique=True,
            postgresql_where=text("role = 'principal' AND approval_status = 'approved'"),
        ),
        # one student per (school, class, roll number)
        Index(
            "idx_one_student_per_roll",
            "school_id",
            "grade_id",
            "roll_number",
            unique=True,
            postgresql_where=text("role = 'student' AND roll_number IS NOT NULL"),
        ),
        # email is optional (a student row exists before it has a credential);
        # uniqueness is kept over the rows that do have one
        Index(
            "uq_teachers_email",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
        ),
        CheckConstraint(
            "role IN ('admin', 'principal', 'teacher', 'student')",
            name="chk_teachers_role",
        ),
        CheckConstraint(
            "approval_status IN ('pending', 'approved', 'rejected')",
            name="chk_teachers_approval_status",
        ),
        CheckConstraint(
            "years_of_experience IS NULL "
            "OR (years_of_experience >= 0 AND years_of_experience <= 50)",
            name="chk_experience_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    # nullable: a teacher row is created at signup time, before school/subject
    # onboarding (a separate step) assigns a school
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    full_name: Mapped[str]
    # email + password are the login credential. Nullable: a `student` row is
    # created at registration (class + roll number only) and gains a credential
    # later when the student activates their account. `uq_teachers_email` keeps
    # non-NULL emails unique.
    email: Mapped[str | None]
    password_hash: Mapped[str | None]
    # optional profile data, no longer a credential. `phone_number` doubles as
    # the "mobile number" collected on the registration form.
    phone_number: Mapped[str | None] = mapped_column(unique=True)
    preferred_language: Mapped[str] = mapped_column(server_default="hi-BiharBoli")
    role: Mapped[str] = mapped_column(server_default="teacher")
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))
    onboarded_at: Mapped[datetime | None]

    # --- student profile ---
    # the student's class, and their roll number within it -- the pair a teacher
    # checks against the class register to verify a registration.
    grade_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("grades.id")
    )
    roll_number: Mapped[str | None]

    # --- registration profile (teachers) ---
    # employee_code is the government teacher ID: the field a principal checks
    # against staff records to verify the applicant actually teaches there.
    employee_code: Mapped[str | None]
    years_of_experience: Mapped[int | None]
    qualification: Mapped[str | None]  # e.g. B.Ed, M.Sc

    # --- approval workflow ---
    approval_status: Mapped[str] = mapped_column(server_default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )
    approved_at: Mapped[datetime | None]
    rejection_reason: Mapped[str | None]

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (Index("idx_sessions_teacher", "teacher_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    refresh_token_hash: Mapped[str]
    device_info: Mapped[str | None]
    issued_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]


class ApprovalEvent(Base):
    """Append-only audit trail of every approve / reject / revoke decision."""

    __tablename__ = "approval_events"
    __table_args__ = (
        Index("idx_approval_events_subject", "subject_user_id"),
        CheckConstraint(
            "action IN ('approved', 'rejected', 'revoked')", name="chk_approval_action"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    subject_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )
    action: Mapped[str]  # approved | rejected | revoked
    reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
