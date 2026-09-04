"""timetable: a weekly grid per grade, principal-authored

Revision ID: 0012_timetable
Revises: 0011_homework
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_timetable"
down_revision: Union[str, Sequence[str], None] = "0011_homework"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "timetable_entries",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("grade_id", sa.UUID(), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("period_number", sa.SmallInteger(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=True),
        sa.Column("teacher_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("grade_id", "day_of_week", "period_number", name="uq_timetable_slot"),
    )


def downgrade() -> None:
    op.drop_table("timetable_entries")
