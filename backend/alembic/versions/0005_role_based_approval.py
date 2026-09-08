"""role-based approval: teacher profile fields, approval columns, approval_events

Admin approves principals; principals approve teachers. One `teachers` table,
three roles (admin | principal | teacher), gated by `approval_status`.

Existing rows are pre-launch seed data -- backfilled to `approved` so the
seeded test accounts keep working. New registrations land as `pending`.

Revision ID: 0005_role_approval
Revises: 0004_email_password_auth
Create Date: 2026-08-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_role_approval"
down_revision: Union[str, Sequence[str], None] = "0004_email_password_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- teacher profile fields (collected on the registration form) ---
    op.add_column("teachers", sa.Column("years_of_experience", sa.Integer(), nullable=True))
    op.add_column("teachers", sa.Column("employee_code", sa.String(), nullable=True))
    op.add_column("teachers", sa.Column("qualification", sa.String(), nullable=True))
    op.create_check_constraint(
        "chk_experience_range",
        "teachers",
        "years_of_experience IS NULL OR (years_of_experience >= 0 AND years_of_experience <= 50)",
    )

    # --- approval columns ---
    op.add_column(
        "teachers",
        sa.Column(
            "approval_status",
            sa.String(),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column("teachers", sa.Column("approved_by", sa.UUID(), nullable=True))
    op.add_column(
        "teachers", sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True)
    )
    op.add_column("teachers", sa.Column("rejection_reason", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_teachers_approved_by", "teachers", "teachers", ["approved_by"], ["id"]
    )
    op.create_check_constraint(
        "chk_teachers_role", "teachers", "role IN ('admin', 'principal', 'teacher')"
    )
    op.create_check_constraint(
        "chk_teachers_approval_status",
        "teachers",
        "approval_status IN ('pending', 'approved', 'rejected')",
    )

    # existing rows are pre-launch seed data -- let them keep working
    op.execute("UPDATE teachers SET approval_status = 'approved'")

    # queue lookups: principals pending admin review, teachers pending principal review
    op.create_index(
        "idx_teachers_pending",
        "teachers",
        ["school_id", "role", "approval_status"],
        postgresql_where=sa.text("approval_status = 'pending'"),
    )
    # at most one approved principal per school
    op.create_index(
        "idx_one_approved_principal_per_school",
        "teachers",
        ["school_id"],
        unique=True,
        postgresql_where=sa.text("role = 'principal' AND approval_status = 'approved'"),
    )

    # --- approval audit log ---
    op.create_table(
        "approval_events",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False
        ),
        sa.Column("subject_user_id", sa.UUID(), nullable=False),
        sa.Column("actor_user_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),  # approved | rejected | revoked
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["subject_user_id"], ["teachers.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "action IN ('approved', 'rejected', 'revoked')", name="chk_approval_action"
        ),
    )
    op.create_index(
        "idx_approval_events_subject", "approval_events", ["subject_user_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_approval_events_subject", table_name="approval_events")
    op.drop_table("approval_events")

    op.drop_index("idx_one_approved_principal_per_school", table_name="teachers")
    op.drop_index("idx_teachers_pending", table_name="teachers")
    op.drop_constraint("chk_teachers_approval_status", "teachers", type_="check")
    op.drop_constraint("chk_teachers_role", "teachers", type_="check")
    op.drop_constraint("fk_teachers_approved_by", "teachers", type_="foreignkey")
    op.drop_column("teachers", "rejection_reason")
    op.drop_column("teachers", "approved_at")
    op.drop_column("teachers", "approved_by")
    op.drop_column("teachers", "approval_status")

    op.drop_constraint("chk_experience_range", "teachers", type_="check")
    op.drop_column("teachers", "qualification")
    op.drop_column("teachers", "employee_code")
    op.drop_column("teachers", "years_of_experience")
