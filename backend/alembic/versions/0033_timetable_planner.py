"""Principal's timetable planner: period slots, timetables, timetable cells.

Additive only. Nothing existing is altered. The older per-grade
`timetable_entries` table (0016) stays as it is, because the student and
teacher timetable views still read it. The planner's cell table is
`timetable_cells` because that name is taken.

The no-double-booking rule is enforced here, by the partial unique index
`uq_cell_teacher_slot`, not only in the API.

Revision ID: 0033_timetable_planner
Revises: 0032_phone_login_contract
Create Date: 2026-10-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0033_timetable_planner"
down_revision: Union[str, Sequence[str], None] = "0032_phone_login_contract"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "period_slots",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("school_id", _UUID, sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("period_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("starts_at", sa.Time(), nullable=True),
        sa.Column("ends_at", sa.Time(), nullable=True),
        sa.Column("is_break", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.UniqueConstraint("school_id", "day_of_week", "period_number", name="period_slots_school_id_day_of_week_period_number_key"),
        sa.CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_slot_dow"),
        sa.CheckConstraint("period_number >= 1", name="chk_slot_period"),
    )

    op.create_table(
        "timetables",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("school_id", _UUID, sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("academic_year_id", _UUID, sa.ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_by", _UUID, sa.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('draft','published','archived')", name="chk_tt_status"),
    )
    op.create_index("idx_timetables_school_year", "timetables", ["school_id", "academic_year_id"])
    op.create_index(
        "uq_timetables_one_published",
        "timetables",
        ["school_id", "academic_year_id"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
    )

    op.create_table(
        "timetable_cells",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("timetable_id", _UUID, sa.ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_section_id", _UUID, sa.ForeignKey("class_sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_slot_id", _UUID, sa.ForeignKey("period_slots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", _UUID, sa.ForeignKey("subjects.id"), nullable=False),
        sa.Column("teacher_id", _UUID, sa.ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("timetable_id", "class_section_id", "period_slot_id", name="uq_cell_section_slot"),
    )
    op.create_index(
        "uq_cell_teacher_slot",
        "timetable_cells",
        ["timetable_id", "teacher_id", "period_slot_id"],
        unique=True,
        postgresql_where=sa.text("teacher_id IS NOT NULL"),
    )
    op.create_index("idx_cells_timetable_slot", "timetable_cells", ["timetable_id", "period_slot_id"])
    op.create_index("idx_cells_teacher", "timetable_cells", ["timetable_id", "teacher_id"])


def downgrade() -> None:
    op.drop_index("idx_cells_teacher", table_name="timetable_cells")
    op.drop_index("idx_cells_timetable_slot", table_name="timetable_cells")
    op.drop_index("uq_cell_teacher_slot", table_name="timetable_cells")
    op.drop_table("timetable_cells")
    op.drop_index("uq_timetables_one_published", table_name="timetables")
    op.drop_index("idx_timetables_school_year", table_name="timetables")
    op.drop_table("timetables")
    op.drop_table("period_slots")
