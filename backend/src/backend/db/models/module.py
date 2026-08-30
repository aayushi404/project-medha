import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, SmallInteger, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class Module(Base):
    """A saved teaching module -- what "My Modules" lists. One per chat session;
    holds one or more artifacts (explanation / quiz / activity)."""

    __tablename__ = "modules"
    __table_args__ = (Index("idx_modules_teacher", "teacher_id", text("updated_at DESC")),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    # deleting a chat session should not delete the saved module
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="SET NULL")
    )
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_chapters.id")
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_topics.id")
    )
    title: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ModuleArtifact(Base):
    __tablename__ = "module_artifacts"
    __table_args__ = (Index("idx_artifacts_module", "module_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE")
    )
    artifact_type: Mapped[str]  # 'explanation' | 'quiz' | 'activity'
    content_json: Mapped[dict | None] = mapped_column(JSONB)
    file_url: Mapped[str | None]  # unused in Phase 1 (Phase 2: ppt/pdf S3 url)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ModuleFeedback(Base):
    __tablename__ = "module_feedback"
    __table_args__ = (UniqueConstraint("module_id", "teacher_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    rating: Mapped[int | None] = mapped_column(SmallInteger)  # 1 = up, -1 = down
    comment: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
