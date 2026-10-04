"""Final daily timetable: one snapshot per school day, read by the teachers' board.

Additive. The principal finalizes a day once no period still needs cover; the
snapshot is written then and replaced if the day is finalized again.

Revision ID: 0035_daily_timetable_snapshot
Revises: 0034_daily_substitution
Create Date: 2026-10-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0035_daily_timetable_snapshot"
down_revision: Union[str, Sequence[str], None] = "0034_daily_substitution"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "daily_timetables",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("school_id", _UUID, sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("timetable_id", _UUID, sa.ForeignKey("timetables.id", ondelete="SET NULL"), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("finalized_by", _UUID, sa.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("finalized_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("school_id", "date", name="daily_timetables_school_id_date_key"),
    )


def downgrade() -> None:
    op.drop_table("daily_timetables")
