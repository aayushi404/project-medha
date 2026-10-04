"""Dev-only demo data for the principal "Classes" directory (phase 2):
one current academic year, a handful of class sections, and a few students
enrolled in them -- enough to exercise the sections grid, roster, and
student profile screens without a CSV import yet.

This is a separate roster domain from the `teachers` role='student' login
rows (see docs/phase-2/Medha-principal-dashboard.md #3) -- these students
have no login and aren't meant to.

Each demo student gets their guardian's number as the login phone. Siblings
may share it, as in real life. The demo students have no password, so they
can be picked on the login screen but not signed in to.

Idempotent. NOT part of seed_phase0 -- run it explicitly, and only against a
dev database.

Usage:
    uv run python scripts/seed_class_sections_demo.py
"""
from datetime import date

from sqlalchemy.orm import Session

from backend.db.models import (
    AcademicYear,
    ClassSection,
    Grade,
    School,
    Student,
    StudentEnrollment,
    Teacher,
)
from backend.core.validators import e164_indian_mobile
from backend.db.session import SessionLocal, engine


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
        school = db.query(School).filter(School.name.ilike("%Patna Sadar%")).one_or_none()
        if school is None:
            raise SystemExit("run seed_phase0.py first (need the test school).")

        year, created = get_or_create(
            db,
            AcademicYear,
            school_id=school.id,
            label="2026-27",
            defaults={
                "starts_on": date(2026, 4, 1),
                "ends_on": date(2027, 3, 31),
                "is_current": True,
            },
        )
        print(f"{'created' if created else 'exists '}  year       {year.label}")

        def grade(label: str) -> Grade:
            g = db.query(Grade).filter(Grade.label == label).one_or_none()
            if g is None:
                raise SystemExit(f"run seed_phase0.py first (need {label}).")
            return g

        def class_teacher(full_name: str) -> Teacher | None:
            return (
                db.query(Teacher)
                .filter(Teacher.role == "teacher", Teacher.full_name.ilike(full_name))
                .one_or_none()
            )

        section_defs = [
            ("Class 6", "A", "Sunita Devi"),
            ("Class 7", "A", "Ramesh Kumar"),
            ("Class 8", "A", "Anita Sharma"),
            ("Class 8", "B", "Vijay Prasad"),
        ]
        sections: dict[tuple[str, str], ClassSection] = {}
        for grade_label, section_letter, teacher_name in section_defs:
            g = grade(grade_label)
            teacher = class_teacher(teacher_name)
            section, created = get_or_create(
                db,
                ClassSection,
                school_id=school.id,
                academic_year_id=year.id,
                grade_id=g.id,
                section=section_letter,
                defaults={"class_teacher_id": teacher.id if teacher else None},
            )
            sections[(grade_label, section_letter)] = section
            print(f"{'created' if created else 'exists '}  section    {grade_label} · {section_letter}")

        student_defs = [
            # grade, section, roll, name, guardian name, relation, phone
            ("Class 8", "A", 1, "Aarti Kumari", "Rajesh Kumar", "father", "+91 98765 43210"),
            ("Class 8", "A", 2, "Sonu Kumar", "Meena Devi", "mother", "+91 98765 43211"),
            ("Class 8", "A", 3, "Priya Yadav", "Suresh Yadav", "father", "+91 98765 43212"),
            ("Class 8", "B", 1, "Ravi Ranjan", "Manoj Ranjan", "father", "+91 98765 43220"),
            ("Class 8", "B", 2, "Kajal Kumari", "Sunita Kumari", "mother", "+91 98765 43221"),
            ("Class 7", "A", 1, "Amit Kumar", "Dinesh Kumar", "father", "+91 98765 43230"),
            ("Class 6", "A", 1, "Neha Singh", "Rekha Singh", "mother", "+91 98765 43240"),
        ]
        for grade_label, section_letter, roll, name, g_name, g_rel, g_phone in student_defs:
            section = sections[(grade_label, section_letter)]
            login_phone = e164_indian_mobile(g_phone)
            student, created = get_or_create(
                db,
                Student,
                school_id=school.id,
                full_name=name,
                defaults={
                    "phone_number": login_phone,
                    "guardian_name": g_name,
                    "guardian_relation": g_rel,
                    "guardian_phone": g_phone,
                },
            )
            print(f"{'created' if created else 'exists '}  student    {name}")

            _, enrolled = get_or_create(
                db,
                StudentEnrollment,
                student_id=student.id,
                academic_year_id=year.id,
                defaults={
                    "class_section_id": section.id,
                    "roll_number": roll,
                    "enrolled_on": date(2026, 4, 1),
                },
            )
            print(f"{'created' if enrolled else 'exists '}  enrolment  {name} -> {grade_label} · {section_letter}")

        db.commit()
        print("committed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
