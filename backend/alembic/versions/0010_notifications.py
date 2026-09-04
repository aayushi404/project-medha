"""notifications: in-app inbox + push device tokens

One row per recipient (a class announcement fans out to N rows) so
read/unread state is per-user. `device_tokens` holds FCM registration
tokens for push delivery.

Revision ID: 0010_notifications
Revises: 0009_attendance
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_notifications"
down_revision: Union[str, Sequence[str], None] = "0009_attendance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("recipient_id", sa.UUID(), nullable=False),
        sa.Column("sender_id", sa.UUID(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("read_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["recipient_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_notifications_recipient", "notifications", ["recipient_id", sa.text("created_at DESC")]
    )
    op.create_index(
        "idx_notifications_unread",
        "notifications",
        ["recipient_id"],
        postgresql_where=sa.text("read_at IS NULL"),
    )

    op.create_table(
        "device_tokens",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_device_tokens_token"),
    )


def downgrade() -> None:
    op.drop_table("device_tokens")
    op.drop_index("idx_notifications_unread", table_name="notifications")
    op.drop_index("idx_notifications_recipient", table_name="notifications")
    op.drop_table("notifications")
