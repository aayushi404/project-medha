"""fee payments: a manual ledger, no payment gateway

Revision ID: 0015_fees
Revises: 0014_library
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_fees"
down_revision: Union[str, Sequence[str], None] = "0014_library"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fee_payments",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("fee_type", sa.String(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("logged_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["logged_by"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_fee_payments_student", "fee_payments", ["student_id", sa.text("payment_date DESC")])


def downgrade() -> None:
    op.drop_index("idx_fee_payments_student", table_name="fee_payments")
    op.drop_table("fee_payments")
