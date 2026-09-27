"""Rewire homework to class_section_id instead of the curriculum-level
grade_id -- part of the section-based rewiring pass (see the "Build a proper
school management system" plan). Existing homework/homework_status rows in
this repo are disposable local test data with no principled grade->section
mapping, so this truncates rather than backfilling.

Revision ID: 0026_homework_class_section
Revises: 0025_drop_teacher_student_cols
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026_homework_class_section"
down_revision: Union[str, Sequence[str], None] = "0025_drop_teacher_student_cols"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("TRUNCATE TABLE homework_status, homework")

    op.drop_index("idx_homework_grade", table_name="homework")

    op.add_column("homework", sa.Column("class_section_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "homework_class_section_id_fkey",
        "homework",
        "class_sections",
        ["class_section_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("homework", "class_section_id", nullable=False)
    op.drop_column("homework", "grade_id")

    op.create_index(
        "idx_homework_section", "homework", ["school_id", "class_section_id", sa.text("created_at DESC")]
    )


def downgrade() -> None:
    op.drop_index("idx_homework_section", table_name="homework")
    op.add_column("homework", sa.Column("grade_id", sa.UUID(), nullable=True))
    op.drop_constraint("homework_class_section_id_fkey", "homework", type_="foreignkey")
    op.drop_column("homework", "class_section_id")
    op.create_index("idx_homework_grade", "homework", ["school_id", "grade_id", sa.text("created_at DESC")])
