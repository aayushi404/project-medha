"""Phone-number login identity -- contract step.

Second half of the phone-login change (see docs/phone-login-plan.md). 0031 added
the columns and normalised the phones. This revision makes the phone a hard
requirement and removes what logins no longer use:

* Students must have a login phone, in E.164 form (+91XXXXXXXXXX). Teachers
  with the 'teacher' role must have one too. Principals and admins may leave
  it blank. Every write path now sends a normalised, present number, so the
  checks hold for new rows.
* Drops `students.admission_number` and its unique constraint. Nothing reads or
  writes it since Phase 3.

The phone checks are added NOT VALID and then validated. ADD ... NOT VALID takes
only a brief lock and skips the scan; VALIDATE CONSTRAINT scans the table but
doesn't block writes in the same way. Before either step, the migration lists
every row that would fail, in one message, and changes nothing. Fix those rows
(or run scripts/audit_phone_numbers.py) and retry.

Downgrade restores the admission column and its unique constraint (empty), and
drops the phone checks. It does not restore admission numbers; there were none
to restore once 0032 has run.

Revision ID: 0032_phone_login_contract
Revises: 0031_phone_login_identity
Create Date: 2026-10-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032_phone_login_contract"
down_revision: Union[str, Sequence[str], None] = "0031_phone_login_identity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# E.164 Indian mobile, as written by core/validators.e164_indian_mobile.
_E164_RE = r"^\+91[6-9][0-9]{9}$"


def _refuse_if_blocked(conn) -> None:
    """Collect every row that would fail the new checks, then refuse at once."""
    problems: list[str] = []

    for sid, name in conn.execute(
        sa.text("SELECT id, full_name FROM students WHERE phone_number IS NULL OR phone_number = ''")
    ).fetchall():
        problems.append(f"student {name!r} ({sid}) has no login phone")
    for sid, name, raw in conn.execute(
        sa.text(
            "SELECT id, full_name, phone_number FROM students "
            "WHERE phone_number IS NOT NULL AND phone_number !~ :re"
        ),
        {"re": _E164_RE},
    ).fetchall():
        problems.append(f"student {name!r} ({sid}) has a phone not in +91XXXXXXXXXX form: {raw!r}")

    for tid, name in conn.execute(
        sa.text(
            "SELECT id, full_name FROM teachers "
            "WHERE role = 'teacher' AND (phone_number IS NULL OR phone_number = '')"
        )
    ).fetchall():
        problems.append(f"teacher {name!r} ({tid}) has no phone number")
    for tid, name, raw in conn.execute(
        sa.text(
            "SELECT id, full_name, phone_number FROM teachers "
            "WHERE phone_number IS NOT NULL AND phone_number !~ :re"
        ),
        {"re": _E164_RE},
    ).fetchall():
        problems.append(f"teacher {name!r} ({tid}) has a phone not in +91XXXXXXXXXX form: {raw!r}")

    if problems:
        raise RuntimeError(
            "0032_phone_login_contract refused to run; nothing was changed:\n  - "
            + "\n  - ".join(problems)
            + "\nFix these (or run scripts/audit_phone_numbers.py for the full report) and retry."
        )


def upgrade() -> None:
    conn = op.get_bind()
    _refuse_if_blocked(conn)

    # NOT VALID first: the constraint applies to new writes at once, and the
    # existing rows are checked by the VALIDATE step below.
    op.execute(
        "ALTER TABLE students ADD CONSTRAINT chk_students_phone_required "
        "CHECK (phone_number IS NOT NULL) NOT VALID"
    )
    op.execute(
        "ALTER TABLE students ADD CONSTRAINT chk_students_phone_format "
        f"CHECK (phone_number ~ '{_E164_RE}') NOT VALID"
    )
    op.execute(
        "ALTER TABLE teachers ADD CONSTRAINT chk_teachers_phone_required "
        "CHECK (role <> 'teacher' OR phone_number IS NOT NULL) NOT VALID"
    )
    op.execute(
        "ALTER TABLE teachers ADD CONSTRAINT chk_teachers_phone_format "
        f"CHECK (phone_number IS NULL OR phone_number ~ '{_E164_RE}') NOT VALID"
    )
    op.execute("ALTER TABLE students VALIDATE CONSTRAINT chk_students_phone_required")
    op.execute("ALTER TABLE students VALIDATE CONSTRAINT chk_students_phone_format")
    op.execute("ALTER TABLE teachers VALIDATE CONSTRAINT chk_teachers_phone_required")
    op.execute("ALTER TABLE teachers VALIDATE CONSTRAINT chk_teachers_phone_format")

    # The admission number's unique constraint is found by column, not name, so
    # this also works on a database whose constraint was renamed by hand.
    names = conn.execute(
        sa.text(
            """
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
            WHERE c.conrelid = 'students'::regclass
              AND c.contype = 'u'
              AND a.attname = 'admission_number'
              AND array_length(c.conkey, 1) = 2
            """
        )
    ).fetchall()
    for (name,) in names:
        op.drop_constraint(name, "students", type_="unique")
    op.drop_column("students", "admission_number")


def downgrade() -> None:
    op.add_column("students", sa.Column("admission_number", sa.String(), nullable=True))
    op.create_unique_constraint(
        "students_school_id_admission_number_key",
        "students",
        ["school_id", "admission_number"],
    )
    op.drop_constraint("chk_teachers_phone_format", "teachers", type_="check")
    op.drop_constraint("chk_teachers_phone_required", "teachers", type_="check")
    op.drop_constraint("chk_students_phone_format", "students", type_="check")
    op.drop_constraint("chk_students_phone_required", "students", type_="check")
