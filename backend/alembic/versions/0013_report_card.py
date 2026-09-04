"""report card: term marks per subject, entered by a teacher

Revision ID: 0013_report_card
Revises: 0012_timetable
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_report_card"
down_revision: Union[str, Sequence[str], None] = "0012_timetable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_card_marks",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("term", sa.String(), nullable=False),
        sa.Column("marks_obtained", sa.Float(), nullable=False),
        sa.Column("max_marks", sa.Float(), server_default=sa.text("100"), nullable=False),
        sa.Column("remarks", sa.String(), nullable=True),
        sa.Column("entered_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["entered_by"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "subject_id", "term", name="uq_report_card_entry"),
    )


def downgrade() -> None:
    op.drop_table("report_card_marks")
