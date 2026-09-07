import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class Notification(Base):
    """One row per recipient -- a "class announcement" fans out into N rows
    (one per student) rather than one shared row, so read/unread state is
    per-user. `type` is a free string (not a DB enum) so new notification
    kinds don't need a migration; see `notifications/service.py` for the
    kinds this codebase actually sends."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("idx_notifications_recipient", "recipient_id", text("created_at DESC")),
        Index(
            "idx_notifications_unread",
            "recipient_id",
            postgresql_where=text("read_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    type: Mapped[str]
    title: Mapped[str]
    body: Mapped[str]
    # deep-link payload, e.g. {"homework_id": "..."} -- shape depends on `type`
    data: Mapped[dict | None] = mapped_column(JSONB)
    read_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class DeviceToken(Base):
    """A push-notification target (FCM registration token) for one user's one
    installed app instance. A user can have several (phone + tablet, or a
    reinstalled app); tokens are pruned when FCM reports one dead."""

    __tablename__ = "device_tokens"
    __table_args__ = (UniqueConstraint("token", name="uq_device_tokens_token"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    token: Mapped[str]
    platform: Mapped[str]  # android | ios | web
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    last_seen_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
