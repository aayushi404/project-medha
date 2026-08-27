"""Phase 1 curriculum seed: a handful of extra BSEB chapters + topics on top of
seed_phase0.py, so the dashboard's Chapter/Topic selectors have real data to
show. No textbook content chunks -- retrieval degrades gracefully without them
(see docs/phase-1/04). Run seed_phase0.py first (it creates grades/subjects).

Idempotent: matches on each table's natural key, safe to re-run.

Usage:
    uv run python scripts/seed_curriculum.py
    DATABASE_URL=<url> uv run python scripts/seed_curriculum.py
"""

from sqlalchemy.orm import Session

from backend.db.models import CurriculumChapter, CurriculumTopic, Grade, Subject
from backend.db.session import SessionLocal, engine

# (grade numeric_level, subject name, chapter_number, chapter title, [topic titles])
CURRICULUM: list[tuple[int, str, int, str, list[str]]] = [
    (8, "Science", 2, "Force and Pressure",
     ["Contact and Non-contact Forces", "Pressure Exerted by Fluids"]),
    (8, "Science", 3, "Friction",
     ["Friction: Factors and Effects"]),
    (7, "Science", 1, "Nutrition in Plants",
     ["Autotrophic Nutrition", "Parasitic and Insectivorous Plants"]),
    (7, "Science", 4, "Heat",
     ["Conduction, Convection and Radiation"]),
    (6, "Social Science", 1, "Understanding Diversity",
     ["Diversity in India"]),
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
    grades = {g.numeric_level: g for g in db.query(Grade).all()}
    subjects = {s.name: s for s in db.query(Subject).filter(Subject.board == "BSEB").all()}

    for level, subject_name, number, title, topic_titles in CURRICULUM:
        grade = grades.get(level)
        subject = subjects.get(subject_name)
        if grade is None or subject is None:
            raise SystemExit(
                f"missing grade {level} or subject {subject_name!r} -- run seed_phase0.py first"
            )

        chapter, created = get_or_create(
            db,
            CurriculumChapter,
            subject_id=subject.id,
            grade_id=grade.id,
            chapter_number=number,
            defaults={"title": title},
        )
        print(f"{'created' if created else 'exists '}  chapter  Class {level} {subject_name} / {title}")

        for i, topic_title in enumerate(topic_titles, start=1):
            _, t_created = get_or_create(
                db,
                CurriculumTopic,
                chapter_id=chapter.id,
                title=topic_title,
                defaults={"sequence_order": i},
            )
            print(f"{'created' if t_created else 'exists '}  topic      {topic_title}")


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
