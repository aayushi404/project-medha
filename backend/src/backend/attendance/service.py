"""Attendance. A teacher marks their own school's approved-student roster
for one grade at a time; scoping (`school_id` match, `role == 'student'`,
`approval_status == 'approved'`) lives here, same shape as
`teacher/service.py`'s student-roster queries -- a stray id from another
school or grade is silently dropped, not trusted."""

import uuid
from datetime import date as date_
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.attendance.schemas import AttendanceDayOut, AttendanceMarkIn, AttendanceStudentOut
from backend.db.models import AttendanceRecord, Grade, Teacher


def _school_id(teacher: Teacher) -> uuid.UUID:
    if teacher.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return teacher.school_id


def _scoped_grade(db: Session, grade_id: uuid.UUID) -> Grade:
    grade = db.get(Grade, grade_id)
    if grade is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found.")
    return grade


def _roster(db: Session, school_id: uuid.UUID, grade_id: uuid.UUID) -> list[Teacher]:
    return (
        db.query(Teacher)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == school_id,
            Teacher.grade_id == grade_id,
            Teacher.approval_status == "approved",
        )
        .order_by(Teacher.roll_number, Teacher.full_name)
        .all()
    )


def get_day(db: Session, teacher: Teacher, grade_id: uuid.UUID, on_date: date_) -> AttendanceDayOut:
    school_id = _school_id(teacher)
    grade = _scoped_grade(db, grade_id)
    roster = _roster(db, school_id, grade_id)

    student_ids = [s.id for s in roster]
    marks: dict[uuid.UUID, str] = {}
    if student_ids:
        rows = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id.in_(student_ids),
                AttendanceRecord.attendance_date == on_date,
            )
            .all()
        )
        marks = {r.student_id: r.status for r in rows}

    return AttendanceDayOut(
        grade_id=grade_id,
        grade_label=grade.label,
        date=on_date,
        students=[
            AttendanceStudentOut(
                student_id=s.id,
                full_name=s.full_name,
                roll_number=s.roll_number,
                status=marks.get(s.id),
            )
            for s in roster
        ],
    )


def mark_day(db: Session, teacher: Teacher, payload: AttendanceMarkIn) -> AttendanceDayOut:
    school_id = _school_id(teacher)
    _scoped_grade(db, payload.grade_id)
    valid_ids = {s.id for s in _roster(db, school_id, payload.grade_id)}

    for record in payload.records:
        if record.student_id not in valid_ids:
            continue
        existing = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == record.student_id,
                AttendanceRecord.attendance_date == payload.date,
            )
            .first()
        )
        if existing is not None:
            existing.status = record.status
            existing.marked_by_teacher_id = teacher.id
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(
                AttendanceRecord(
                    student_id=record.student_id,
                    marked_by_teacher_id=teacher.id,
                    attendance_date=payload.date,
                    status=record.status,
                )
            )
    db.commit()

    return get_day(db, teacher, payload.grade_id, payload.date)
