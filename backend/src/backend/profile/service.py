from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db.models import District, Grade, School, Student, Subject, Teacher, TeacherSubject
from backend.profile.schemas import (
    ProfileOut,
    ProfileSubjectOut,
    ProfileUpdateIn,
    SchoolOut,
    StudentSelfProfileOut,
    StudentSelfProfileUpdateIn,
)


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

    subject_rows = (
        db.query(TeacherSubject, Subject.name, Grade.label, Grade.numeric_level)
        .join(Subject, TeacherSubject.subject_id == Subject.id)
        .join(Grade, TeacherSubject.grade_id == Grade.id)
        .filter(TeacherSubject.teacher_id == teacher.id)
        .order_by(TeacherSubject.is_primary.desc(), Grade.numeric_level)
        .all()
    )
    subjects = [
        ProfileSubjectOut(
            subject_id=ts.subject_id,
            subject_name=subject_name,
            grade_id=ts.grade_id,
            grade_label=grade_label,
            numeric_level=numeric_level,
            is_primary=ts.is_primary,
        )
        for ts, subject_name, grade_label, numeric_level in subject_rows
    ]

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

    if payload.subjects is not None:
        subject_ids = {s.subject_id for s in payload.subjects}
        grade_ids = {s.grade_id for s in payload.subjects}
        if db.query(Subject.id).filter(Subject.id.in_(subject_ids)).count() != len(subject_ids):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more subjects are invalid.")
        if db.query(Grade.id).filter(Grade.id.in_(grade_ids)).count() != len(grade_ids):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more grades are invalid.")

        # replace the whole set
        db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher.id).delete()
        for item in payload.subjects:
            db.add(
                TeacherSubject(
                    teacher_id=teacher.id,
                    subject_id=item.subject_id,
                    grade_id=item.grade_id,
                    is_primary=item.is_primary,
                )
            )

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
