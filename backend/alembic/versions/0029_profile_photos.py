"""Add photo_url to teachers and students -- a nullable Cloudinary secure_url,
set only by the backend's own upload/delete flow (core/images.py), never
accepted as raw client input.

Revision ID: 0029_profile_photos
Revises: 0028_auth_hardening
Create Date: 2026-09-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029_profile_photos"
down_revision: Union[str, Sequence[str], None] = "0028_auth_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teachers", sa.Column("photo_url", sa.String(), nullable=True))
    op.add_column("students", sa.Column("photo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("students", "photo_url")
    op.drop_column("teachers", "photo_url")
