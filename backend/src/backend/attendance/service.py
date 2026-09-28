"""Attendance. A teacher marks the roster of one class_section they're
actually assigned to (a `teaching_assignments` row, or being its
class_teacher -- see `core.section_access`); the roster itself comes from
each student's current `StudentEnrollment` for that section, not a
denormalized grade column."""

import uuid
from datetime import date as date_
from datetime import datetime, timezone

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session

from backend.absence_calls.service import queue_call_for_absence
from backend.attendance.schemas import (
    AttendanceDayOut,
    AttendanceMarkIn,
    AttendanceMineItem,
    AttendanceStudentOut,
)
from backend.core.section_access import assert_can_act_on_section, assert_is_class_teacher_of_section
from backend.db.models import (
    AttendanceRecord,
    Grade,
    Student,
    StudentEnrollment,
    Teacher,
)


def _school_id(teacher: Teacher) -> uuid.UUID:
    if teacher.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return teacher.school_id


def _roster(db: Session, class_section_id: uuid.UUID) -> list[tuple[Student, int | None]]:
    rows = (
        db.query(Student, StudentEnrollment.roll_number)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .filter(
            StudentEnrollment.class_section_id == class_section_id,
            StudentEnrollment.left_on.is_(None),
            Student.approval_status == "approved",
        )
        .order_by(StudentEnrollment.roll_number, Student.full_name)
        .all()
    )
    return rows


def get_day(db: Session, teacher: Teacher, class_section_id: uuid.UUID, on_date: date_) -> AttendanceDayOut:
    _school_id(teacher)
    section = assert_can_act_on_section(db, teacher, class_section_id)
    grade = db.get(Grade, section.grade_id)
    roster = _roster(db, class_section_id)

    student_ids = [s.id for s, _ in roster]
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
        class_section_id=class_section_id,
        grade_label=grade.label if grade else "",
        section=section.section,
        date=on_date,
        students=[
            AttendanceStudentOut(
                student_id=s.id,
                full_name=s.full_name,
                roll_number=roll_number,
                photo_url=s.photo_url,
                status=marks.get(s.id),
            )
            for s, roll_number in roster
        ],
    )


def mark_day(
    db: Session,
    teacher: Teacher,
    payload: AttendanceMarkIn,
    background_tasks: BackgroundTasks | None = None,
) -> AttendanceDayOut:
    _school_id(teacher)
    assert_is_class_teacher_of_section(db, teacher, payload.class_section_id)
    valid_ids = {s.id for s, _ in _roster(db, payload.class_section_id)}

    # Rows that just transitioned into "absent" for the first time -- these,
    # and only these, get an instant guardian call (see queue_call_for_absence).
    # A re-save of an already-absent row, or backdating a past day, doesn't
    # re-ring the phone.
    newly_absent: list[AttendanceRecord] = []
    is_today = payload.date == date_.today()

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
            was_absent = existing.status == "absent"
            existing.status = record.status
            existing.marked_by_teacher_id = teacher.id
            existing.updated_at = datetime.now(timezone.utc)
            row = existing
        else:
            was_absent = False
            row = AttendanceRecord(
                student_id=record.student_id,
                marked_by_teacher_id=teacher.id,
                attendance_date=payload.date,
                status=record.status,
            )
            db.add(row)

        if is_today and record.status == "absent" and not was_absent:
            newly_absent.append(row)

    db.commit()

    if background_tasks is not None:
        for row in newly_absent:
            background_tasks.add_task(queue_call_for_absence, row.id)

    return get_day(db, teacher, payload.class_section_id, payload.date)


def list_for_student(db: Session, student: Student) -> list[AttendanceMineItem]:
    rows = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student.id)
        .order_by(AttendanceRecord.attendance_date.desc())
        .all()
    )
    return [AttendanceMineItem(date=r.attendance_date, status=r.status) for r in rows]
