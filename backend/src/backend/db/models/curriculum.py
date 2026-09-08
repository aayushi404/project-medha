import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    label: Mapped[str] = mapped_column(unique=True)
    numeric_level: Mapped[int] = mapped_column(unique=True)


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("name", "board"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    name: Mapped[str]
    board: Mapped[str] = mapped_column(server_default="BSEB")


class TeacherSubject(Base):
    __tablename__ = "teacher_subjects"
    __table_args__ = (UniqueConstraint("teacher_id", "subject_id", "grade_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    is_primary: Mapped[bool] = mapped_column(server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class CurriculumChapter(Base):
    __tablename__ = "curriculum_chapters"
    __table_args__ = (UniqueConstraint("subject_id", "grade_id", "chapter_number"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    chapter_number: Mapped[int]
    title: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class CurriculumTopic(Base):
    __tablename__ = "curriculum_topics"
    __table_args__ = (Index("idx_topics_chapter", "chapter_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_chapters.id", ondelete="CASCADE")
    )
    title: Mapped[str]
    description: Mapped[str | None]
    sequence_order: Mapped[int] = mapped_column(server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class TextbookContentChunk(Base):
    __tablename__ = "textbook_content_chunks"
    __table_args__ = (Index("idx_chunks_topic", "topic_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_topics.id", ondelete="CASCADE")
    )
    content_text: Mapped[str]
    source_page: Mapped[int | None]
    # Dimension of the retrieval embedding model (Voyage voyage-3 = 1024).
    # Keep in sync with the latest alembic migration and settings.embedding_dim;
    # see docs/phase-1/04-llm-client-and-retrieval.md for the provider choice.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1024))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
