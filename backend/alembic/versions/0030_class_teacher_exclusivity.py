"""Enforce one class_section per class teacher.

Existing data may already violate this (a teacher listed as class_teacher_id
on more than one section) -- for each such teacher, keep the assignment on
their lowest-grade section and clear class_teacher_id on the rest, then add a
partial unique index so it can't happen again. This mirrors the existing
"at most one approved principal per school" pattern in `teachers`
(idx_one_approved_principal_per_school).

Revision ID: 0030_class_teacher_exclusivity
Revises: 0029_profile_photos
Create Date: 2026-09-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030_class_teacher_exclusivity"
down_revision: Union[str, Sequence[str], None] = "0029_profile_photos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT cs.id,
                       ROW_NUMBER() OVER (
                           PARTITION BY cs.class_teacher_id
                           ORDER BY g.numeric_level, cs.id
                       ) AS rn
                FROM class_sections cs
                JOIN grades g ON g.id = cs.grade_id
                WHERE cs.class_teacher_id IS NOT NULL
            )
            UPDATE class_sections
            SET class_teacher_id = NULL
            WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
            """
        )
    )
    op.create_index(
        "idx_one_section_per_class_teacher",
        "class_sections",
        ["class_teacher_id"],
        unique=True,
        postgresql_where=sa.text("class_teacher_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_one_section_per_class_teacher", table_name="class_sections")
