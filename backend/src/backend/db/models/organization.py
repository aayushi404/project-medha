import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class District(Base):
    __tablename__ = "districts"
    __table_args__ = (UniqueConstraint("name", "state"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    name: Mapped[str]
    state: Mapped[str] = mapped_column(server_default="Bihar")
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (UniqueConstraint("district_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("districts.id", ondelete="CASCADE")
    )
    name: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class School(Base):
    __tablename__ = "schools"
    __table_args__ = (Index("idx_schools_district", "district_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    udise_code: Mapped[str | None] = mapped_column(unique=True)
    name: Mapped[str]
    district_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("districts.id"))
    block_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("blocks.id"))
    medium_of_instruction: Mapped[str] = mapped_column(server_default="Hindi")
    school_type: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
