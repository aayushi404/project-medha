"""student role: class + roll number, optional credentials, activation

Adds `student` as a fourth role in the `teachers` table. A student registers with
their school + class + roll number (no credential), a teacher approves, then the
student sets an email + password ("activates") and can log in.

Because a student row exists before it has a credential, `email` and
`password_hash` become nullable. The email uniqueness guarantee is preserved as a
partial unique index over the non-NULL rows.

Revision ID: 0006_student_role
Revises: 0005_role_approval
Create Date: 2026-08-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_student_role"
down_revision: Union[str, Sequence[str], None] = "0005_role_approval"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- student profile fields ---
    op.add_column("teachers", sa.Column("grade_id", sa.UUID(), nullable=True))
    op.add_column("teachers", sa.Column("roll_number", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_teachers_grade", "teachers", "grades", ["grade_id"], ["id"]
    )
    op.create_index("idx_teachers_grade", "teachers", ["grade_id"])

    # --- credentials optional until a student activates ---
    op.drop_constraint("teachers_email_key", "teachers", type_="unique")
    op.alter_column("teachers", "email", existing_type=sa.String(), nullable=True)
    op.alter_column(
        "teachers", "password_hash", existing_type=sa.String(), nullable=True
    )
    op.create_index(
        "uq_teachers_email",
        "teachers",
        ["email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )

    # --- role check now allows 'student' ---
    op.drop_constraint("chk_teachers_role", "teachers", type_="check")
    op.create_check_constraint(
        "chk_teachers_role",
        "teachers",
        "role IN ('admin', 'principal', 'teacher', 'student')",
    )

    # one student per (school, class, roll number)
    op.create_index(
        "idx_one_student_per_roll",
        "teachers",
        ["school_id", "grade_id", "roll_number"],
        unique=True,
        postgresql_where=sa.text("role = 'student' AND roll_number IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_one_student_per_roll", table_name="teachers")

    op.drop_constraint("chk_teachers_role", "teachers", type_="check")
    op.create_check_constraint(
        "chk_teachers_role",
        "teachers",
        "role IN ('admin', 'principal', 'teacher')",
    )

    op.drop_index("uq_teachers_email", table_name="teachers")
    # rows added while email was nullable must be resolved before re-tightening
    op.execute(
        "UPDATE teachers SET email = 'disabled+' || id || '@invalid.local' "
        "WHERE email IS NULL"
    )
    op.execute(
        "UPDATE teachers SET password_hash = 'disabled' WHERE password_hash IS NULL"
    )
    op.alter_column(
        "teachers", "password_hash", existing_type=sa.String(), nullable=False
    )
    op.alter_column("teachers", "email", existing_type=sa.String(), nullable=False)
    op.create_unique_constraint("teachers_email_key", "teachers", ["email"])

    op.drop_index("idx_teachers_grade", table_name="teachers")
    op.drop_constraint("fk_teachers_grade", "teachers", type_="foreignkey")
    op.drop_column("teachers", "roll_number")
    op.drop_column("teachers", "grade_id")
