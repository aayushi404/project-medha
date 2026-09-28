"""split teacher/student login, step 2/3 (retarget) -- swap the student_id FK
on attendance_records, fee_payments, homework_status, report_card_marks, and
absence_calls from teachers(id) to students(id). No data changes: the values
are already correct thanks to backfill_teacher_students.py reusing each
migrated student's old teachers.id as their new students.id.

Must run AFTER backfill_teacher_students.py's phase 1 (so every existing
student_id value already exists in `students`) and BEFORE its phase 2 / the
old `teachers` rows are deleted -- deleting first would CASCADE through the
old teachers-pointing FK and destroy this data. See that script's docstring.

Revision ID: 0024_retarget_student_fks
Revises: 0023_split_students_expand
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0024_retarget_student_fks"
down_revision: Union[str, Sequence[str], None] = "0023_split_students_expand"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ["attendance_records", "fee_payments", "homework_status", "report_card_marks", "absence_calls"]


def upgrade() -> None:
    for table in _TABLES:
        op.drop_constraint(f"{table}_student_id_fkey", table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_student_id_fkey", table, "students", ["student_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    for table in _TABLES:
        op.drop_constraint(f"{table}_student_id_fkey", table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_student_id_fkey", table, "teachers", ["student_id"], ["id"], ondelete="CASCADE"
        )
