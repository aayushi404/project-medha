"""Phone-number login identity -- expand step.

Teachers and students will log in with phone + password (see
docs/phone-login-plan.md). This revision is the additive half of that change:

* Normalises every teacher and student phone to E.164 (+91XXXXXXXXXX) so that
  lookups compare like with like. Teachers were stored as bare 10 digits.
  Refuses to run if any row can't be normalised, or if two teachers collide
  once normalised -- run scripts/audit_phone_numbers.py first.
* Drops a `unique` constraint on students.phone_number if one exists. The
  model declared one, but no migration ever created it, so on a database built
  from migrations there is nothing to drop. The guard covers databases built
  another way.
* Adds a non-unique partial index on students.phone_number for lookups. Many
  students may share one phone -- siblings on a parent's number.
* Adds `phone_verified_at` to teachers and students (null until OTP exists).
* Adds `account_audit_events` for staff-issued password reset codes.

Deliberately NOT here: the "phone required" CHECK constraints. Old code (the
bulk importer, self-registration and /student/claim) still inserts students
without a phone, and a NOT VALID check still fires on new inserts. Those
checks land in 0032, after the Phase 3 code is live.

Revision ID: 0031_phone_login_identity
Revises: 0030_class_teacher_exclusivity
Create Date: 2026-10-03

"""
import re
from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031_phone_login_identity"
down_revision: Union[str, Sequence[str], None] = "0030_class_teacher_exclusivity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _e164_indian(raw: str) -> str | None:
    """Same rule as core/validators.e164_indian_mobile, inlined so this
    migration doesn't depend on application code that may change later."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if re.fullmatch(r"[6-9]\d{9}", digits):
        return "+91" + digits
    return None


def _normalise_phones(conn) -> None:
    problems: list[str] = []

    # ---- teachers: every teacher-role row needs a usable, unique phone -------
    teachers = conn.execute(
        sa.text("SELECT id, full_name, role, phone_number FROM teachers")
    ).fetchall()
    updates: list[tuple[str, object]] = []
    by_phone: dict[str, list[str]] = defaultdict(list)
    for tid, name, role, raw in teachers:
        if raw is None or not raw.strip():
            if role == "teacher":
                problems.append(f"teacher {name!r} ({tid}) has no phone number")
            continue
        norm = _e164_indian(raw)
        if norm is None:
            problems.append(f"teacher {name!r} ({tid}) has an unparseable phone {raw!r}")
            continue
        by_phone[norm].append(f"{name!r} ({tid})")
        if norm != raw:
            updates.append((tid, norm))
    for norm, holders in by_phone.items():
        if len(holders) > 1:
            problems.append(f"phone {norm} is shared by teachers {', '.join(holders)}")

    # ---- students: login phone is optional for now (see module docstring) -----
    students = conn.execute(sa.text("SELECT id, full_name, phone_number FROM students")).fetchall()
    student_updates: list[tuple[str, str]] = []
    for sid, name, raw in students:
        if raw is None or not raw.strip():
            continue
        norm = _e164_indian(raw)
        if norm is None:
            problems.append(f"student {name!r} ({sid}) has an unparseable phone {raw!r}")
            continue
        if norm != raw:
            student_updates.append((sid, norm))

    if problems:
        detail = "\n  - ".join(problems)
        raise RuntimeError(
            "0031_phone_login_identity refused to run; nothing was changed:\n  - "
            + detail
            + "\nFix these (or run scripts/audit_phone_numbers.py for the full report) and retry."
        )

    for tid, norm in updates:
        conn.execute(
            sa.text("UPDATE teachers SET phone_number = :p WHERE id = :id"), {"p": norm, "id": tid}
        )
    for sid, norm in student_updates:
        conn.execute(
            sa.text("UPDATE students SET phone_number = :p WHERE id = :id"), {"p": norm, "id": sid}
        )


def _drop_students_phone_unique_if_present(conn) -> None:
    # Find any unique constraint or unique index whose only column is
    # students.phone_number, whatever it's called.
    names = conn.execute(
        sa.text(
            """
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
            WHERE c.conrelid = 'students'::regclass
              AND c.contype = 'u'
              AND a.attname = 'phone_number'
              AND array_length(c.conkey, 1) = 1
            """
        )
    ).fetchall()
    for (name,) in names:
        op.drop_constraint(name, "students", type_="unique")

    index_names = conn.execute(
        sa.text(
            """
            SELECT i.relname
            FROM pg_index x
            JOIN pg_class i ON i.oid = x.indexrelid
            JOIN pg_class t ON t.oid = x.indrelid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.indkey[0]
            WHERE t.relname = 'students'
              AND x.indisunique
              AND NOT x.indisprimary
              AND x.indnatts = 1
              AND a.attname = 'phone_number'
              AND x.indpred IS NULL
            """
        )
    ).fetchall()
    for (name,) in index_names:
        op.drop_index(name, table_name="students")


def upgrade() -> None:
    conn = op.get_bind()

    _normalise_phones(conn)
    _drop_students_phone_unique_if_present(conn)

    op.create_index(
        "idx_students_phone",
        "students",
        ["phone_number"],
        postgresql_where=sa.text("phone_number IS NOT NULL"),
    )

    op.add_column("teachers", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("students", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "account_audit_events",
        sa.Column(
            "id",
            sa.UUID(),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        # who did it: always a teacher or principal row (staff, never a student)
        sa.Column("actor_teacher_id", sa.UUID(), sa.ForeignKey("teachers.id"), nullable=False),
        # who it was done to: exactly one of the two
        sa.Column("subject_teacher_id", sa.UUID(), sa.ForeignKey("teachers.id", ondelete="CASCADE")),
        sa.Column("subject_student_id", sa.UUID(), sa.ForeignKey("students.id", ondelete="CASCADE")),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "action IN ('reset_code_issued', 'password_reset_by_code')",
            name="chk_account_audit_action",
        ),
        sa.CheckConstraint(
            "num_nonnulls(subject_teacher_id, subject_student_id) = 1",
            name="chk_account_audit_subject",
        ),
    )
    op.create_index("idx_account_audit_actor", "account_audit_events", ["actor_teacher_id"])
    op.create_index("idx_account_audit_subject_teacher", "account_audit_events", ["subject_teacher_id"])
    op.create_index("idx_account_audit_subject_student", "account_audit_events", ["subject_student_id"])


def downgrade() -> None:
    # Phone normalisation is not reversed: E.164 is a strict superset of what
    # the old code accepted, so leaving it in place is safe.
    op.drop_index("idx_account_audit_subject_student", table_name="account_audit_events")
    op.drop_index("idx_account_audit_subject_teacher", table_name="account_audit_events")
    op.drop_index("idx_account_audit_actor", table_name="account_audit_events")
    op.drop_table("account_audit_events")
    op.drop_column("students", "phone_verified_at")
    op.drop_column("teachers", "phone_verified_at")
    op.drop_index("idx_students_phone", table_name="students")
