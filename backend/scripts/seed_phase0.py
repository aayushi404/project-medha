"""Phase 0 seed data: grades, pilot subjects, one district/school/test-teacher,
and one hand-picked chapter/topic/content-chunk (Class 8 Science: photosynthesis
-- the running example from the product README).

Idempotent: safe to run against a fresh database or re-run against one that
already has this seed data (matches on each table's natural unique key instead
of inserting blindly).

Usage:
    uv run python scripts/seed_phase0.py                # uses DATABASE_URL from .env (local)
    DATABASE_URL=<neon-url> uv run python scripts/seed_phase0.py   # overrides for Neon
"""

from sqlalchemy.orm import Session

from backend.db.models import (
    CurriculumChapter,
    CurriculumTopic,
    District,
    Grade,
    School,
    Subject,
    Teacher,
    TeacherSubject,
    TextbookContentChunk,
)
from backend.db.session import SessionLocal, engine


def get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def seed(db: Session) -> None:
    grade_defs = [("Class 6", 6), ("Class 7", 7), ("Class 8", 8), ("Class 9", 9), ("Class 10", 10)]
    grades = {}
    for label, level in grade_defs:
        grade, created = get_or_create(db, Grade, label=label, numeric_level=level)
        grades[label] = grade
        print(f"{'created' if created else 'exists '}  grade      {label}")

    subject_defs = ["Science", "Social Science"]
    subjects = {}
    for name in subject_defs:
        subject, created = get_or_create(db, Subject, name=name, board="BSEB")
        subjects[name] = subject
        print(f"{'created' if created else 'exists '}  subject    {name}")

    district, created = get_or_create(
        db, District, name="Patna", state="Bihar"
    )
    print(f"{'created' if created else 'exists '}  district   {district.name}")

    school, created = get_or_create(
        db,
        School,
        name="Govt Middle School, Patna Sadar",
        district_id=district.id,
        defaults={"medium_of_instruction": "Hindi", "school_type": "middle"},
    )
    print(f"{'created' if created else 'exists '}  school     {school.name}")

    from backend.auth.hashing import hash_password

    teacher, created = get_or_create(
        db,
        Teacher,
        email="homeofirstt@gmail.com",
        defaults={
            "school_id": school.id,
            "full_name": "Test Teacher",
            "phone_number": "+919000000001",
            "password_hash": hash_password("password123"),  # dev only
            "role": "teacher",
            "approval_status": "approved",  # seeded, so it can log in immediately
        },
    )
    print(f"{'created' if created else 'exists '}  teacher    {teacher.full_name} ({teacher.email})")

    teacher_subject, created = get_or_create(
        db,
        TeacherSubject,
        teacher_id=teacher.id,
        subject_id=subjects["Science"].id,
        grade_id=grades["Class 8"].id,
        defaults={"is_primary": True},
    )
    print(f"{'created' if created else 'exists '}  teacher_subject  Science / Class 8 -> {teacher.full_name}")

    chapter, created = get_or_create(
        db,
        CurriculumChapter,
        subject_id=subjects["Science"].id,
        grade_id=grades["Class 8"].id,
        chapter_number=1,
        defaults={"title": "How Plants Make Their Food"},
    )
    print(f"{'created' if created else 'exists '}  chapter    {chapter.title}")

    topic, created = get_or_create(
        db,
        CurriculumTopic,
        chapter_id=chapter.id,
        title="Photosynthesis: How Green Plants Prepare Food",
        defaults={
            "description": (
                "The process by which green plants use sunlight, water, and "
                "carbon dioxide to produce glucose and release oxygen."
            ),
            "sequence_order": 1,
        },
    )
    print(f"{'created' if created else 'exists '}  topic      {topic.title}")

    content_text = (
        "Green plants are able to make their own food using sunlight, water, and "
        "carbon dioxide. This process, called photosynthesis, takes place mainly in "
        "the leaves, in cell structures called chloroplasts, which contain the green "
        "pigment chlorophyll. Chlorophyll absorbs sunlight and uses its energy to "
        "convert carbon dioxide (taken in from the air through small pores called "
        "stomata) and water (absorbed by the roots) into glucose and oxygen. The "
        "glucose is used by the plant as food and stored as starch, while the "
        "oxygen is released into the air -- the same oxygen we breathe."
    )
    chunk, created = get_or_create(
        db,
        TextbookContentChunk,
        topic_id=topic.id,
        content_text=content_text,
        defaults={"source_page": 14},
    )
    print(f"{'created' if created else 'exists '}  content_chunk  (page {chunk.source_page})")


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
