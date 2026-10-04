from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db.models import (
    AcademicYear,
    ClassSection,
    District,
    Grade,
    School,
    Student,
    Subject,
    Teacher,
    TeachingAssignment,
)
from backend.profile.schemas import (
    ProfileOut,
    ProfileSubjectOut,
    ProfileUpdateIn,
    SchoolOut,
    StudentSelfProfileOut,
    StudentSelfProfileUpdateIn,
)


def _assigned_subjects(db: Session, teacher: Teacher) -> list[ProfileSubjectOut]:
    """The subject-and-grade pairs the principal assigned this teacher in the
    current year, from teaching_assignments (one per class section). The
    dashboard's subject and class pickers read this. A teacher can't edit it.

    One pair is primary: the first in order, with the teacher's own class (where
    they are class teacher) sorted ahead of the rest."""
    rows = (
        db.query(
            TeachingAssignment.subject_id,
            Subject.name,
            ClassSection.grade_id,
            Grade.label,
            Grade.numeric_level,
            ClassSection.class_teacher_id,
        )
        .join(ClassSection, TeachingAssignment.class_section_id == ClassSection.id)
        .join(AcademicYear, ClassSection.academic_year_id == AcademicYear.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .filter(
            TeachingAssignment.teacher_id == teacher.id,
            TeachingAssignment.role == "primary",
            AcademicYear.is_current.is_(True),
        )
        .all()
    )

    pairs: dict[tuple, dict] = {}
    for subject_id, subject_name, grade_id, grade_label, numeric_level, class_teacher_id in rows:
        entry = pairs.setdefault(
            (subject_id, grade_id),
            {
                "subject_name": subject_name,
                "grade_label": grade_label,
                "numeric_level": numeric_level,
                "primary": False,
            },
        )
        if class_teacher_id == teacher.id:
            entry["primary"] = True

    ordered = sorted(
        pairs.items(),
        key=lambda kv: (not kv[1]["primary"], kv[1]["numeric_level"], kv[1]["subject_name"]),
    )
    # exactly one primary: the first pair in order (a class teacher teaches several
    # subjects in their own class, so the flag can't mean "all of them")
    primary_key = ordered[0][0] if ordered else None
    return [
        ProfileSubjectOut(
            subject_id=subject_id,
            subject_name=entry["subject_name"],
            grade_id=grade_id,
            grade_label=entry["grade_label"],
            numeric_level=entry["numeric_level"],
            is_primary=(subject_id, grade_id) == primary_key,
        )
        for (subject_id, grade_id), entry in ordered
    ]


def _build_profile(db: Session, teacher: Teacher) -> ProfileOut:
    school_out: SchoolOut | None = None
    if teacher.school_id is not None:
        row = (
            db.query(School, District.name)
            .join(District, School.district_id == District.id)
            .filter(School.id == teacher.school_id)
            .one_or_none()
        )
        if row is not None:
            school, district_name = row
            school_out = SchoolOut(
                id=school.id, name=school.name, district_name=district_name
            )

    subjects = _assigned_subjects(db, teacher)

    return ProfileOut(
        id=teacher.id,
        full_name=teacher.full_name,
        email=teacher.email,
        phone_number=teacher.phone_number,
        preferred_language=teacher.preferred_language,
        photo_url=teacher.photo_url,
        onboarded_at=teacher.onboarded_at,
        school=school_out,
        subjects=subjects,
    )


def get_profile(db: Session, teacher: Teacher) -> ProfileOut:
    return _build_profile(db, teacher)


def update_profile(db: Session, teacher: Teacher, payload: ProfileUpdateIn) -> ProfileOut:
    if payload.full_name is not None:
        teacher.full_name = payload.full_name
    if payload.preferred_language is not None:
        teacher.preferred_language = payload.preferred_language

    teacher.updated_at = func.now()
    db.commit()
    db.refresh(teacher)
    return _build_profile(db, teacher)


def _build_student_profile(student: Student) -> StudentSelfProfileOut:
    return StudentSelfProfileOut(
        id=student.id,
        full_name=student.full_name,
        email=student.email,
        phone_number=student.phone_number,
        preferred_language=student.preferred_language,
        photo_url=student.photo_url,
    )


def get_student_self_profile(student: Student) -> StudentSelfProfileOut:
    return _build_student_profile(student)


def update_student_self_profile(
    db: Session, student: Student, payload: StudentSelfProfileUpdateIn
) -> StudentSelfProfileOut:
    if payload.full_name is not None:
        student.full_name = payload.full_name
    if payload.preferred_language is not None:
        student.preferred_language = payload.preferred_language
    student.updated_at = func.now()
    db.commit()
    db.refresh(student)
    return _build_student_profile(student)


def set_photo(db: Session, actor: Teacher | Student, photo_url: str) -> None:
    actor.photo_url = photo_url
    db.commit()


def clear_photo(db: Session, actor: Teacher | Student) -> None:
    actor.photo_url = None
    db.commit()
