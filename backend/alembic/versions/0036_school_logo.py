"""School logo: one nullable Cloudinary URL on the schools row.

Additive only. Set by the principal's logo upload and cleared by the removal
endpoint; nothing reads it as input from the client.

Revision ID: 0036_school_logo
Revises: 0035_daily_timetable_snapshot
Create Date: 2026-10-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0036_school_logo"
down_revision: Union[str, Sequence[str], None] = "0035_daily_timetable_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("schools", sa.Column("logo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("schools", "logo_url")
