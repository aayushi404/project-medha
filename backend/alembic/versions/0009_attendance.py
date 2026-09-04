"""attendance: new module

No prior backend table for this -- even the live Next.js app only stores
attendance in browser localStorage. This adds real, synced attendance: one
row per (student, day), upserted by whichever teacher marks it.

Revision ID: 0009_attendance
Revises: 0008_google_auth
Create Date: 2026-09-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_attendance"
down_revision: Union[str, Sequence[str], None] = "0008_google_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("marked_by_teacher_id", sa.UUID(), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["student_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["marked_by_teacher_id"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "attendance_date", name="uq_attendance_student_date"),
        sa.CheckConstraint("status IN ('present', 'absent')", name="chk_attendance_status"),
    )
    op.create_index(
        "idx_attendance_marked_by_date",
        "attendance_records",
        ["marked_by_teacher_id", "attendance_date"],
    )


def downgrade() -> None:
    op.drop_index("idx_attendance_marked_by_date", table_name="attendance_records")
    op.drop_table("attendance_records")
