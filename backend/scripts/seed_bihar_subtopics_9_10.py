"""One-off import: Class 9 & 10 Mathematics/Science chapter subtopics from the
Bihar e-LOTS portal, so the Lesson Plan wizard can scope a lesson to a
subtopic instead of only a whole chapter.

Source file: Bihar_eLOTS_Class_9_10_Chapter_Subtopics.txt (repo root).
Social Science is deliberately skipped: what's already seeded for Class 9/10
Social Science (seed_curriculum.py) is a different, older chapter set that
doesn't line up with this file's (NCERT-aligned) chapters -- handled
separately, later.

For Mathematics and Science, chapters are matched against what's already in
`curriculum_chapters` by normalized title (case/whitespace/punctuation and a
couple of known British-vs-American-spelling or renamed-chapter aliases). A
file chapter that matches an existing one just gets its subtopics attached;
one that doesn't match is created fresh, appended after the existing chapters
for that subject+grade (so nothing already there is renumbered or touched).
Topics are matched by (chapter_id, title), so this is safe to re-run.

Dry run by default -- prints what it would do, writes nothing. Pass --apply
to commit. Run from the backend/ directory so it picks up backend/.env
(whatever DATABASE_URL your environment points at -- this is production
unless you've overridden it locally):

    cd backend
    uv run python scripts/seed_bihar_subtopics_9_10.py
    uv run python scripts/seed_bihar_subtopics_9_10.py --apply
"""

import argparse
import re
from pathlib import Path

from sqlalchemy.orm import Session

from backend.db.models import CurriculumChapter, CurriculumTopic, Grade, Subject
from backend.db.session import SessionLocal, engine

BOARD = "BSEB"
TXT_PATH = Path(__file__).resolve().parents[2] / "Bihar_eLOTS_Class_9_10_Chapter_Subtopics.txt"

# file subject name -> Subject.name already used by seed_curriculum.py
SUBJECT_MAP = {"MATHEMATICS": "Mathematics", "SCIENCE": "Science"}

# Known renamed/respelled chapters that normalization alone won't catch,
# found by manually diffing this file against what's already seeded. Maps
# normalize(file title) -> normalize(already-seeded title), so the file's
# subtopics attach to the existing chapter instead of creating a near-dupe.
MANUAL_ALIASES = {
    "heredity and evolution": "heredity",
    "human eye and the colourful world": "human eye and colorful world",
}


def normalize(title: str) -> str:
    s = title.replace("’", "'").replace("‘", "'")
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)  # drop a trailing bilingual "(...)" suffix
    s = s.strip().rstrip("?.! ")
    s = re.sub(r"^(the|a|an)\s+", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return MANUAL_ALIASES.get(s, s)


def parse_file(path: Path) -> list[dict]:
    """Chapters (Mathematics/Science only) in Class 9 then Class 10 order,
    each {grade, subject, title, subtopics}."""
    grade: int | None = None
    subject: str | None = None
    current: dict | None = None
    chapters: list[dict] = []

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line in ("OFFICIAL PORTAL LINKS", "END OF FILE"):
            break

        m = re.match(r"^CLASS (\d+)$", line)
        if m:
            grade, subject, current = int(m.group(1)), None, None
            continue

        m = re.match(r"^SUBJECT:\s*(.+)$", line)
        if m:
            subject, current = m.group(1).strip().upper(), None
            continue

        if subject not in SUBJECT_MAP:
            continue  # Social Science (and anything else) -- skipped

        m = re.match(r"^Chapter \d+:\s*(.+)$", line)
        if m:
            current = {
                "grade": grade,
                "subject": SUBJECT_MAP[subject],
                "title": m.group(1).strip(),
                "subtopics": [],
            }
            chapters.append(current)
            continue

        if line.startswith("•") and current is not None:
            current["subtopics"].append(line.lstrip("•").strip())

    return chapters


def get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def run(db: Session, chapters: list[dict]) -> None:
    grades = {g.numeric_level: g for g in db.query(Grade).all()}
    subjects = {s.name: s for s in db.query(Subject).filter(Subject.board == BOARD).all()}

    new_chapters = new_topics = 0
    for item in chapters:
        grade = grades.get(item["grade"])
        subject = subjects.get(item["subject"])
        if grade is None or subject is None:
            print(f"SKIP {item['subject']} class {item['grade']}: grade/subject not found")
            continue

        existing = (
            db.query(CurriculumChapter)
            .filter_by(subject_id=subject.id, grade_id=grade.id)
            .all()
        )
        norm = normalize(item["title"])
        chapter = next((c for c in existing if normalize(c.title) == norm), None)
        if chapter is None:
            next_number = max((c.chapter_number for c in existing), default=0) + 1
            chapter = CurriculumChapter(
                subject_id=subject.id,
                grade_id=grade.id,
                chapter_number=next_number,
                title=item["title"],
            )
            db.add(chapter)
            db.flush()
            new_chapters += 1
            print(f"  + chapter  Class {item['grade']} {item['subject']} #{next_number} {item['title']}")
        else:
            print(f"    match    Class {item['grade']} {item['subject']} #{chapter.chapter_number} {chapter.title!r} <- {item['title']!r}")

        for i, topic_title in enumerate(item["subtopics"], start=1):
            _, created = get_or_create(
                db,
                CurriculumTopic,
                chapter_id=chapter.id,
                title=topic_title,
                defaults={"sequence_order": i},
            )
            new_topics += created
            if created:
                print(f"      + topic  {topic_title}")

    print(f"\nnew chapters: {new_chapters}   new topics: {new_topics}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="actually write the changes")
    args = parser.parse_args()

    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    chapters = parse_file(TXT_PATH)
    print(f"parsed {len(chapters)} Mathematics/Science chapters from {TXT_PATH.name}\n")

    db = SessionLocal()
    try:
        run(db, chapters)
        if args.apply:
            db.commit()
            print("committed.")
        else:
            db.rollback()
            print("\nDRY RUN -- nothing written. Re-run with --apply to commit.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
