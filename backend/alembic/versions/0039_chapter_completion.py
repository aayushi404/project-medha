"""Separate "chapter completed" from the daily activity log on work updates.

Until now the principal's syllabus-completion % was derived from the
"Chapter Taught" checkbox -- one of several equal daily-activity tick marks
meant to log what happened in class today, not a milestone. That meant a
teacher logging "I started this chapter today" silently marked it 100% done
on the Principal's dashboard. `chapter_completed` is a distinct, explicit
signal a teacher sets separately; the backfill below preserves every
school's current syllabus % by treating existing "taught" history as
"completed" under the old single-signal model, so no school's number
regresses to 0 on deploy.

Revision ID: 0039_chapter_completion
Revises: 0038_subject_grade_range
Create Date: 2026-10-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0039_chapter_completion"
down_revision: Union[str, Sequence[str], None] = "0038_subject_grade_range"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_updates",
        sa.Column("chapter_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE work_updates SET chapter_completed = true
        WHERE activities @> '["taught_chapter"]'::jsonb
        """
    )


def downgrade() -> None:
    op.drop_column("work_updates", "chapter_completed")
