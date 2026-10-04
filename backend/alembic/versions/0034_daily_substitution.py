"""Daily cover: reserve teachers, teacher absences, period substitutions.

Additive, with one change to an existing table. `teaching_assignments` gains a
`role` ('primary' | 'reserve'), and `subject_id` becomes nullable because a
reserve covers any subject in the section. Existing rows default to 'primary',
so nothing that reads them changes meaning.

The base timetable (`timetable_cells`) is never written by this feature. A day's
absences and cover live in `teacher_absences` and `period_substitutions`, and
override the plan when a day's board is read.

Revision ID: 0034_daily_substitution
Revises: 0033_timetable_planner
Create Date: 2026-10-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0034_daily_substitution"
down_revision: Union[str, Sequence[str], None] = "0033_timetable_planner"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column(
        "teaching_assignments",
        sa.Column("role", sa.String(), server_default=sa.text("'primary'"), nullable=False),
    )
    op.alter_column("teaching_assignments", "subject_id", existing_type=_UUID, nullable=True)
    op.create_check_constraint(
        "chk_assign_role", "teaching_assignments", "role IN ('primary','reserve')"
    )
    op.create_check_constraint(
        "chk_assign_subject", "teaching_assignments", "role = 'reserve' OR subject_id IS NOT NULL"
    )
    op.create_index(
        "uq_assign_reserve",
        "teaching_assignments",
        ["teacher_id", "class_section_id"],
        unique=True,
        postgresql_where=sa.text("role = 'reserve'"),
    )

    op.create_table(
        "teacher_absences",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("school_id", _UUID, sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_id", _UUID, sa.ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("is_full_day", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("from_period_number", sa.Integer(), nullable=True),
        sa.Column("to_period_number", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("marked_by", _UUID, sa.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("teacher_id", "date"),
        sa.CheckConstraint(
            "is_full_day OR (from_period_number IS NOT NULL AND to_period_number IS NOT NULL "
            "AND from_period_number <= to_period_number)",
            name="chk_absence_range",
        ),
    )
    op.create_index("idx_absences_school_date", "teacher_absences", ["school_id", "date"])

    op.create_table(
        "period_substitutions",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("school_id", _UUID, sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "timetable_cell_id", _UUID, sa.ForeignKey("timetable_cells.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("class_section_id", _UUID, sa.ForeignKey("class_sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_slot_id", _UUID, sa.ForeignKey("period_slots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", _UUID, sa.ForeignKey("subjects.id"), nullable=True),
        sa.Column("original_teacher_id", _UUID, sa.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("substitute_teacher_id", _UUID, sa.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'assigned'"), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("assigned_by", _UUID, sa.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("date", "timetable_cell_id", name="uq_sub_cell_date"),
        sa.CheckConstraint("status IN ('assigned','self_study','cancelled')", name="chk_sub_status"),
        sa.CheckConstraint("status <> 'assigned' OR substitute_teacher_id IS NOT NULL", name="chk_sub_teacher"),
    )
    op.create_index(
        "uq_sub_teacher_slot",
        "period_substitutions",
        ["date", "substitute_teacher_id", "period_slot_id"],
        unique=True,
        postgresql_where=sa.text("substitute_teacher_id IS NOT NULL AND status = 'assigned'"),
    )
    op.create_index("idx_subs_school_date", "period_substitutions", ["school_id", "date"])


def downgrade() -> None:
    op.drop_index("idx_subs_school_date", table_name="period_substitutions")
    op.drop_index("uq_sub_teacher_slot", table_name="period_substitutions")
    op.drop_table("period_substitutions")
    op.drop_index("idx_absences_school_date", table_name="teacher_absences")
    op.drop_table("teacher_absences")
    op.drop_index("uq_assign_reserve", table_name="teaching_assignments")
    op.drop_constraint("chk_assign_subject", "teaching_assignments", type_="check")
    op.drop_constraint("chk_assign_role", "teaching_assignments", type_="check")
    # reserves have no subject; removing them is the only way back to NOT NULL
    op.execute("DELETE FROM teaching_assignments WHERE role = 'reserve'")
    op.alter_column("teaching_assignments", "subject_id", existing_type=_UUID, nullable=False)
    op.drop_column("teaching_assignments", "role")
