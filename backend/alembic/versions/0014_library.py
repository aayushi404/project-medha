"""e-library: curated links, not a file-storage system

Revision ID: 0014_library
Revises: 0013_report_card
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_library"
down_revision: Union[str, Sequence[str], None] = "0013_report_card"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "library_items",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=True),
        sa.Column("grade_id", sa.UUID(), nullable=True),
        sa.Column("subject_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("added_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["added_by"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("library_items")
