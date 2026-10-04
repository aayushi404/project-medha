"""Read-only pre-flight audit for the phone-number login migration (0031).

Reports everything that would break or surprise the migration:

  * teacher phones that won't parse as Indian mobiles (blocker)
  * teacher phones that collide once normalised to E.164 (blocker -- the
    unique index on teachers.phone_number would refuse the backfill)
  * teachers with role='teacher' and no phone at all (blocker -- the new
    NOT VALID check would refuse them once validated)
  * student phones that won't parse (blocker)
  * students with no login phone (informational -- they can't log in by
    phone until someone sets one; the NOT VALID check covers new rows only)
  * students sharing a phone (informational -- this is the sibling case the
    migration exists to allow)
  * admission numbers in use (informational -- counts what 0032 will drop)

It writes nothing. Exit code 0 when there are no blockers, 1 otherwise.

Usage (against the local docker DB, not production):
    DATABASE_URL=postgresql+psycopg2://shiksha:...@localhost:5431/shiksha_sathi \\
        uv run python scripts/audit_phone_numbers.py
"""

import sys
from collections import defaultdict

from sqlalchemy import text

from backend.core import validators
from backend.db.session import SessionLocal


def _normalise(raw: str | None) -> str | None:
    """E.164 form, or None if it isn't a valid Indian mobile. Same rule the
    app will use at login, so what passes here is what can be looked up."""
    if raw is None:
        return None
    try:
        return validators.e164_indian_mobile(raw)
    except ValueError:
        return None


def _rows(db, sql: str) -> list[tuple]:
    return db.execute(text(sql)).fetchall()


def main() -> int:
    blockers: list[str] = []
    info: list[str] = []

    with SessionLocal() as db:
        # ---- teachers -------------------------------------------------------
        teachers = _rows(
            db,
            "SELECT id, full_name, role, phone_number FROM teachers ORDER BY created_at",
        )
        by_phone: dict[str, list[tuple]] = defaultdict(list)
        unparseable_teachers = []
        missing_teacher_phone = []
        for tid, name, role, raw in teachers:
            norm = _normalise(raw)
            if raw is None or not raw.strip():
                if role == "teacher":
                    missing_teacher_phone.append((tid, name))
                continue
            if norm is None:
                unparseable_teachers.append((tid, name, raw))
                continue
            by_phone[norm].append((tid, name, role))

        collisions = {p: rows for p, rows in by_phone.items() if len(rows) > 1}

        info.append(f"teachers total: {len(teachers)}")
        if unparseable_teachers:
            blockers.append(f"{len(unparseable_teachers)} teacher phone(s) don't parse as Indian mobiles:")
            blockers += [f"    {name!r} ({tid}): {raw!r}" for tid, name, raw in unparseable_teachers]
        if collisions:
            blockers.append(f"{len(collisions)} teacher phone(s) collide after E.164 normalisation:")
            for phone, rows in collisions.items():
                blockers.append(f"    {phone}: " + ", ".join(f"{n!r} ({r})" for _, n, r in rows))
        if missing_teacher_phone:
            blockers.append(f"{len(missing_teacher_phone)} teacher(s) with role='teacher' have no phone:")
            blockers += [f"    {name!r} ({tid})" for tid, name in missing_teacher_phone]

        # ---- students -------------------------------------------------------
        students = _rows(
            db,
            "SELECT id, full_name, school_id, phone_number, email FROM students",
        )
        student_by_phone: dict[str, list[tuple]] = defaultdict(list)
        unparseable_students = []
        no_phone_students = []
        for sid, name, school_id, raw, email in students:
            if raw is None or not raw.strip():
                no_phone_students.append((sid, name))
                continue
            norm = _normalise(raw)
            if norm is None:
                unparseable_students.append((sid, name, raw))
                continue
            student_by_phone[norm].append((sid, name))

        shared = {p: rows for p, rows in student_by_phone.items() if len(rows) > 1}

        info.append(f"students total: {len(students)}")
        if unparseable_students:
            blockers.append(f"{len(unparseable_students)} student phone(s) don't parse as Indian mobiles:")
            blockers += [f"    {name!r} ({sid}): {raw!r}" for sid, name, raw in unparseable_students]
        if no_phone_students:
            # 0032 refuses to run while any student lacks a phone
            blockers.append(f"{len(no_phone_students)} student(s) with no login phone (0032 refuses):")
            blockers += [f"    {name!r} ({sid})" for sid, name in no_phone_students]
        info.append(f"students with no login phone: {len(no_phone_students)}")
        info.append(f"phones shared by several students (allowed after 0031): {len(shared)}")
        for phone, rows in shared.items():
            info.append(f"    {phone}: " + ", ".join(repr(n) for _, n in rows))

        # ---- admission numbers (dropped in 0032) ----------------------------
        has_adm = db.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'students' AND column_name = 'admission_number'"
            )
        ).first()
        if has_adm:
            adm_total = db.execute(
                text("SELECT count(*) FROM students WHERE admission_number IS NOT NULL")
            ).scalar_one()
            info.append(f"students with an admission_number (dropped in 0032): {adm_total}")
        else:
            info.append("admission_number already dropped (0032 applied)")

    print("== phone-login migration audit (read-only) ==")
    for line in info:
        print(line)
    print()
    if blockers:
        print(f"BLOCKERS ({len(blockers)} lines) -- fix these before running 0031:")
        for line in blockers:
            print(line)
        return 1
    print("No blockers for the phone-login migrations (0031, 0032).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
