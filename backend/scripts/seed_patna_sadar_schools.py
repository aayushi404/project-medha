"""Replace the placeholder/dummy school data with a real list of 10 Patna
Sadar (Patna district) government schools, given by the user with their
actual UDISE codes.

This is destructive by design: every existing school (and everything that
hangs off one -- teachers, students, class sections, attendance, homework,
report cards, chat/generation history, ...) is deleted first, since none of
it corresponds to a real school any more. The single `admin` account (which
has no school_id) is the only row in `teachers` preserved.

Districts and blocks are NOT touched -- "Patna" district and "Patna Sadar"
block already exist (from scripts/seed_schools.py) and are reused as-is.

Local dev database ONLY. Never point this at Neon/production.

Usage:
    uv run python scripts/seed_patna_sadar_schools.py
"""
import os
import sys

from sqlalchemy import text
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from backend.db.models import Block, District, School
from backend.db.session import SessionLocal, engine

# Leaf-to-root delete order for every table that hangs off schools/teachers/
# students, computed from the live FK graph (information_schema) so it stays
# correct if the schema changes -- see the audit that produced this list.
_DELETE_ORDER = [
    "generation_feedback", "generation_exports", "chat_messages", "module_feedback",
    "module_artifacts", "generations", "voice_turns", "modules", "absence_calls",
    "homework_status", "student_enrollments", "report_card_marks", "notifications",
    "fee_payments", "device_tokens", "chat_sessions", "auth_tokens", "auth_sessions",
    "attendance_records", "approval_events", "teaching_assignments", "homework",
    "timetable_entries", "teacher_subjects", "students", "practice_questions",
    "library_items", "class_sections", "chapter_notes", "teachers", "academic_years",
    "schools",
]

# name, udise_code
_SCHOOLS = [
    ("B.N.Collegiate Inter School Bankipur Patna", "10280106211"),
    ("Dwarka H/S Mandiri", "10280104104"),
    ("F.N.S Academy", "10280105524"),
    ("High School Chiraiyatand", "10280107811"),
    ("Kamla Nehru H.S+2 Girls School", "10280108611"),
    ("P.N.Anglo Sanskrit Uchh Madhyamik School", "10280105530"),
    ("Govt. Girls High School Gardanibagh", "10280108610"),
    ("Sir G.D.Patliputra Senior Secondary School", "10280105551"),
    ("Sir Raghunath Prasad Girls High School Kankarbag", "10280104707"),
    ("Sri Daroga Prasad Rai High School Saristabad", "10280105547"),
]


def get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def main() -> None:
    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    db = SessionLocal()
    try:
        print("Deleting existing school data...")
        for table in _DELETE_ORDER:
            if table == "teachers":
                result = db.execute(text("DELETE FROM teachers WHERE role != 'admin'"))
            else:
                result = db.execute(text(f"DELETE FROM {table}"))
            if result.rowcount:
                print(f"  deleted {result.rowcount:>4d} from {table}")
        db.commit()

        district, _ = get_or_create(db, District, name="Patna", state="Bihar")
        block, _ = get_or_create(db, Block, district_id=district.id, name="Patna Sadar")

        print(f"\nAdding {len(_SCHOOLS)} Patna Sadar schools...")
        for name, udise in _SCHOOLS:
            school, created = get_or_create(
                db,
                School,
                udise_code=udise,
                defaults={
                    "name": name,
                    "district_id": district.id,
                    "block_id": block.id,
                    "school_type": "secondary",
                },
            )
            print(f"  {'created' if created else 'exists '}  {school.name}  (udise={udise})")

        db.commit()
        print("\nDone.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
