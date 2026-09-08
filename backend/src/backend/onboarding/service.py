from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import Grade, School, Subject, Teacher, TeacherSubject
from backend.onboarding.schemas import OnboardingCompleteIn


def complete_onboarding(
    db: Session, teacher: Teacher, payload: OnboardingCompleteIn
) -> Teacher:
    if teacher.onboarded_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Onboarding has already been completed."
        )

    school = db.get(School, payload.school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found.")

    subject_ids = {s.subject_id for s in payload.subjects}
    grade_ids = {s.grade_id for s in payload.subjects}

    found_subjects = db.query(Subject.id).filter(Subject.id.in_(subject_ids)).count()
    if found_subjects != len(subject_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more subjects are invalid.")

    found_grades = db.query(Grade.id).filter(Grade.id.in_(grade_ids)).count()
    if found_grades != len(grade_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more grades are invalid.")

    teacher.full_name = payload.full_name
    teacher.school_id = payload.school_id
    teacher.onboarded_at = datetime.now(timezone.utc)

    for item in payload.subjects:
        db.add(
            TeacherSubject(
                teacher_id=teacher.id,
                subject_id=item.subject_id,
                grade_id=item.grade_id,
                is_primary=item.is_primary,
            )
        )

    db.commit()
    return teacher
