"""auth: Google sign-in identity

Adds a nullable, optionally-unique `teachers.google_sub` column -- the ID
token's "sub" claim. Mirrors the existing `email` column's "unique only when
present" shape (`uq_teachers_email`), since most rows won't have one.

Revision ID: 0008_google_auth
Revises: 0007_module_chapter_id
Create Date: 2026-09-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_google_auth"
down_revision: Union[str, Sequence[str], None] = "0007_module_chapter_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teachers", sa.Column("google_sub", sa.String(), nullable=True))
    op.create_index(
        "uq_teachers_google_sub",
        "teachers",
        ["google_sub"],
        unique=True,
        postgresql_where=sa.text("google_sub IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_teachers_google_sub", table_name="teachers")
    op.drop_column("teachers", "google_sub")
