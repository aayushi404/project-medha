"""Dev-only demo students at the Phase 0 test school (Class 8).

Creates two students so the whole flow can be exercised without going through
the UI three times:

  * demo.student@medha.app / password123  -- already approved AND activated,
    logs straight into the doubt dashboard.
  * "Pending Demo" (roll DEMO-PENDING)     -- registered, awaiting a teacher's
    approval, so the teacher "Students" screen has something to act on.

Idempotent. NOT part of seed_phase0 -- run it explicitly, and only against a
dev database.

Usage:
    uv run python scripts/seed_students_demo.py
"""
from datetime import datetime, timezone

from backend.auth.hashing import hash_password
from backend.db.models import Grade, School, Teacher
from backend.db.session import SessionLocal, engine

_ACTIVE_EMAIL = "demo.student@medha.app"
_ACTIVE_ROLL = "DEMO-1"
_PENDING_ROLL = "DEMO-PENDING"


def main() -> None:
    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    db = SessionLocal()
    try:
        school = (
            db.query(School).filter(School.name.ilike("%Patna Sadar%")).one_or_none()
        )
        grade8 = db.query(Grade).filter(Grade.label == "Class 8").one_or_none()
        if school is None or grade8 is None:
            raise SystemExit("run seed_phase0.py first (need the test school + Class 8).")

        def ensure(roll: str, **fields) -> None:
            row = (
                db.query(Teacher)
                .filter(
                    Teacher.role == "student",
                    Teacher.school_id == school.id,
                    Teacher.grade_id == grade8.id,
                    Teacher.roll_number == roll,
                )
                .one_or_none()
            )
            if row is not None:
                print(f"exists   student    roll {roll} -- unchanged")
                return
            db.add(
                Teacher(
                    role="student",
                    school_id=school.id,
                    grade_id=grade8.id,
                    roll_number=roll,
                    **fields,
                )
            )
            print(f"created  student    roll {roll}")

        ensure(
            _ACTIVE_ROLL,
            full_name="Demo Student",
            email=_ACTIVE_EMAIL,
            password_hash=hash_password("password123"),
            approval_status="approved",
            approved_at=datetime.now(timezone.utc),
        )
        ensure(
            _PENDING_ROLL,
            full_name="Pending Demo",
            approval_status="pending",
        )

        db.commit()
        print("committed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
