"""chapter notes + practice question bank -- teacher/principal-curated
student content, kept separate from the private `modules` feature.

Revision ID: 0016_notes_practice
Revises: 0015_fees
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_notes_practice"
down_revision: Union[str, Sequence[str], None] = "0015_fees"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chapter_notes",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("chapter_id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=True),
        sa.Column("summary", sa.String(), nullable=False),
        sa.Column("key_points", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("important_terms", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["chapter_id"], ["curriculum_chapters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chapter_id", "school_id", name="uq_chapter_notes_chapter_school"),
    )

    op.create_table(
        "practice_questions",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("chapter_id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=True),
        sa.Column("question", sa.String(), nullable=False),
        sa.Column("type", sa.String(), server_default="mcq", nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("answer", sa.String(), nullable=False),
        sa.Column("difficulty", sa.String(), server_default="medium", nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["chapter_id"], ["curriculum_chapters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("practice_questions")
    op.drop_table("chapter_notes")
