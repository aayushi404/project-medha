"""homework: teacher assigns to a grade, student marks done/not done

Revision ID: 0011_homework
Revises: 0010_notifications
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_homework"
down_revision: Union[str, Sequence[str], None] = "0010_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "homework",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("grade_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_homework_grade", "homework", ["school_id", "grade_id", sa.text("created_at DESC")])

    op.create_table(
        "homework_status",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("homework_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("done", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("done_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["homework_id"], ["homework.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("homework_id", "student_id", name="uq_homework_status_student"),
    )


def downgrade() -> None:
    op.drop_table("homework_status")
    op.drop_index("idx_homework_grade", table_name="homework")
    op.drop_table("homework")
