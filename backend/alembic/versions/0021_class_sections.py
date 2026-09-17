"""class sections + a school-records student directory (principal dashboard,
phase 2) -- see docs/phase-2/Medha-principal-dashboard.md. Deliberately
separate from the `teachers` role='student' login rows: this is a
principal-managed roster (admission no., guardian contact, enrolment
history), independent of whether that child has ever signed in to Medha.

Revision ID: 0021_class_sections
Revises: 0020_notes_practice
Create Date: 2026-09-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021_class_sections"
down_revision: Union[str, Sequence[str], None] = "0020_notes_practice"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "academic_years",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("is_current", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "label"),
    )

    op.create_table(
        "class_sections",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("academic_year_id", sa.UUID(), nullable=False),
        sa.Column("grade_id", sa.UUID(), nullable=False),
        sa.Column("section", sa.String(), server_default="A", nullable=False),
        sa.Column("class_teacher_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["grade_id"], ["grades.id"]),
        sa.ForeignKeyConstraint(["class_teacher_id"], ["teachers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "academic_year_id", "grade_id", "section"),
    )
    op.create_index(
        "idx_sections_school_year", "class_sections", ["school_id", "academic_year_id"]
    )

    op.create_table(
        "students",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("admission_number", sa.String(), nullable=True),
        sa.Column("guardian_name", sa.String(), nullable=True),
        sa.Column("guardian_relation", sa.String(), nullable=True),
        sa.Column("guardian_phone", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="active", nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "admission_number"),
        sa.CheckConstraint(
            "status IN ('active','transferred','dropped_out','graduated')",
            name="chk_student_status",
        ),
    )
    op.create_index("idx_students_school", "students", ["school_id"])

    op.create_table(
        "student_enrollments",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("class_section_id", sa.UUID(), nullable=False),
        sa.Column("academic_year_id", sa.UUID(), nullable=False),
        sa.Column("roll_number", sa.Integer(), nullable=True),
        sa.Column("enrolled_on", sa.Date(), nullable=True),
        sa.Column("left_on", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_section_id"], ["class_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "academic_year_id"),
        sa.UniqueConstraint("class_section_id", "roll_number"),
    )
    op.create_index(
        "idx_enrollments_section", "student_enrollments", ["class_section_id", "roll_number"]
    )


def downgrade() -> None:
    op.drop_index("idx_enrollments_section", table_name="student_enrollments")
    op.drop_table("student_enrollments")
    op.drop_index("idx_students_school", table_name="students")
    op.drop_table("students")
    op.drop_index("idx_sections_school_year", table_name="class_sections")
    op.drop_table("class_sections")
    op.drop_table("academic_years")
