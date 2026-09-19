"""guardian contact on the login `teachers` role='student' rows, and
absence_calls: one outbound guardian call per marked-absent attendance
record, placed instantly when a teacher marks a student absent -- see
backend.absence_calls.service and backend.attendance.service.mark_day.

Revision ID: 0022_absence_calls
Revises: 0021_class_sections
Create Date: 2026-09-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022_absence_calls"
down_revision: Union[str, Sequence[str], None] = "0021_class_sections"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teachers", sa.Column("guardian_name", sa.String(), nullable=True))
    op.add_column("teachers", sa.Column("guardian_phone", sa.String(), nullable=True))
    op.add_column("teachers", sa.Column("guardian_relation", sa.String(), nullable=True))

    op.create_table(
        "absence_calls",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("attendance_record_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("guardian_phone", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="queued", nullable=False),
        sa.Column("provider_call_sid", sa.String(), nullable=True),
        sa.Column("reason_text", sa.String(), nullable=True),
        sa.Column("transcript", sa.String(), nullable=True),
        sa.Column("failure_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["attendance_record_id"], ["attendance_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ("
            "'queued', 'no_guardian_phone', 'not_configured', 'dialing', "
            "'ringing', 'in_progress', 'completed', 'no_answer', 'failed'"
            ")",
            name="chk_absence_call_status",
        ),
    )
    op.create_index("idx_absence_calls_student", "absence_calls", ["student_id", "created_at"])
    op.create_index("idx_absence_calls_provider_sid", "absence_calls", ["provider_call_sid"])


def downgrade() -> None:
    op.drop_index("idx_absence_calls_provider_sid", table_name="absence_calls")
    op.drop_index("idx_absence_calls_student", table_name="absence_calls")
    op.drop_table("absence_calls")
    op.drop_column("teachers", "guardian_relation")
    op.drop_column("teachers", "guardian_phone")
    op.drop_column("teachers", "guardian_name")
