"""One-off import: Class 11 & 12 (+2) chapter and subtopic syllabus for the
12 BSEB Science/Commerce/Arts subjects that are new at +2 (Physics,
Chemistry, Biology, Computer Science, Accountancy, Business Studies,
Economics, History, Political Science, Geography, Sociology, Psychology).

Source file: Bihar_BSEB_Class_11_12_Chapters_Subtopics.txt (repo root),
transcribed from the official BSEB Class 11 & 12 syllabus PDF. Mathematics,
English and Hindi also apply at +2 but already exist unscoped from the
Class 6-10 seed (seed_curriculum.py) and are NOT in this file or this
script's scope.

Unlike seed_bihar_subtopics_9_10.py (which matches subtopics onto chapters
that already exist for Class 9/10), nothing exists yet in
`curriculum_chapters`/`curriculum_topics` for Class 11/12: this script
creates both the CurriculumChapter and CurriculumTopic rows together, in one
pass, in the same get_or_create style as seed_curriculum.py.

Grades 11/12 and the 12 +2 subjects themselves must already exist (seeded by
seed_grades_11_12.py) -- if a subject or grade named in the text file isn't
found in the database, this script raises SystemExit rather than silently
skipping it.

Idempotent: matches on each table's natural key (chapters: subject + grade +
chapter_number, topics: chapter + title), so it's safe to re-run.

Dry run by default -- prints a full summary (counts per subject+grade) and
writes nothing. Pass --apply to commit. Run from the backend/ directory so it
picks up backend/.env (whatever DATABASE_URL your environment points at --
this is production unless you've overridden it locally):

    cd backend
    uv run python scripts/seed_syllabus_11_12.py
    uv run python scripts/seed_syllabus_11_12.py --apply
"""

import argparse
import re
from pathlib import Path

from sqlalchemy.orm import Session

from backend.db.models import CurriculumChapter, CurriculumTopic, Grade, Subject
from backend.db.session import SessionLocal, engine

BOARD = "BSEB"
TXT_PATH = Path(__file__).resolve().parents[2] / "Bihar_BSEB_Class_11_12_Chapters_Subtopics.txt"

# file "SUBJECT: X" name (as upper-cased in the file) -> Subject.name already
# seeded by seed_grades_11_12.py.
SUBJECT_MAP = {
    "PHYSICS": "Physics",
    "CHEMISTRY": "Chemistry",
    "BIOLOGY": "Biology",
    "COMPUTER SCIENCE": "Computer Science",
    "ACCOUNTANCY": "Accountancy",
    "BUSINESS STUDIES": "Business Studies",
    "ECONOMICS": "Economics",
    "HISTORY": "History",
    "POLITICAL SCIENCE": "Political Science",
    "GEOGRAPHY": "Geography",
    "SOCIOLOGY": "Sociology",
    "PSYCHOLOGY": "Psychology",
}


def parse_file(path: Path) -> list[dict]:
    """Chapters in Class 11 then Class 12 order, each subject in file order,
    each {grade, subject, chapter_number, title, subtopics}."""
    grade: int | None = None
    subject: str | None = None
    current: dict | None = None
    chapters: list[dict] = []
    chapter_number = 0

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line == "END OF FILE":
            break

        m = re.match(r"^CLASS (\d+)$", line)
        if m:
            grade, subject, current = int(m.group(1)), None, None
            chapter_number = 0
            continue

        m = re.match(r"^SUBJECT:\s*(.+)$", line)
        if m:
            subject, current = m.group(1).strip().upper(), None
            chapter_number = 0
            continue

        if subject not in SUBJECT_MAP:
            continue  # out-of-scope subject header (shouldn't occur in this file)

        m = re.match(r"^Chapter \d+:\s*(.+)$", line)
        if m:
            chapter_number += 1
            current = {
                "grade": grade,
                "subject": SUBJECT_MAP[subject],
                "chapter_number": chapter_number,
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

    missing = set()
    for item in chapters:
        if item["grade"] not in grades:
            missing.add(f"grade {item['grade']}")
        if item["subject"] not in subjects:
            missing.add(f"subject {item['subject']!r} (board={BOARD})")
    if missing:
        raise SystemExit(
            "missing from database, run seed_grades_11_12.py first: " + ", ".join(sorted(missing))
        )

    new_chapters = new_topics = 0
    per_subject_grade: dict[tuple[str, int], dict[str, int]] = {}

    for item in chapters:
        grade = grades[item["grade"]]
        subject = subjects[item["subject"]]
        key = (item["subject"], item["grade"])
        stats = per_subject_grade.setdefault(key, {"chapters": 0, "topics": 0})

        chapter, created = get_or_create(
            db,
            CurriculumChapter,
            subject_id=subject.id,
            grade_id=grade.id,
            chapter_number=item["chapter_number"],
            defaults={"title": item["title"]},
        )
        new_chapters += created
        stats["chapters"] += 1
        if created:
            print(
                f"  + chapter  Class {item['grade']} {item['subject']} "
                f"#{item['chapter_number']:<2} {item['title']}"
            )
        else:
            print(
                f"    exists   Class {item['grade']} {item['subject']} "
                f"#{item['chapter_number']:<2} {chapter.title!r}"
            )

        for i, topic_title in enumerate(item["subtopics"], start=1):
            _, t_created = get_or_create(
                db,
                CurriculumTopic,
                chapter_id=chapter.id,
                title=topic_title,
                defaults={"sequence_order": i},
            )
            new_topics += t_created
            stats["topics"] += 1
            if t_created:
                print(f"      + topic  {topic_title}")

    print("\nSummary (chapters / topics seen per subject+grade):")
    for (subject_name, level), stats in sorted(per_subject_grade.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        print(f"  Class {level:<2} {subject_name:<20} chapters={stats['chapters']:<3} topics={stats['topics']}")

    print(f"\nnew chapters: {new_chapters}   new topics: {new_topics}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="actually write the changes")
    args = parser.parse_args()

    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    chapters = parse_file(TXT_PATH)
    print(f"parsed {len(chapters)} chapters from {TXT_PATH.name}\n")

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
