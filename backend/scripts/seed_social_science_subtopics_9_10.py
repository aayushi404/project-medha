"""One-off import: Class 9 & 10 Social Science chapter subtopics, from the
real BSEB syllabus (History / Geography / Political Science-Civics /
Economics / Disaster Management units) -- the file `seed_bihar_subtopics_9_10.py`
deliberately skipped, because the NCERT-aligned chapters in its source file
didn't line up with what's already seeded for Social Science.

Source file: bihar_board_class_9_10_social_science_syllabus.txt (repo root).
That file turned out to match what's already seeded (seed_curriculum.py)
almost chapter-for-chapter -- it's the same BSEB chapter set, just with full
official titles and marks/schedule sections this script ignores.

Chapters are matched against what's already in `curriculum_chapters` by
normalized title (case/whitespace/punctuation and a MANUAL_ALIASES table for
paraphrased/abbreviated titles the file and the seed disagree on). A file
chapter that matches an existing one just gets its subtopics attached; one
that doesn't match -- content the original seed left out entirely, e.g. the
Class 9 Disaster Management unit -- is created fresh, appended after the
existing chapters for that grade (nothing already there is renumbered).

Subtopics are the file's two bullet levels ("  - " and "    * "); a third,
more deeply nested level is pure elaboration and is skipped so topics stay
chip-sized. Topics are matched by (chapter_id, title), so this is safe to
re-run.

Dry run by default -- prints what it would do, writes nothing. Pass --apply
to commit. Run from the backend/ directory so it picks up backend/.env
(whatever DATABASE_URL your environment points at -- this is production
unless you've overridden it locally):

    cd backend
    uv run python scripts/seed_social_science_subtopics_9_10.py
    uv run python scripts/seed_social_science_subtopics_9_10.py --apply
"""

import argparse
import re
from pathlib import Path

from sqlalchemy.orm import Session

from backend.db.models import CurriculumChapter, CurriculumTopic, Grade, Subject
from backend.db.session import SessionLocal, engine

BOARD = "BSEB"
TXT_PATH = Path(__file__).resolve().parents[2] / "bihar_board_class_9_10_social_science_syllabus.txt"
SUBJECT_NAME = "Social Science"

# Known paraphrased/abbreviated chapters that normalization alone won't
# catch, found by diffing this file against what's already seeded. Maps
# normalize(file title) -> normalize(already-seeded title).
MANUAL_ALIASES: dict[str, str] = {
    # Class 9
    "history of the world wars": "history of world wars",
    "rise of nazism in germany": "nazism",
    "forest tribal society and colonialism": "forest society and colonialism",
    "efforts for world peace": "efforts for peace",
    "location and extent of india": "location and extent",
    "physical features: structure and relief": "physical features",
    "india's neighbouring countries": "our neighboring countries",
    "map study and scale": "map studies",
    "gradual evolution of democracy": "democracy in the contemporary world",
    "what is democracy and why democracy": "what and why democracy",
    "working of institutions in parliamentary democracy": "working of institutions",
    "human as a resource": "people as a resource",
    "poverty": "poverty: a challenge",
    "agriculture food security and quality": "food security in india",
    # Class 10
    "rise of nationalism in europe": "nationalism in europe",
    "india: resources and utilization": "resources and utilization",
    "bihar: agriculture forest mineral industrial and demographic resources": "bihar: agriculture and forest resources",
    "map study - representation of relief": "map reading",
    "power sharing in democracy: social divisions caste religion and gender": "power sharing in democracy",
    "working of power sharing (federalism and local self-government)": "working of power sharing",
    "competition and struggles in democracy (popular struggles and political parties)": "competition and movements in democracy",
    "outcomes achievements of democracy": "outcomes of democracy",
    "natural disasters and management: flood and drought": "flood and drought",
    "natural disasters and management: earthquake and tsunami": "earthquake and tsunami",
    "life-saving emergency contingency management": "life saving contingency management",
    "disasters and co-existence (living with disasters)": "disaster and co-existence",
}

_CHAPTER_RE = re.compile(r"^(?:Chapter|Unit)\s+\d+\s*(?:\([^)]*\))?\s*:\s*(.+)$")
_PART_RE = re.compile(r"^PART (\d+):")


def normalize(title: str) -> str:
    s = title.replace("’", "'").replace("‘", "'")
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)  # drop a trailing bilingual "(...)" suffix
    s = s.strip().rstrip(":?.! ")
    s = re.sub(r"^(the|a|an)\s+", "", s, flags=re.IGNORECASE)
    s = s.replace(",", "").replace(";", "").replace("/", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return MANUAL_ALIASES.get(s, s)


def parse_file(path: Path) -> list[dict]:
    """Social Science chapters for Class 9 then Class 10, each
    {grade, title, subtopics}. Stops once the syllabus content ends -- marks
    distribution and the month-wise schedule carry no chapter subtopics."""
    grade: int | None = None
    current: dict | None = None
    chapters: list[dict] = []

    for raw in path.read_text(encoding="utf-8").splitlines():
        stripped = raw.rstrip()
        content = stripped.strip()
        if not content:
            continue

        m = _PART_RE.match(content)
        if m:
            part = int(m.group(1))
            if part == 2:
                grade, current = 9, None
            elif part == 3:
                grade, current = 10, None
            elif part >= 4:
                break
            continue

        if grade is None:
            continue  # before PART 2 -- examination pattern, not a chapter

        m = _CHAPTER_RE.match(content)
        if m:
            current = {"grade": grade, "title": m.group(1).strip(), "subtopics": []}
            chapters.append(current)
            continue

        if current is None:
            continue

        indent = len(stripped) - len(stripped.lstrip(" "))
        if indent < 4 and content.startswith("- "):
            text = content[2:].strip().rstrip(":").strip()
        elif 4 <= indent < 6 and content.startswith("* "):
            text = content[2:].strip().rstrip(":").strip()
        else:
            continue
        if text and not text.lower().startswith("note:"):
            current["subtopics"].append(text)

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
    subject = db.query(Subject).filter_by(board=BOARD, name=SUBJECT_NAME).one()

    new_chapters = new_topics = 0
    for item in chapters:
        grade = grades.get(item["grade"])
        if grade is None:
            print(f"SKIP Social Science class {item['grade']}: grade not found")
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
            print(f"  + chapter  Class {item['grade']} #{next_number} {item['title']}")
        else:
            print(f"    match    Class {item['grade']} #{chapter.chapter_number} {chapter.title!r} <- {item['title']!r}")

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
    print(f"parsed {len(chapters)} Social Science chapters from {TXT_PATH.name}\n")

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
