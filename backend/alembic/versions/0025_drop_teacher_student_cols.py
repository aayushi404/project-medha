"""split teacher/student login, step 3/3 (contract) -- drop the now-unused
student-only columns from `teachers` (grade_id, roll_number, guardian_*) and
narrow chk_teachers_role to admin|principal|teacher. Only safe to run once
no `teachers` row with role='student' remains -- i.e. after
backfill_teacher_students.py's phase 2 (--delete) has completed.

Revision ID: 0025_drop_teacher_student_cols
Revises: 0024_retarget_student_fks
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025_drop_teacher_student_cols"
down_revision: Union[str, Sequence[str], None] = "0024_retarget_student_fks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    remaining = conn.execute(sa.text("SELECT count(*) FROM teachers WHERE role = 'student'")).scalar()
    if remaining:
        raise RuntimeError(
            f"{remaining} teachers row(s) still have role='student' -- run "
            "backfill_teacher_students.py (both phases) before this migration."
        )

    op.drop_constraint("chk_teachers_role", "teachers", type_="check")
    op.create_check_constraint("chk_teachers_role", "teachers", "role IN ('admin', 'principal', 'teacher')")

    op.drop_index("idx_teachers_grade", table_name="teachers")
    op.drop_index("idx_one_student_per_roll", table_name="teachers")

    op.drop_column("teachers", "grade_id")
    op.drop_column("teachers", "roll_number")
    op.drop_column("teachers", "guardian_name")
    op.drop_column("teachers", "guardian_phone")
    op.drop_column("teachers", "guardian_relation")


def downgrade() -> None:
    op.add_column("teachers", sa.Column("guardian_relation", sa.String(), nullable=True))
    op.add_column("teachers", sa.Column("guardian_phone", sa.String(), nullable=True))
    op.add_column("teachers", sa.Column("guardian_name", sa.String(), nullable=True))
    op.add_column("teachers", sa.Column("roll_number", sa.String(), nullable=True))
    op.add_column("teachers", sa.Column("grade_id", sa.UUID(), nullable=True))

    op.create_index("idx_teachers_grade", "teachers", ["grade_id"])
    op.create_index(
        "idx_one_student_per_roll",
        "teachers",
        ["school_id", "grade_id", "roll_number"],
        unique=True,
        postgresql_where=sa.text("role = 'student' AND roll_number IS NOT NULL"),
    )
    op.create_foreign_key(None, "teachers", "grades", ["grade_id"], ["id"])

    op.drop_constraint("chk_teachers_role", "teachers", type_="check")
    op.create_check_constraint(
        "chk_teachers_role", "teachers", "role IN ('admin', 'principal', 'teacher', 'student')"
    )
