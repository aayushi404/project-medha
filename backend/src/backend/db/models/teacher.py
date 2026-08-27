import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class Teacher(Base):
    __tablename__ = "teachers"
    __table_args__ = (
        Index("idx_teachers_school", "school_id"),
        Index("idx_teachers_phone", "phone_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    # nullable: a teacher row is created at signup time, before school/subject
    # onboarding (a separate step) assigns a school
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    full_name: Mapped[str]
    # email + password are the login credential (unique index on email covers lookups)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    # optional profile data, no longer a credential
    phone_number: Mapped[str | None] = mapped_column(unique=True)
    preferred_language: Mapped[str] = mapped_column(server_default="hi-BiharBoli")
    role: Mapped[str] = mapped_column(server_default="teacher")
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))
    onboarded_at: Mapped[datetime | None]
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
