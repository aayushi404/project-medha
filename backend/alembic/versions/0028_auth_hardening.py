"""Auth hardening schema: DB-backed throttle counters, one-time email tokens
(verification + password reset), email_verified_at on both identity tables,
refresh-token families (reuse detection) with a unique hash index, and
nullable MFA columns (hook only, not enforced yet).

Existing approved accounts were vetted by a human approver before this
migration, so they are grandfathered as email-verified; pending accounts must
verify before they can be approved.

Revision ID: 0028_auth_hardening
Revises: 0027_drop_student_grade_roll
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028_auth_hardening"
down_revision: Union[str, Sequence[str], None] = "0027_drop_student_grade_roll"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- shared throttle counters (login, register, reset, ...) ---
    op.create_table(
        "auth_throttle",
        sa.Column("scope", sa.String(), nullable=False),
        sa.Column("key_hash", sa.String(), nullable=False),  # sha256 of the identifier, never the raw email/IP
        sa.Column("count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("window_start", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("scope", "key_hash"),
    )
    op.create_index("idx_auth_throttle_window", "auth_throttle", ["window_start"])

    # --- one-time tokens (email verification, password reset) ---
    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("purpose", sa.String(), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=True),
        sa.Column("student_id", sa.UUID(), nullable=True),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("num_nonnulls(teacher_id, student_id) = 1", name="chk_auth_tokens_actor"),
        sa.CheckConstraint("purpose IN ('verify_email', 'reset_password')", name="chk_auth_tokens_purpose"),
    )
    op.create_index("uq_auth_tokens_hash", "auth_tokens", ["token_hash"], unique=True)
    op.create_index("idx_auth_tokens_teacher", "auth_tokens", ["teacher_id", "purpose"])
    op.create_index("idx_auth_tokens_student", "auth_tokens", ["student_id", "purpose"])

    # --- email verification + MFA hook on both identity tables ---
    for table in ("teachers", "students"):
        op.add_column(table, sa.Column("email_verified_at", sa.TIMESTAMP(timezone=True), nullable=True))
        op.add_column(table, sa.Column("mfa_secret", sa.String(), nullable=True))
        op.add_column(table, sa.Column("mfa_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False))
        op.execute(f"UPDATE {table} SET email_verified_at = now() WHERE approval_status = 'approved'")

    # --- refresh-token families + unique hash ---
    op.add_column("auth_sessions", sa.Column("family_id", sa.UUID(), nullable=True))
    op.add_column("auth_sessions", sa.Column("replaced_by_id", sa.UUID(), nullable=True))
    op.execute("UPDATE auth_sessions SET family_id = id WHERE family_id IS NULL")
    op.alter_column("auth_sessions", "family_id", nullable=False)
    # Any duplicate hashes would be a bug (tokens are 256-bit random); drop
    # older duplicates defensively so the unique index can be created.
    op.execute(
        "DELETE FROM auth_sessions a USING auth_sessions b "
        "WHERE a.refresh_token_hash = b.refresh_token_hash AND a.issued_at < b.issued_at"
    )
    op.create_index("uq_auth_sessions_hash", "auth_sessions", ["refresh_token_hash"], unique=True)
    op.create_index("idx_auth_sessions_family", "auth_sessions", ["family_id"])


def downgrade() -> None:
    op.drop_index("idx_auth_sessions_family", table_name="auth_sessions")
    op.drop_index("uq_auth_sessions_hash", table_name="auth_sessions")
    op.drop_column("auth_sessions", "replaced_by_id")
    op.drop_column("auth_sessions", "family_id")
    for table in ("students", "teachers"):
        op.drop_column(table, "mfa_enabled")
        op.drop_column(table, "mfa_secret")
        op.drop_column(table, "email_verified_at")
    op.drop_table("auth_tokens")
    op.drop_table("auth_throttle")
