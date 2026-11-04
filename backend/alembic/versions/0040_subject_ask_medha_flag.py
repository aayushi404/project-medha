"""Mark subjects usable in Ask Medha / content generation. A school can have a
teacher for a subject (Music, Urdu, ...) that a principal should still be able
to assign in the class roster, even though it makes no sense to generate
lesson plans/quizzes/notes for it. Defaults to true so every existing subject
keeps working in Ask Medha unchanged -- this only turns a few subjects off.

Revision ID: 0040_subject_ask_medha_flag
Revises: 0039_chapter_completion
Create Date: 2026-11-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0040_subject_ask_medha_flag"
down_revision: Union[str, Sequence[str], None] = "0039_chapter_completion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subjects",
        sa.Column("ask_medha_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("subjects", "ask_medha_enabled")
