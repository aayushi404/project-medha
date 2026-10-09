"""Teacher daily work updates, principal feedback, and student reactions

Revision ID: 0037_work_updates
Revises: 0036_school_logo
Create Date: 2026-10-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0037_work_updates"
down_revision: Union[str, Sequence[str], None] = "0036_school_logo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "work_updates",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("grade_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("chapter_id", sa.UUID(), nullable=True),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("grade_label", sa.String(), nullable=False),
        sa.Column("subject_name", sa.String(), nullable=False),
        sa.Column("chapter_title", sa.String(), nullable=False),
        sa.Column("activities", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("topics", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("other_topics", sa.String(), nullable=True),
        sa.Column("activity_detail", sa.String(), nullable=True),
        sa.Column("homework", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("ai_usefulness", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=False),
        sa.Column("principal_note", sa.String(), nullable=True),
        sa.Column("principal_badge", sa.String(), nullable=True),
        sa.Column("flagged", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("feedback_by_id", sa.UUID(), nullable=True),
        sa.Column("feedback_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["feedback_by_id"], ["teachers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_work_updates_school", "work_updates", ["school_id", sa.text("created_at DESC")])
    op.create_index("idx_work_updates_teacher", "work_updates", ["teacher_id", sa.text("created_at DESC")])

    op.create_table(
        "work_update_reactions",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("work_update_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("value IN ('approve','disapprove')", name="chk_work_update_reaction_value"),
        sa.ForeignKeyConstraint(["work_update_id"], ["work_updates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("work_update_id", "student_id", name="uq_work_update_reaction_student"),
    )


def downgrade() -> None:
    op.drop_table("work_update_reactions")
    op.drop_index("idx_work_updates_teacher", table_name="work_updates")
    op.drop_index("idx_work_updates_school", table_name="work_updates")
    op.drop_table("work_updates")
