"""split teacher/student login, step 1/3 (expand) -- purely additive: login +
grade/roll + approval columns on `students`, `teaching_assignments`, and a
dual-nullable-pair actor shape (teacher OR student) on auth_sessions,
approval_events, chat_sessions, notifications, device_tokens. See
alembic/versions/0024_retarget_student_fks.py (retargets the 5
student_id-only FKs once a backfill script has populated `students`) and
0025_drop_teacher_student_columns.py (drops the now-unused columns on
`teachers`) for the remaining two steps of this migration.

Revision ID: 0023_split_students_expand
Revises: 0022_absence_calls
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_split_students_expand"
down_revision: Union[str, Sequence[str], None] = "0022_absence_calls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- students: login credential + grade/roll placement + approval workflow ---
    op.add_column("students", sa.Column("email", sa.String(), nullable=True))
    op.add_column("students", sa.Column("password_hash", sa.String(), nullable=True))
    op.add_column("students", sa.Column("google_sub", sa.String(), nullable=True))
    op.add_column("students", sa.Column("phone_number", sa.String(), nullable=True))
    op.add_column(
        "students",
        sa.Column("preferred_language", sa.String(), server_default="hi-BiharBoli", nullable=False),
    )
    op.add_column("students", sa.Column("grade_id", sa.UUID(), nullable=True))
    op.add_column("students", sa.Column("roll_number", sa.String(), nullable=True))
    op.add_column(
        "students", sa.Column("approval_status", sa.String(), server_default="pending", nullable=False)
    )
    op.add_column("students", sa.Column("approved_by", sa.UUID(), nullable=True))
    op.add_column("students", sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("students", sa.Column("rejection_reason", sa.String(), nullable=True))
    op.add_column(
        "students", sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False)
    )
    op.create_foreign_key(None, "students", "grades", ["grade_id"], ["id"])
    op.create_foreign_key(None, "students", "teachers", ["approved_by"], ["id"])
    op.create_index("idx_students_grade", "students", ["grade_id"])
    op.create_index(
        "idx_one_student_per_roll_v2",
        "students",
        ["school_id", "grade_id", "roll_number"],
        unique=True,
        postgresql_where=sa.text("roll_number IS NOT NULL"),
    )
    op.create_index(
        "idx_students_pending",
        "students",
        ["school_id", "approval_status"],
        postgresql_where=sa.text("approval_status = 'pending'"),
    )
    op.create_index(
        "uq_students_email", "students", ["email"], unique=True, postgresql_where=sa.text("email IS NOT NULL")
    )
    op.create_index(
        "uq_students_google_sub",
        "students",
        ["google_sub"],
        unique=True,
        postgresql_where=sa.text("google_sub IS NOT NULL"),
    )
    op.create_check_constraint(
        "chk_students_approval_status", "students", "approval_status IN ('pending','approved','rejected')"
    )

    # --- teaching_assignments: a teacher's link to a real class ---
    op.create_table(
        "teaching_assignments",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("class_section_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_section_id"], ["class_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id", "class_section_id", "subject_id"),
    )
    op.create_index("idx_assignments_section", "teaching_assignments", ["class_section_id"])

    # --- dual-nullable-actor pair: auth_sessions, approval_events, chat_sessions,
    # notifications, device_tokens. Both columns nullable, CHECK exactly one set. ---
    op.alter_column("auth_sessions", "teacher_id", nullable=True)
    op.add_column("auth_sessions", sa.Column("student_id", sa.UUID(), nullable=True))
    op.create_foreign_key(None, "auth_sessions", "students", ["student_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_sessions_student", "auth_sessions", ["student_id"])
    op.create_check_constraint(
        "chk_auth_sessions_actor", "auth_sessions", "num_nonnulls(teacher_id, student_id) = 1"
    )

    op.alter_column("approval_events", "subject_user_id", nullable=True)
    op.add_column("approval_events", sa.Column("subject_student_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        None, "approval_events", "students", ["subject_student_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("idx_approval_events_subject_student", "approval_events", ["subject_student_id"])
    op.create_check_constraint(
        "chk_approval_events_subject",
        "approval_events",
        "num_nonnulls(subject_user_id, subject_student_id) = 1",
    )

    op.alter_column("chat_sessions", "teacher_id", nullable=True)
    op.add_column("chat_sessions", sa.Column("student_id", sa.UUID(), nullable=True))
    op.create_foreign_key(None, "chat_sessions", "students", ["student_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_chat_sessions_student", "chat_sessions", ["student_id", sa.text("updated_at DESC")])
    op.create_check_constraint(
        "chk_chat_sessions_actor", "chat_sessions", "num_nonnulls(teacher_id, student_id) = 1"
    )

    op.alter_column("notifications", "recipient_id", nullable=True)
    op.add_column("notifications", sa.Column("recipient_student_id", sa.UUID(), nullable=True))
    op.add_column("notifications", sa.Column("sender_student_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        None, "notifications", "students", ["recipient_student_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(None, "notifications", "students", ["sender_student_id"], ["id"])
    op.create_index(
        "idx_notifications_recipient_student",
        "notifications",
        ["recipient_student_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_notifications_unread_student",
        "notifications",
        ["recipient_student_id"],
        postgresql_where=sa.text("read_at IS NULL"),
    )
    op.create_check_constraint(
        "chk_notifications_recipient",
        "notifications",
        "num_nonnulls(recipient_id, recipient_student_id) = 1",
    )
    op.create_check_constraint(
        "chk_notifications_sender", "notifications", "num_nonnulls(sender_id, sender_student_id) <= 1"
    )

    op.alter_column("device_tokens", "user_id", nullable=True)
    op.add_column("device_tokens", sa.Column("student_id", sa.UUID(), nullable=True))
    op.create_foreign_key(None, "device_tokens", "students", ["student_id"], ["id"], ondelete="CASCADE")
    op.create_check_constraint(
        "chk_device_tokens_actor", "device_tokens", "num_nonnulls(user_id, student_id) = 1"
    )


def downgrade() -> None:
    op.drop_constraint("chk_device_tokens_actor", "device_tokens", type_="check")
    op.drop_constraint("device_tokens_student_id_fkey", "device_tokens", type_="foreignkey")
    op.drop_column("device_tokens", "student_id")
    op.alter_column("device_tokens", "user_id", nullable=False)

    op.drop_constraint("chk_notifications_sender", "notifications", type_="check")
    op.drop_constraint("chk_notifications_recipient", "notifications", type_="check")
    op.drop_index("idx_notifications_unread_student", table_name="notifications")
    op.drop_index("idx_notifications_recipient_student", table_name="notifications")
    op.drop_constraint("notifications_sender_student_id_fkey", "notifications", type_="foreignkey")
    op.drop_constraint("notifications_recipient_student_id_fkey", "notifications", type_="foreignkey")
    op.drop_column("notifications", "sender_student_id")
    op.drop_column("notifications", "recipient_student_id")
    op.alter_column("notifications", "recipient_id", nullable=False)

    op.drop_constraint("chk_chat_sessions_actor", "chat_sessions", type_="check")
    op.drop_index("idx_chat_sessions_student", table_name="chat_sessions")
    op.drop_constraint("chat_sessions_student_id_fkey", "chat_sessions", type_="foreignkey")
    op.drop_column("chat_sessions", "student_id")
    op.alter_column("chat_sessions", "teacher_id", nullable=False)

    op.drop_constraint("chk_approval_events_subject", "approval_events", type_="check")
    op.drop_index("idx_approval_events_subject_student", table_name="approval_events")
    op.drop_constraint("approval_events_subject_student_id_fkey", "approval_events", type_="foreignkey")
    op.drop_column("approval_events", "subject_student_id")
    op.alter_column("approval_events", "subject_user_id", nullable=False)

    op.drop_constraint("chk_auth_sessions_actor", "auth_sessions", type_="check")
    op.drop_index("idx_sessions_student", table_name="auth_sessions")
    op.drop_constraint("auth_sessions_student_id_fkey", "auth_sessions", type_="foreignkey")
    op.drop_column("auth_sessions", "student_id")
    op.alter_column("auth_sessions", "teacher_id", nullable=False)

    op.drop_index("idx_assignments_section", table_name="teaching_assignments")
    op.drop_table("teaching_assignments")

    op.drop_constraint("chk_students_approval_status", "students", type_="check")
    op.drop_index("uq_students_google_sub", table_name="students")
    op.drop_index("uq_students_email", table_name="students")
    op.drop_index("idx_students_pending", table_name="students")
    op.drop_index("idx_one_student_per_roll_v2", table_name="students")
    op.drop_index("idx_students_grade", table_name="students")
    op.drop_constraint("students_approved_by_fkey", "students", type_="foreignkey")
    op.drop_constraint("students_grade_id_fkey", "students", type_="foreignkey")
    op.drop_column("students", "is_active")
    op.drop_column("students", "rejection_reason")
    op.drop_column("students", "approved_at")
    op.drop_column("students", "approved_by")
    op.drop_column("students", "approval_status")
    op.drop_column("students", "roll_number")
    op.drop_column("students", "grade_id")
    op.drop_column("students", "preferred_language")
    op.drop_column("students", "phone_number")
    op.drop_column("students", "google_sub")
    op.drop_column("students", "password_hash")
    op.drop_column("students", "email")
