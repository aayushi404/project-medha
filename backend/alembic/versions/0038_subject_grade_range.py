"""Scope subjects to a grade range, so Class 11/12-only subjects (Physics,
Accountancy, ...) don't show up as assignable in a Class 6-10 section, and the
6-10 composite Science/Social Science subjects don't show up for 11/12
sections (which split them into standalone +2 subjects instead).

NULL on either bound means "no limit on that side" -- every existing subject
row is left NULL/NULL (unchanged, applies to every grade), so this is purely
additive: nothing that currently works stops working.

Revision ID: 0038_subject_grade_range
Revises: 0037_work_updates
Create Date: 2026-10-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0038_subject_grade_range"
down_revision: Union[str, Sequence[str], None] = "0037_work_updates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("subjects", sa.Column("min_grade_level", sa.Integer(), nullable=True))
    op.add_column("subjects", sa.Column("max_grade_level", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("subjects", "max_grade_level")
    op.drop_column("subjects", "min_grade_level")
