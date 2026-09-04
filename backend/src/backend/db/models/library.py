import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class LibraryItem(Base):
    """A curated link to a resource (a hosted PDF, a video, an external
    page) -- deliberately not a file-storage system: `url` points somewhere
    already hosted. `school_id` null = visible to every school (a
    state-wide resource); set = only that school's catalog."""

    __tablename__ = "library_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    grade_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    title: Mapped[str]
    description: Mapped[str | None]
    url: Mapped[str]
    added_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
