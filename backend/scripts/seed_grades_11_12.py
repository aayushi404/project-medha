"""Class 11/12 setup: the two grades plus the standard BSEB +2 Science /
Commerce / Arts subject catalog. No chapters/topics -- curriculum content for
11/12 is intentionally out of scope for now; this just unblocks the principal
creating 11/12 class sections and assigning subject teachers.

Mathematics, English, and Hindi already exist (from seed_curriculum.py) and
carry over unscoped (min/max NULL = every grade), since they're also taught
at +2. Science and Social Science are capped at max_grade_level=10 here: at
+2 they split into the standalone subjects below instead of staying one
combined subject, so they shouldn't appear as assignable in an 11/12 class.

Idempotent: matches on each table's natural key (grades: numeric_level,
subjects: name+board), so it's safe to re-run.

Usage:
    uv run python scripts/seed_grades_11_12.py
    DATABASE_URL=<url> uv run python scripts/seed_grades_11_12.py
"""

from sqlalchemy.orm import Session

from backend.db.models import Grade, Subject
from backend.db.session import SessionLocal, engine

BOARD = "BSEB"

GRADES = [("Class 11", 11), ("Class 12", 12)]

# Subjects that stop applying once a school reaches +2 -- they split into the
# standalone subjects below instead.
CAPPED_AT_10 = ["Science", "Social Science"]

# Standard BSEB +2 Science / Commerce / Arts subjects, new at 11-12.
SUBJECTS_11_12 = [
    # Science stream
    "Physics",
    "Chemistry",
    "Biology",
    "Computer Science",
    # Commerce stream
    "Accountancy",
    "Business Studies",
    "Economics",
    # Arts / Humanities stream
    "History",
    "Political Science",
    "Geography",
    "Psychology",
    "Sociology",
]


def get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def seed(db: Session) -> None:
    for label, level in GRADES:
        grade, created = get_or_create(db, Grade, label=label, numeric_level=level)
        print(f"{'created' if created else 'exists '}  grade      {label}")

    capped = 0
    for name in CAPPED_AT_10:
        subject = db.query(Subject).filter_by(name=name, board=BOARD).one_or_none()
        if subject is None:
            print(f"  ! skip     {name} not found -- run seed_curriculum.py first")
            continue
        if subject.max_grade_level != 10:
            subject.max_grade_level = 10
            capped += 1
            print(f"  ~ capped   {name} -> max_grade_level=10")
        else:
            print(f"exists      {name} already capped at 10")

    made = 0
    for name in SUBJECTS_11_12:
        subject, created = get_or_create(
            db,
            Subject,
            name=name,
            board=BOARD,
            defaults={"min_grade_level": 11, "max_grade_level": 12},
        )
        made += created
        print(f"{'created' if created else 'exists '}  subject    {name} (11-12)")

    total_subjects = db.query(Subject).count()
    print(f"\nnew subjects: {made}   capped: {capped}   (db now: {total_subjects} subjects)")


def main() -> None:
    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    db = SessionLocal()
    try:
        seed(db)
        db.commit()
        print("committed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
