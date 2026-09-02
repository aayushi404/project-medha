"""Seed the curated presentation library from JSON deck files.

Each file in `backend/seed/library/*.json` is one deck:

    {
      "slug": "photosynthesis-c8-sci-en",   # stable natural key (idempotent)
      "language": "en",                       # 'hi' | 'en'
      "grade_label": "Class 8",
      "subject_name": "Science",
      "chapter_title": "How Plants Make Their Food",   # optional
      "topic_title": null,                              # optional
      "description": "...",
      "tags": ["photosynthesis", "chlorophyll"],
      "spec": { "title": "...", "subtitle": "...", "slides": [ ... ] }
    }

`spec` is the same slide-spec shape the LLM produces and a module `ppt`
artifact stores; it is validated with `parse_deck` here so every seeded deck
is guaranteed renderable. Idempotent: rows are matched on `slug`.

Usage:
    uv run python scripts/seed_library.py
    DATABASE_URL=<url> uv run python scripts/seed_library.py
"""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from backend.db.models import (
    CurriculumChapter,
    CurriculumTopic,
    Grade,
    LibraryPresentation,
    Subject,
)
from backend.db.session import SessionLocal, engine
from backend.ppt.schema import parse_deck

_SEED_DIR = Path(__file__).resolve().parents[1] / "seed" / "library"


def _resolve_ids(db: Session, doc: dict) -> dict:
    ids: dict[str, object] = {
        "grade_id": None,
        "subject_id": None,
        "chapter_id": None,
        "topic_id": None,
    }
    grade = subject = None
    if doc.get("grade_label"):
        grade = db.query(Grade).filter(Grade.label == doc["grade_label"]).first()
        if grade is None:
            raise SystemExit(f"{doc['slug']}: unknown grade_label {doc['grade_label']!r}")
        ids["grade_id"] = grade.id
    if doc.get("subject_name"):
        subject = (
            db.query(Subject).filter(Subject.name == doc["subject_name"]).first()
        )
        if subject is None:
            raise SystemExit(
                f"{doc['slug']}: unknown subject_name {doc['subject_name']!r}"
            )
        ids["subject_id"] = subject.id
    if doc.get("chapter_title"):
        if grade is None or subject is None:
            raise SystemExit(
                f"{doc['slug']}: chapter_title needs grade_label + subject_name"
            )
        chapter = (
            db.query(CurriculumChapter)
            .filter(
                CurriculumChapter.grade_id == grade.id,
                CurriculumChapter.subject_id == subject.id,
                CurriculumChapter.title == doc["chapter_title"],
            )
            .first()
        )
        if chapter is None:
            raise SystemExit(
                f"{doc['slug']}: unknown chapter_title {doc['chapter_title']!r}"
            )
        ids["chapter_id"] = chapter.id
        if doc.get("topic_title"):
            topic = (
                db.query(CurriculumTopic)
                .filter(
                    CurriculumTopic.chapter_id == chapter.id,
                    CurriculumTopic.title == doc["topic_title"],
                )
                .first()
            )
            if topic is None:
                raise SystemExit(
                    f"{doc['slug']}: unknown topic_title {doc['topic_title']!r}"
                )
            ids["topic_id"] = topic.id
    return ids


def seed(db: Session) -> None:
    files = sorted(_SEED_DIR.glob("*.json"))
    if not files:
        print(f"no deck files in {_SEED_DIR}")
        return

    created = updated = 0
    for path in files:
        doc = json.loads(path.read_text(encoding="utf-8"))
        slug = doc["slug"]
        deck = parse_deck(doc["spec"])  # fail loudly on a broken seed deck
        ids = _resolve_ids(db, doc)

        row = (
            db.query(LibraryPresentation)
            .filter(LibraryPresentation.slug == slug)
            .first()
        )
        fields = dict(
            title=deck.title,
            description=doc.get("description"),
            language=doc.get("language", "hi"),
            tags=doc.get("tags"),
            spec_json=doc["spec"],
            slide_count=len(deck.slides),
            source="curated",
            published=True,
            **ids,
        )
        if row is None:
            db.add(LibraryPresentation(slug=slug, **fields))
            created += 1
            print(f"  + {slug}  ({len(deck.slides)} slides)")
        else:
            for k, v in fields.items():
                setattr(row, k, v)
            updated += 1
            print(f"  ~ {slug}  ({len(deck.slides)} slides)")

    db.flush()
    total = db.query(LibraryPresentation).count()
    print(f"\nnew: {created}   updated: {updated}   (db now: {total} presentations)")


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
