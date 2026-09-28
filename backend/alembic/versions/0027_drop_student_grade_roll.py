"""Final cleanup of the section-based rewiring pass: drop the deprecated
`students.grade_id`/`roll_number` columns now that every module (student
registration, teacher/principal rosters, attendance, homework, report
cards, tutor+English, OMR, notifications, absence calls) reads a student's
class placement via `student_enrollments` instead. Verified via grep
(backend/src/backend) that nothing outside this model definition still
reads these columns before writing this migration.

Ordering hazard: run this only after every module above is deployed and
confirmed working -- applied early, several services would break
immediately on the now-missing columns.

Revision ID: 0027_drop_student_grade_roll
Revises: 0026_homework_class_section
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027_drop_student_grade_roll"
down_revision: Union[str, Sequence[str], None] = "0026_homework_class_section"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("idx_one_student_per_roll_v2", table_name="students")
    op.drop_index("idx_students_grade", table_name="students")
    op.drop_constraint("students_grade_id_fkey", "students", type_="foreignkey")
    op.drop_column("students", "roll_number")
    op.drop_column("students", "grade_id")


def downgrade() -> None:
    op.add_column("students", sa.Column("grade_id", sa.UUID(), nullable=True))
    op.add_column("students", sa.Column("roll_number", sa.String(), nullable=True))
    op.create_foreign_key("students_grade_id_fkey", "students", "grades", ["grade_id"], ["id"])
    op.create_index("idx_students_grade", "students", ["grade_id"])
    op.create_index(
        "idx_one_student_per_roll_v2",
        "students",
        ["school_id", "grade_id", "roll_number"],
        unique=True,
        postgresql_where=sa.text("roll_number IS NOT NULL"),
    )
