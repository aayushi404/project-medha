"""phase 1 schema: chat sessions/messages, modules/artifacts/feedback

Also narrows textbook_content_chunks.embedding from vector(1536) to vector(1024)
to match the Phase 1 embedding model (Voyage voyage-3). The column is entirely
NULL pre-ingestion, so this is a drop/re-add with no data migration. If OpenAI
text-embedding-3-small (1536) is used instead, revert that part and set
EMBEDDING_DIM=1536.

Revision ID: 0003_phase1
Revises: 3e15203d0344
Create Date: 2026-08-27

"""
from typing import Sequence, Union

import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003_phase1"
down_revision: Union[str, Sequence[str], None] = "3e15203d0344"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("grade_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("chapter_id", sa.UUID(), nullable=True),
        sa.Column("topic_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["chapter_id"], ["curriculum_chapters.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["curriculum_topics.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_chat_sessions_teacher",
        "chat_sessions",
        ["teacher_id", sa.text("updated_at DESC")],
        unique=False,
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("retrieved_chunk_ids", postgresql.ARRAY(sa.UUID()), nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_messages_session", "chat_messages", ["session_id", "created_at"], unique=False
    )

    op.create_table(
        "modules",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=True),
        sa.Column("grade_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("topic_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["curriculum_topics.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_modules_teacher", "modules", ["teacher_id", sa.text("updated_at DESC")], unique=False
    )

    op.create_table(
        "module_artifacts",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("module_id", sa.UUID(), nullable=False),
        sa.Column("artifact_type", sa.String(), nullable=False),
        sa.Column("content_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("file_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_artifacts_module", "module_artifacts", ["module_id"], unique=False)

    op.create_table(
        "module_feedback",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("module_id", sa.UUID(), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=True),
        sa.Column("comment", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("module_id", "teacher_id"),
    )

    # Narrow the retrieval embedding column to the Phase 1 model's dimension.
    # All rows are NULL pre-ingestion; drop/re-add avoids an unsupported
    # vector(1536) -> vector(1024) cast.
    op.drop_column("textbook_content_chunks", "embedding")
    op.add_column(
        "textbook_content_chunks",
        sa.Column("embedding", pgvector.sqlalchemy.Vector(1024), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("textbook_content_chunks", "embedding")
    op.add_column(
        "textbook_content_chunks",
        sa.Column("embedding", pgvector.sqlalchemy.Vector(1536), nullable=True),
    )

    op.drop_table("module_feedback")
    op.drop_index("idx_artifacts_module", table_name="module_artifacts")
    op.drop_table("module_artifacts")
    op.drop_index("idx_modules_teacher", table_name="modules")
    op.drop_table("modules")
    op.drop_index("idx_messages_session", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("idx_chat_sessions_teacher", table_name="chat_sessions")
    op.drop_table("chat_sessions")
