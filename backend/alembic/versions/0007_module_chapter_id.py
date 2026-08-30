"""modules: link a saved module to a curriculum chapter

The dashboard scopes work to a chapter, but a session often has a chapter and no
specific topic, so `modules.topic_id` alone can't answer "what have I made for
this chapter?". This adds a nullable `modules.chapter_id` (FK to
`curriculum_chapters`) and backfills it from the module's originating
`chat_sessions.chapter_id`.

Revision ID: 0007_module_chapter_id
Revises: 0006_student_role
Create Date: 2026-08-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_module_chapter_id"
down_revision: Union[str, Sequence[str], None] = "0006_student_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("modules", sa.Column("chapter_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_modules_chapter",
        "modules",
        "curriculum_chapters",
        ["chapter_id"],
        ["id"],
    )
    op.create_index("idx_modules_chapter", "modules", ["chapter_id"])

    # backfill from the originating chat session
    op.execute(
        """
        UPDATE modules AS m
        SET chapter_id = s.chapter_id
        FROM chat_sessions AS s
        WHERE m.session_id = s.id
          AND m.chapter_id IS NULL
          AND s.chapter_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("idx_modules_chapter", table_name="modules")
    op.drop_constraint("fk_modules_chapter", "modules", type_="foreignkey")
    op.drop_column("modules", "chapter_id")
