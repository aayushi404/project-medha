"""Indexes for queries that scanned whole tables. Found by load testing with 1,000
schools, where homework alone took most of the database's time: its only index starts
with school_id, and the student and teacher lists do not filter on that first.

Built concurrently, so a live database keeps accepting writes while this runs.

Revision ID: 0041_indexes_for_scale
Revises: 0040_subject_ask_medha_flag
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041_indexes_for_scale"
down_revision: Union[str, Sequence[str], None] = "0040_subject_ask_medha_flag"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEXES = (
    ("idx_homework_section_recent", "homework", ["class_section_id", sa.text("created_at DESC")]),
    ("idx_homework_teacher_recent", "homework", ["teacher_id", sa.text("created_at DESC")]),
    ("idx_modules_session", "modules", ["session_id"]),
    ("idx_practice_chapter", "practice_questions", ["chapter_id", "created_at"]),
    ("idx_library_items_school", "library_items", ["school_id"]),
    ("idx_sessions_expires", "auth_sessions", ["expires_at"]),
    ("idx_sessions_revoked", "auth_sessions", ["revoked_at"]),
)


def upgrade() -> None:
    # CONCURRENTLY cannot run inside a transaction.
    with op.get_context().autocommit_block():
        for name, table, columns in _INDEXES:
            op.create_index(name, table, columns, postgresql_concurrently=True, if_not_exists=True)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, _ in _INDEXES:
            op.drop_index(name, table_name=table, postgresql_concurrently=True, if_exists=True)
