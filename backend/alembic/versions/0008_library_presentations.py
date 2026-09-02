"""library_presentations: curated, curriculum-keyed slide decks

A catalog of pre-built decks tagged by grade / subject / chapter. Each row
stores the same slide spec the LLM produces (`spec_json`), rendered on demand
by `backend.ppt.render_pptx` -- so no object storage is needed. `file_key` is
a reserved nullable column for a hand-authored .pptx in object storage later.
Content is loaded by `scripts/seed_library.py` (idempotent, keyed on `slug`).

Revision ID: 0008_library_presentations
Revises: 0007_module_chapter_id
Create Date: 2026-09-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_library_presentations"
down_revision: Union[str, Sequence[str], None] = "0007_module_chapter_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "library_presentations",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("language", sa.String(), server_default="hi", nullable=False),
        sa.Column("grade_id", sa.UUID(), nullable=True),
        sa.Column("subject_id", sa.UUID(), nullable=True),
        sa.Column("chapter_id", sa.UUID(), nullable=True),
        sa.Column("topic_id", sa.UUID(), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("spec_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("file_key", sa.String(), nullable=True),
        sa.Column("slide_count", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(), server_default="curated", nullable=False),
        sa.Column("published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["chapter_id"], ["curriculum_chapters.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["curriculum_topics.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "idx_library_pres_grade_subject",
        "library_presentations",
        ["grade_id", "subject_id"],
        unique=False,
    )
    op.create_index(
        "idx_library_pres_chapter", "library_presentations", ["chapter_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("idx_library_pres_chapter", table_name="library_presentations")
    op.drop_index("idx_library_pres_grade_subject", table_name="library_presentations")
    op.drop_table("library_presentations")
