import os
import sys
from datetime import date, datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

# Add backend package to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from backend.auth.hashing import hash_password
from backend.db.models import (
    AcademicYear,
    ClassSection,
    District,
    Grade,
    ReportCardMark,
    School,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    TeacherSubject,
    TeachingAssignment,
)
from backend.db.session import SessionLocal


def get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def seed_demo_data():
    db: Session = SessionLocal()
    try:
        print("🌱 Seeding Medha database...")

        # 1. District
        district, _ = get_or_create(db, District, name="Patna", state="Bihar")

        # 2. School -- a real Patna Sadar school (see seed_patna_sadar_schools.py,
        # which must be run first). Looked up by its real UDISE code rather than
        # created here, since this data now has to be genuine, not invented.
        school = db.query(School).filter(School.udise_code == "10280106211").one_or_none()
        if school is None:
            raise SystemExit(
                "No school with udise_code=10280106211 found. Run "
                "scripts/seed_patna_sadar_schools.py first."
            )
        print(f"✓ School: {school.name}")

        # 3. Grades (Class 6 to 10)
        grade_defs = [("Class 6", 6), ("Class 7", 7), ("Class 8", 8), ("Class 9", 9), ("Class 10", 10)]
        grades = {}
        for label, level in grade_defs:
            g, _ = get_or_create(db, Grade, label=label, numeric_level=level)
            grades[label] = g

        # 4. Subjects
        subject_defs = ["Mathematics", "Science", "Social Science", "Hindi", "English"]
        subjects = {}
        for sname in subject_defs:
            subj, _ = get_or_create(db, Subject, name=sname, board="BSEB")
            subjects[sname] = subj
        print("✓ Grades & Subjects initialized")

        # 3b. Current academic year + one class_section (Section A) per grade --
        # real class placement now lives here, not on a denormalized
        # students.grade_id/roll_number pair (see the school-management-system
        # rewiring pass).
        academic_year, _ = get_or_create(
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
        if not academic_year.is_current:
            academic_year.is_current = True
            db.flush()

        class_sections = {}
        for label in grades:
            cs, _ = get_or_create(
                db,
                ClassSection,
                school_id=school.id,
                academic_year_id=academic_year.id,
                grade_id=grades[label].id,
                section="A",
            )
            class_sections[label] = cs
        print(f"✓ Academic year {academic_year.label} + {len(class_sections)} class sections (Section A)")

        # 5. Approved Principal
        default_pwd = hash_password("Password@123")
        now = datetime.now(timezone.utc)

        principal, p_created = get_or_create(
            db,
            Teacher,
            email="principal.patna@medhabihar.org",
            defaults={
                "school_id": school.id,
                "full_name": "Dr. Rameshwar Sharma",
                "phone_number": "+919876543210",
                "password_hash": default_pwd,
                "role": "principal",
                "approval_status": "approved",
                "approved_at": now,
                "onboarded_at": now,
                "email_verified_at": now,
            },
        )
        if not p_created:
            principal.approval_status = "approved"
            principal.password_hash = default_pwd
            principal.school_id = school.id
            principal.onboarded_at = principal.onboarded_at or now
            principal.email_verified_at = principal.email_verified_at or now
            db.flush()
        print(f"✓ Principal: {principal.full_name} ({principal.email})")

        # 6. 5 Approved Teachers
        teacher_configs = [
            {
                "full_name": "Anita Verma",
                "email": "anita.science@medhabihar.org",
                "phone": "+919876543211",
                "code": "T-1001",
                "assignments": [
                    ("Science", "Class 6"),
                    ("Science", "Class 7"),
                    ("Science", "Class 8"),
                    ("Mathematics", "Class 6"),
                ],
            },
            {
                "full_name": "Rajesh Kumar",
                "email": "rajesh.maths@medhabihar.org",
                "phone": "+919876543212",
                "code": "T-1002",
                "assignments": [
                    ("Mathematics", "Class 9"),
                    ("Mathematics", "Class 10"),
                    ("Science", "Class 9"),
                    ("Science", "Class 10"),
                ],
            },
            {
                "full_name": "Sunita Singh",
                "email": "sunita.social@medhabihar.org",
                "phone": "+919876543213",
                "code": "T-1003",
                "assignments": [
                    ("Social Science", "Class 6"),
                    ("Social Science", "Class 7"),
                    ("Social Science", "Class 8"),
                    ("Social Science", "Class 9"),
                    ("Social Science", "Class 10"),
                ],
            },
            {
                "full_name": "Pankaj Mishra",
                "email": "pankaj.hindi@medhabihar.org",
                "phone": "+919876543214",
                "code": "T-1004",
                "assignments": [
                    ("Hindi", "Class 6"),
                    ("Hindi", "Class 7"),
                    ("English", "Class 6"),
                ],
            },
            {
                "full_name": "Kavita Roy",
                "email": "kavita.english@medhabihar.org",
                "phone": "+919876543215",
                "code": "T-1005",
                "assignments": [
                    ("English", "Class 9"),
                    ("English", "Class 10"),
                    ("Science", "Class 9"),
                ],
            },
        ]

        seeded_teachers = []
        for cfg in teacher_configs:
            t_obj, created = get_or_create(
                db,
                Teacher,
                email=cfg["email"],
                defaults={
                    "school_id": school.id,
                    "full_name": cfg["full_name"],
                    "phone_number": cfg["phone"],
                    "password_hash": default_pwd,
                    "role": "teacher",
                    "approval_status": "approved",
                    "approved_by": principal.id,
                    "approved_at": now,
                    "employee_code": cfg["code"],
                    "years_of_experience": 8,
                    "qualification": "B.Ed, M.Sc",
                    "onboarded_at": now,
                    "email_verified_at": now,
                },
            )
            if not created:
                t_obj.approval_status = "approved"
                t_obj.approved_by = principal.id
                t_obj.school_id = school.id
                t_obj.password_hash = default_pwd
                t_obj.onboarded_at = t_obj.onboarded_at or now
                t_obj.email_verified_at = t_obj.email_verified_at or now
                db.flush()

            seeded_teachers.append(t_obj)

            # Assign teacher subjects (curriculum-level onboarding, feeds Ask
            # Medha / content generation) and mirror each into a real
            # class_section teaching_assignment (school-level "teaches
            # Science to 8A" access grant, feeds attendance/homework/report
            # cards/OMR/notifications).
            for sname, glabel in cfg["assignments"]:
                get_or_create(
                    db,
                    TeacherSubject,
                    teacher_id=t_obj.id,
                    subject_id=subjects[sname].id,
                    grade_id=grades[glabel].id,
                    defaults={"is_primary": True},
                )
                get_or_create(
                    db,
                    TeachingAssignment,
                    teacher_id=t_obj.id,
                    class_section_id=class_sections[glabel].id,
                    subject_id=subjects[sname].id,
                )

                # First teacher assigned to a grade becomes that section's
                # class_teacher, so the homeroom bypass has something to
                # exercise in testing.
                section = class_sections[glabel]
                if section.class_teacher_id is None:
                    section.class_teacher_id = t_obj.id
                    db.flush()
            print(f"✓ Teacher: {t_obj.full_name} ({t_obj.email})")

        # 7. 10 Approved Students (Class 6 to 10)
        student_configs = [
            # Class 6
            {"full_name": "Aditi Sharma", "email": "aditi.c6@medhabihar.org", "phone": "+919800000001", "grade": "Class 6", "roll": "01"},
            {"full_name": "Aman Kumar", "email": "aman.c6@medhabihar.org", "phone": "+919800000002", "grade": "Class 6", "roll": "02"},
            # Class 7
            {"full_name": "Priya Singh", "email": "priya.c7@medhabihar.org", "phone": "+919800000003", "grade": "Class 7", "roll": "01"},
            {"full_name": "Rahul Kumar", "email": "rahul.c7@medhabihar.org", "phone": "+919800000004", "grade": "Class 7", "roll": "02"},
            # Class 8
            {"full_name": "Ananya Kumari", "email": "ananya.c8@medhabihar.org", "phone": "+919800000005", "grade": "Class 8", "roll": "01"},
            {"full_name": "Rohan Gupta", "email": "rohan.c8@medhabihar.org", "phone": "+919800000006", "grade": "Class 8", "roll": "02"},
            # Class 9
            {"full_name": "Vikram Yadav", "email": "vikram.c9@medhabihar.org", "phone": "+919800000007", "grade": "Class 9", "roll": "01"},
            {"full_name": "Neha Patel", "email": "neha.c9@medhabihar.org", "phone": "+919800000008", "grade": "Class 9", "roll": "02"},
            # Class 10
            {"full_name": "Siddharth Mishra", "email": "siddharth.c10@medhabihar.org", "phone": "+919800000009", "grade": "Class 10", "roll": "01"},
            {"full_name": "Pooja Rani", "email": "pooja.c10@medhabihar.org", "phone": "+919800000010", "grade": "Class 10", "roll": "02"},
        ]

        seeded_students = []
        for scfg in student_configs:
            st_obj, created = get_or_create(
                db,
                Student,
                email=scfg["email"],
                defaults={
                    "school_id": school.id,
                    "full_name": scfg["full_name"],
                    "phone_number": scfg["phone"],
                    "password_hash": default_pwd,
                    "approval_status": "approved",
                    "approved_by": principal.id,
                    "approved_at": now,
                    "guardian_name": f"Guardian of {scfg['full_name']}",
                    "guardian_relation": "father",
                    "guardian_phone": scfg["phone"],
                    "email_verified_at": now,
                },
            )
            if not created:
                st_obj.email_verified_at = st_obj.email_verified_at or now
                st_obj.approval_status = "approved"
                st_obj.school_id = school.id
                st_obj.password_hash = default_pwd
                db.flush()
            seeded_students.append(st_obj)

            section = class_sections[scfg["grade"]]
            roll = int(scfg["roll"])
            enrollment, enr_created = get_or_create(
                db,
                StudentEnrollment,
                student_id=st_obj.id,
                academic_year_id=academic_year.id,
                defaults={
                    "class_section_id": section.id,
                    "roll_number": roll,
                    "enrolled_on": date.today(),
                },
            )
            if not enr_created:
                enrollment.class_section_id = section.id
                enrollment.roll_number = roll
                enrollment.left_on = None
                db.flush()

            print(f"✓ Student: {st_obj.full_name} ({st_obj.email}) - {scfg['grade']} Roll {scfg['roll']}")

        # 8. Seed Dummy Report Card Marks
        first_teacher = seeded_teachers[0]
        term_name = "Mid Term Examination"

        sample_marks = [
            (seeded_students[0], "Mathematics", 85.0, 100.0, "Great understanding of algebra."),
            (seeded_students[0], "Science", 92.5, 100.0, "Excellent performance in practicals."),
            (seeded_students[1], "Mathematics", 76.0, 100.0, "Needs practice in geometry."),
            (seeded_students[1], "Science", 88.0, 100.0, "Good grasp of concepts."),
            (seeded_students[4], "Science", 94.5, 100.0, "Outstanding presentation in exam."),
            (seeded_students[6], "Mathematics", 91.0, 100.0, "Top scorer in class 9."),
        ]

        for st, sname, obtained, total, rem in sample_marks:
            get_or_create(
                db,
                ReportCardMark,
                student_id=st.id,
                subject_id=subjects[sname].id,
                term=term_name,
                defaults={
                    "marks_obtained": obtained,
                    "max_marks": total,
                    "remarks": rem,
                    "entered_by": first_teacher.id,
                },
            )

        db.commit()
        print("\n🎉 Seeding complete successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
