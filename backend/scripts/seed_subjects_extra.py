"""Add subjects surfaced by real schools' teacher lists (F.N.S Academy, B.N.
Collegiate) that the earlier Class 11/12 catalog (seed_grades_11_12.py)
didn't cover: Urdu, Botany, Prakrit, Music.

Three of these (Music, Urdu, Prakrit) are marked ask_medha_enabled=False: a
principal can still assign a teacher to them in the class roster, but they
won't be offered as content-generation context in Ask Medha / quiz / lesson
plan / notes creation -- there's no real LLM content-generation value for a
performance subject or a classical/unsupported language.

Idempotent: matches on (name, board). Safe to re-run.

Usage:
    uv run python scripts/seed_subjects_extra.py
    DATABASE_URL=<url> uv run python scripts/seed_subjects_extra.py
"""

from sqlalchemy.orm import Session

from backend.db.models import Subject
from backend.db.session import SessionLocal, engine

BOARD = "BSEB"

# name -> (min_grade_level, max_grade_level, ask_medha_enabled)
SUBJECTS: dict[str, tuple[int | None, int | None, bool]] = {
    "Urdu": (None, None, False),  # taught at both 9-10 and 11-12
    "Botany": (11, 12, True),
    "Prakrit": (11, 12, False),
    "Music": (None, None, False),  # taught at both 9-10 and 11-12
}


def seed(db: Session) -> None:
    made = updated = 0
    for name, (lo, hi, ask_medha) in SUBJECTS.items():
        subject = db.query(Subject).filter_by(name=name, board=BOARD).one_or_none()
        if subject is None:
            db.add(
                Subject(
                    name=name,
                    board=BOARD,
                    min_grade_level=lo,
                    max_grade_level=hi,
                    ask_medha_enabled=ask_medha,
                )
            )
            made += 1
            print(f"  + subject  {name} ({lo}-{hi}, ask_medha={ask_medha})")
        else:
            changed = False
            if subject.min_grade_level != lo or subject.max_grade_level != hi:
                subject.min_grade_level, subject.max_grade_level = lo, hi
                changed = True
            if subject.ask_medha_enabled != ask_medha:
                subject.ask_medha_enabled = ask_medha
                changed = True
            if changed:
                updated += 1
                print(f"  ~ updated  {name} -> ({lo}-{hi}, ask_medha={ask_medha})")
            else:
                print(f"exists      {name}")

    total = db.query(Subject).count()
    print(f"\nnew: {made}   updated: {updated}   (db now: {total} subjects)")


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
