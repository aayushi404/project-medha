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
        # email is optional (a not-yet-onboarded teacher row can predate a
        # credential); uniqueness is kept over the rows that do have one
        Index(
            "uq_teachers_email",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
        ),
        # Google sign-in identity, optional -- same "unique only when present"
        # shape as email, since most rows won't have one.
        Index(
            "uq_teachers_google_sub",
            "google_sub",
            unique=True,
            postgresql_where=text("google_sub IS NOT NULL"),
        ),
        CheckConstraint(
            "role IN ('admin', 'principal', 'teacher')",
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
    # Google sign-in identity (the token's "sub" claim). Optional: most rows
    # authenticate by password only. A row can have both, either, or neither --
    # /auth/google links this to an existing email/password row on first use.
    google_sub: Mapped[str | None]
    # optional profile data, no longer a credential. `phone_number` doubles as
    # the "mobile number" collected on the registration form.
    phone_number: Mapped[str | None] = mapped_column(unique=True)
    preferred_language: Mapped[str] = mapped_column(server_default="hi-BiharBoli")
    role: Mapped[str] = mapped_column(server_default="teacher")
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))
    onboarded_at: Mapped[datetime | None]
    # proof the person controls this email (auth/verification.py); a row can't
    # be approved until it's set
    email_verified_at: Mapped[datetime | None]
    # MFA hook (TOTP) -- columns exist, nothing enforces them yet
    mfa_secret: Mapped[str | None]
    mfa_enabled: Mapped[bool] = mapped_column(server_default=text("false"))

    # --- registration profile (teachers) ---
    # employee_code is the government teacher ID: the field a principal checks
    # against staff records to verify the applicant actually teaches there.
    employee_code: Mapped[str | None]
    years_of_experience: Mapped[int | None]
    qualification: Mapped[str | None]  # e.g. B.Ed, M.Sc
    # Cloudinary secure_url, set only via core/images.py's upload/delete flow --
    # never accepted as raw client input.
    photo_url: Mapped[str | None]

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
    """A logged-in session for either a `teachers` or a `students` actor --
    exactly one of `teacher_id`/`student_id` is set (`chk_auth_sessions_actor`).
    Two identity tables sharing one session table, rather than a second
    parallel auth-session system, since login/refresh/rate-limit machinery is
    otherwise identical for both."""

    __tablename__ = "auth_sessions"
    __table_args__ = (
        Index("idx_sessions_teacher", "teacher_id"),
        Index("idx_sessions_student", "student_id"),
        CheckConstraint(
            "num_nonnulls(teacher_id, student_id) = 1", name="chk_auth_sessions_actor"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE")
    )
    refresh_token_hash: Mapped[str]
    # every rotation of one login stays in the same family, so replaying an
    # already-rotated (i.e. stolen) token can revoke the whole chain
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    device_info: Mapped[str | None]
    issued_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]


class AuthThrottle(Base):
    """One rate-limit counter per (scope, hashed identifier), shared by every
    worker and surviving restarts. See core/throttle.py."""

    __tablename__ = "auth_throttle"

    scope: Mapped[str] = mapped_column(primary_key=True)
    key_hash: Mapped[str] = mapped_column(primary_key=True)
    count: Mapped[int] = mapped_column(server_default=text("0"))
    window_start: Mapped[datetime] = mapped_column(server_default=text("now()"))


class AuthToken(Base):
    """A single-use, expiring, hashed token for email verification or
    password reset. Exactly one of teacher_id/student_id is set."""

    __tablename__ = "auth_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    purpose: Mapped[str]  # verify_email | reset_password
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str]
    expires_at: Mapped[datetime]
    used_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ApprovalEvent(Base):
    """Append-only audit trail of every approve / reject / revoke decision.
    The subject can be a teacher/principal (approved by admin/principal) or a
    student (approved by a teacher) -- exactly one of `subject_user_id`/
    `subject_student_id` is set. The actor is always a teacher/principal/admin
    row (students never approve anything), so `actor_user_id` stays a plain
    required FK to `teachers`."""

    __tablename__ = "approval_events"
    __table_args__ = (
        Index("idx_approval_events_subject", "subject_user_id"),
        Index("idx_approval_events_subject_student", "subject_student_id"),
        CheckConstraint(
            "action IN ('approved', 'rejected', 'revoked')", name="chk_approval_action"
        ),
        CheckConstraint(
            "num_nonnulls(subject_user_id, subject_student_id) = 1",
            name="chk_approval_events_subject",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    subject_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    subject_student_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE")
    )
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )
    action: Mapped[str]  # approved | rejected | revoked
    reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
