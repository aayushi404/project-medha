"""Timetable: a weekly grid per grade, principal- or teacher-authored,
everyone at that school reads. `set_grid` replaces the whole grid for a
grade in one call rather than one-slot-at-a-time CRUD -- simpler for a
form that edits the whole week at once. Grades are a global reference
list (not per-school), so every query here scopes by the caller's own
`school_id`, not `grade_id` alone."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, aliased

from backend.db.models import Grade, Subject, Teacher, TimetableEntry
from backend.timetable.schemas import TimetableOut, TimetableSetIn, TimetableSlotOut


def _school_id(user: Teacher) -> uuid.UUID:
    if user.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return user.school_id


def get(db: Session, user: Teacher, grade_id: uuid.UUID) -> TimetableOut:
    school_id = _school_id(user)
    grade = db.get(Grade, grade_id)
    if grade is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found.")

    teacher_alias = aliased(Teacher)
    rows = (
        db.query(TimetableEntry, Subject.name, teacher_alias.full_name)
        .outerjoin(Subject, TimetableEntry.subject_id == Subject.id)
        .outerjoin(teacher_alias, TimetableEntry.teacher_id == teacher_alias.id)
        .filter(TimetableEntry.school_id == school_id, TimetableEntry.grade_id == grade_id)
        .order_by(TimetableEntry.day_of_week, TimetableEntry.period_number)
        .all()
    )
    slots = [
        TimetableSlotOut(
            day_of_week=e.day_of_week,
            period_number=e.period_number,
            subject_id=e.subject_id,
            subject_name=subject_name,
            teacher_id=e.teacher_id,
            teacher_name=teacher_name,
        )
        for e, subject_name, teacher_name in rows
    ]
    return TimetableOut(grade_id=grade_id, grade_label=grade.label, slots=slots)


def set_grid(db: Session, user: Teacher, payload: TimetableSetIn) -> TimetableOut:
    school_id = _school_id(user)
    grade = db.get(Grade, payload.grade_id)
    if grade is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found.")

    db.query(TimetableEntry).filter(
        TimetableEntry.school_id == school_id, TimetableEntry.grade_id == payload.grade_id
    ).delete()
    for slot in payload.slots:
        db.add(
            TimetableEntry(
                school_id=school_id,
                grade_id=payload.grade_id,
                day_of_week=slot.day_of_week,
                period_number=slot.period_number,
                subject_id=slot.subject_id,
                teacher_id=slot.teacher_id,
            )
        )
    db.commit()
    return get(db, user, payload.grade_id)
