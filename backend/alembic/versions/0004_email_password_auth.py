"""email + password auth: email/password_hash NOT NULL, phone optional, drop OTP

Existing rows with no usable credential get a placeholder email + a sentinel
password_hash (bcrypt-invalid, so it never verifies) -- pre-launch test data.

Revision ID: 0004_email_password_auth
Revises: 0003_phase1
Create Date: 2026-08-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_email_password_auth"
down_revision: Union[str, Sequence[str], None] = "0003_phase1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SENTINEL_HASH = "disabled"  # not a valid bcrypt hash -> verify_password() -> False


def upgrade() -> None:
    """Upgrade schema."""
    # backfill so the NOT NULL constraints can be applied
    op.execute(
        "update teachers set email = 'disabled+' || id || '@invalid.local' where email is null"
    )
    op.execute("update teachers set email = lower(email)")
    op.execute(
        f"update teachers set password_hash = '{_SENTINEL_HASH}' where password_hash is null"
    )

    op.alter_column("teachers", "email", existing_type=sa.String(), nullable=False)
    op.alter_column("teachers", "password_hash", existing_type=sa.String(), nullable=False)
    op.alter_column("teachers", "phone_number", existing_type=sa.String(), nullable=True)

    op.drop_index("idx_otp_phone", table_name="otp_verifications")
    op.drop_table("otp_verifications")


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        "otp_verifications",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("phone_number", sa.String(), nullable=False),
        sa.Column("otp_hash", sa.String(), nullable=False),
        sa.Column("purpose", sa.String(), server_default="login", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("verified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_otp_phone", "otp_verifications", ["phone_number", "expires_at"], unique=False
    )

    op.alter_column("teachers", "phone_number", existing_type=sa.String(), nullable=False)
    op.alter_column("teachers", "password_hash", existing_type=sa.String(), nullable=True)
    op.alter_column("teachers", "email", existing_type=sa.String(), nullable=True)
