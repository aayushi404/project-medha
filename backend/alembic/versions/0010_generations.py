"""generations: polymorphic AI content-generation domain

Medha v2 splits Ask Medha (conversation) from Content Generation (durable
artifacts). This migration adds the generation domain -- one polymorphic
`generations` table (type discriminator + JSONB body) plus `generation_exports`
and `generation_feedback` -- and links a chat turn to an artifact it produced
via `chat_messages.generation_id`.

No existing data is touched. Backfills from `module_artifacts`,
`module_feedback`, and `library_presentations` come later in 0011; those tables
are dropped in 0012. See docs/medha-v2-schema.md.

Revision ID: 0010_generations
Revises: 0009_voice_turns
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_generations"
down_revision: Union[str, Sequence[str], None] = "0009_voice_turns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TYPES = "'lesson_plan','presentation','question_paper','notes','quiz','worksheet','notice'"
_STATUSES = "'queued','running','completed','failed'"
_VISIBILITIES = "'private','school','library'"
_FORMATS = "'pdf','pptx','docx'"


def upgrade() -> None:
    op.create_table(
        "generations",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        # ownership & visibility
        sa.Column("teacher_id", sa.UUID(), nullable=True),
        sa.Column("visibility", sa.Text(), server_default=sa.text("'private'"), nullable=False),
        sa.Column("published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("slug", sa.Text(), nullable=True),
        # what it is
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("language", sa.Text(), server_default=sa.text("'hi'"), nullable=False),
        # curriculum scope
        sa.Column("grade_id", sa.UUID(), nullable=True),
        sa.Column("subject_id", sa.UUID(), nullable=True),
        sa.Column("chapter_id", sa.UUID(), nullable=True),
        sa.Column("topic_id", sa.UUID(), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        # provenance
        sa.Column("source", sa.Text(), server_default=sa.text("'quick_action'"), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=True),
        sa.Column("parent_generation_id", sa.UUID(), nullable=True),
        sa.Column("module_id", sa.UUID(), nullable=True),
        # content
        sa.Column("input_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("content_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        # lifecycle
        sa.Column("status", sa.Text(), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        # observability & grounding
        sa.Column("retrieved_chunk_ids", postgresql.ARRAY(sa.UUID()), nullable=True),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.Text(), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=True),
        sa.Column("tokens_out", sa.Integer(), nullable=True),
        sa.Column("generation_ms", sa.Integer(), nullable=True),
        sa.Column("cache_key", sa.Text(), nullable=True),
        # user state
        sa.Column("is_favorite", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["chapter_id"], ["curriculum_chapters.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["curriculum_topics.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_generation_id"], ["generations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        sa.CheckConstraint(f"type IN ({_TYPES})", name="chk_gen_type"),
        sa.CheckConstraint(f"status IN ({_STATUSES})", name="chk_gen_status"),
        sa.CheckConstraint(f"visibility IN ({_VISIBILITIES})", name="chk_gen_visibility"),
        sa.CheckConstraint(
            "visibility = 'library' OR teacher_id IS NOT NULL", name="chk_gen_owner"
        ),
    )
    op.create_index(
        "idx_gen_teacher_recent", "generations", ["teacher_id", sa.text("created_at DESC")]
    )
    op.create_index(
        "idx_gen_teacher_type",
        "generations",
        ["teacher_id", "type", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_gen_curriculum", "generations", ["grade_id", "subject_id", "chapter_id"]
    )
    op.create_index("idx_gen_cache_key", "generations", ["cache_key"])
    op.create_index(
        "idx_gen_library",
        "generations",
        ["type", "grade_id", "subject_id"],
        postgresql_where=sa.text("visibility = 'library' AND published"),
    )
    op.create_index(
        "idx_gen_favorites",
        "generations",
        ["teacher_id", sa.text("created_at DESC")],
        postgresql_where=sa.text("is_favorite"),
    )

    op.create_table(
        "generation_exports",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("generation_id", sa.UUID(), nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("file_key", sa.Text(), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("status", sa.Text(), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["generation_id"], ["generations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("generation_id", "format"),
        sa.CheckConstraint(f"format IN ({_FORMATS})", name="chk_export_format"),
        sa.CheckConstraint(f"status IN ({_STATUSES})", name="chk_export_status"),
    )
    op.create_index("idx_exports_generation", "generation_exports", ["generation_id"])

    op.create_table(
        "generation_feedback",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("generation_id", sa.UUID(), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["generation_id"], ["generations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("generation_id", "teacher_id"),
    )
    op.create_index(
        "idx_gen_feedback_generation", "generation_feedback", ["generation_id"]
    )

    # A chat turn can render an artifact it produced (docs/medha-v2-schema.md §3.1).
    op.add_column(
        "chat_messages", sa.Column("generation_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        "fk_chat_messages_generation",
        "chat_messages",
        "generations",
        ["generation_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_chat_messages_generation", "chat_messages", type_="foreignkey")
    op.drop_column("chat_messages", "generation_id")

    op.drop_index("idx_gen_feedback_generation", table_name="generation_feedback")
    op.drop_table("generation_feedback")

    op.drop_index("idx_exports_generation", table_name="generation_exports")
    op.drop_table("generation_exports")

    op.drop_index("idx_gen_favorites", table_name="generations")
    op.drop_index("idx_gen_library", table_name="generations")
    op.drop_index("idx_gen_cache_key", table_name="generations")
    op.drop_index("idx_gen_curriculum", table_name="generations")
    op.drop_index("idx_gen_teacher_type", table_name="generations")
    op.drop_index("idx_gen_teacher_recent", table_name="generations")
    op.drop_table("generations")
