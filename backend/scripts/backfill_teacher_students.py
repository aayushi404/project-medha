"""One-off backfill: move every `teachers` row with role='student' into the
`students` table, reusing the same UUID as the new `students.id` so every
dependent table's `student_id` value stays correct with zero rewrites (only
the FK constraint's target table changes, in migration
0024_retarget_student_fks). See docs in that migration and
/home/aayushi/.claude/plans/i-already-have-teachers-hazy-codd.md for the
full picture.

Run in two passes, with migration 0024_retarget_student_fks applied in
between (the FK retarget must happen before the old `teachers` rows are
deleted, or their ON DELETE CASCADE would wipe out attendance/fees/homework/
report-cards/absence-calls for every migrated student):

    uv run python scripts/backfill_teacher_students.py
    # -> apply 0024_retarget_student_fks (alembic upgrade head) <-
    uv run python scripts/backfill_teacher_students.py --delete

Idempotent within each phase (safe to re-run phase 1 before 0024 is applied;
phase 2 is a no-op once there's nothing left with role='student').

Usage:
    uv run python scripts/backfill_teacher_students.py [--delete]
"""
import sys

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.db.session import SessionLocal, engine


def _student_ids(db: Session) -> list:
    rows = db.execute(text("SELECT id FROM teachers WHERE role = 'student'")).fetchall()
    return [r[0] for r in rows]


def _sanity_checks(db: Session, ids: list) -> bool:
    # This backfill writes students.admission_number, which migration 0032 drops.
    # Once it's gone the split is long finished and this script must not run.
    has_adm_col = db.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'students' AND column_name = 'admission_number'"
        )
    ).first()
    if not has_adm_col:
        raise SystemExit(
            "students.admission_number is gone (0032_phone_login_contract). This one-off "
            "backfill belongs to the 0023-0025 split and can't run on a schema past 0031."
        )
    if not ids:
        print("no teachers rows with role='student' -- nothing to back-fill.")
        return False
    collide = db.execute(
        text("SELECT id FROM students WHERE id = ANY(:ids)"), {"ids": ids}
    ).fetchall()
    if collide:
        raise SystemExit(
            f"collision: {len(collide)} of the {len(ids)} ids already exist in `students` "
            "(pre-existing seed rows?) -- aborting, resolve manually before re-running."
        )
    has_email_col = db.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'students' AND column_name = 'email'"
        )
    ).first()
    if not has_email_col:
        raise SystemExit(
            "students.email doesn't exist -- run migration 0023_split_students_expand first."
        )
    return True


def _insert_students(db: Session, ids: list) -> None:
    db.execute(
        text(
            """
            INSERT INTO students (
                id, school_id, full_name, admission_number, guardian_name,
                guardian_relation, guardian_phone, status, created_at, updated_at,
                email, password_hash, google_sub, phone_number, preferred_language,
                grade_id, roll_number, approval_status, approved_by, approved_at,
                rejection_reason, is_active
            )
            SELECT
                id, school_id, full_name, NULL, guardian_name,
                guardian_relation, guardian_phone, 'active', created_at, updated_at,
                email, password_hash, google_sub, phone_number, preferred_language,
                grade_id, roll_number, approval_status, approved_by, approved_at,
                rejection_reason, is_active
            FROM teachers
            WHERE id = ANY(:ids)
            """
        ),
        {"ids": ids},
    )
    print(f"inserted {len(ids)} students rows (reusing teachers.id as students.id)")


def _retarget_polymorphic(db: Session, ids: list) -> None:
    r = db.execute(
        text(
            "UPDATE chat_sessions SET student_id = teacher_id, teacher_id = NULL "
            "WHERE teacher_id = ANY(:ids)"
        ),
        {"ids": ids},
    )
    print(f"chat_sessions retargeted: {r.rowcount}")

    r = db.execute(
        text(
            "UPDATE notifications SET recipient_student_id = recipient_id, recipient_id = NULL "
            "WHERE recipient_id = ANY(:ids)"
        ),
        {"ids": ids},
    )
    print(f"notifications (recipient) retargeted: {r.rowcount}")

    r = db.execute(
        text(
            "UPDATE notifications SET sender_student_id = sender_id, sender_id = NULL "
            "WHERE sender_id = ANY(:ids)"
        ),
        {"ids": ids},
    )
    print(f"notifications (sender) retargeted: {r.rowcount}")

    r = db.execute(
        text(
            "UPDATE device_tokens SET student_id = user_id, user_id = NULL "
            "WHERE user_id = ANY(:ids)"
        ),
        {"ids": ids},
    )
    print(f"device_tokens retargeted: {r.rowcount}")

    r = db.execute(
        text(
            "UPDATE approval_events SET subject_student_id = subject_user_id, subject_user_id = NULL "
            "WHERE subject_user_id = ANY(:ids)"
        ),
        {"ids": ids},
    )
    print(f"approval_events retargeted: {r.rowcount}")


def _revoke_auth_sessions(db: Session, ids: list) -> None:
    r = db.execute(
        text(
            "UPDATE auth_sessions SET revoked_at = now() "
            "WHERE teacher_id = ANY(:ids) AND revoked_at IS NULL"
        ),
        {"ids": ids},
    )
    print(f"auth_sessions revoked: {r.rowcount} (students will need to log in again)")


def _verify_phase1(db: Session, ids: list) -> None:
    n_students = db.execute(
        text("SELECT count(*) FROM students WHERE id = ANY(:ids)"), {"ids": ids}
    ).scalar()
    n_teachers = db.execute(
        text("SELECT count(*) FROM teachers WHERE id = ANY(:ids)"), {"ids": ids}
    ).scalar()
    assert n_students == len(ids), f"expected {len(ids)} students rows, found {n_students}"
    assert n_teachers == len(ids), (
        f"expected {len(ids)} teachers rows still present (not deleted yet), found {n_teachers}"
    )
    leftover_chat = db.execute(
        text("SELECT count(*) FROM chat_sessions WHERE teacher_id = ANY(:ids)"), {"ids": ids}
    ).scalar()
    assert leftover_chat == 0, f"{leftover_chat} chat_sessions rows still reference teacher_id"
    print(
        f"verify: {n_students} students rows created, {n_teachers} teachers rows still "
        "present (pending delete), 0 dangling chat_sessions.teacher_id."
    )


def _delete_old_teachers(db: Session, ids: list) -> None:
    fk_target = db.execute(
        text(
            "SELECT confrelid::regclass::text FROM pg_constraint "
            "WHERE conname = 'attendance_records_student_id_fkey'"
        )
    ).scalar()
    if fk_target != "students":
        raise SystemExit(
            f"attendance_records.student_id still targets '{fk_target}', not 'students' -- "
            "run migration 0024_retarget_student_fks before deleting the old teachers rows "
            "(deleting now would CASCADE-delete every dependent attendance/fees/homework/"
            "report-card/absence-call row)."
        )
    r = db.execute(text("DELETE FROM teachers WHERE id = ANY(:ids)"), {"ids": ids})
    print(f"deleted {r.rowcount} old teachers rows")


def main() -> None:
    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    db = SessionLocal()
    try:
        ids = _student_ids(db)

        if "--delete" in sys.argv:
            if not ids:
                print("no teachers rows with role='student' remain -- nothing to delete.")
                return
            _delete_old_teachers(db, ids)
            db.commit()
            print("committed.")
            return

        if not _sanity_checks(db, ids):
            return
        _insert_students(db, ids)
        _retarget_polymorphic(db, ids)
        _revoke_auth_sessions(db, ids)
        _verify_phase1(db, ids)
        db.commit()
        print(
            "committed phase 1. Next: apply migration 0024_retarget_student_fks, "
            "then re-run this script with --delete."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
