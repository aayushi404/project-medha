"""Homework: a teacher assigns work to one grade at their school; each
student in that grade gets a personal done/not-done flag (self-reported,
not graded -- see HomeworkStatus in db/models/homework.py). Status rows
are created lazily (on the student's first read or first toggle) rather
than eagerly for the whole roster at assignment time, so a student
approved after the assignment was posted still sees it correctly with no
backfill needed."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import Grade, Homework, HomeworkStatus, Subject, Teacher
from backend.homework.schemas import (
    HomeworkCreateIn,
    HomeworkDetailOut,
    HomeworkListItem,
    HomeworkStudentOut,
)
from backend.notifications import service as notifications


def _school_id(teacher: Teacher) -> uuid.UUID:
    if teacher.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return teacher.school_id


def create(db: Session, teacher: Teacher, payload: HomeworkCreateIn) -> HomeworkDetailOut:
    school_id = _school_id(teacher)
    grade = db.get(Grade, payload.grade_id)
    if grade is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found.")
    subject = db.get(Subject, payload.subject_id) if payload.subject_id else None
    if payload.subject_id and subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found.")

    hw = Homework(
        teacher_id=teacher.id,
        school_id=school_id,
        grade_id=payload.grade_id,
        subject_id=payload.subject_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
    )
    db.add(hw)
    db.commit()
    db.refresh(hw)

    recipients = (
        db.query(Teacher)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == school_id,
            Teacher.grade_id == payload.grade_id,
            Teacher.approval_status == "approved",
        )
        .all()
    )
    notifications.notify(
        db,
        recipients=recipients,
        sender_id=teacher.id,
        type="homework_assigned",
        title=f"नया गृहकार्य: {hw.title}",
        body=payload.description or "",
        data={"homework_id": str(hw.id)},
    )

    return HomeworkDetailOut(
        id=hw.id,
        title=hw.title,
        description=hw.description,
        grade_label=grade.label,
        subject_name=subject.name if subject else None,
        due_date=hw.due_date,
        created_at=hw.created_at,
    )


def list_for_teacher(db: Session, teacher: Teacher) -> list[HomeworkListItem]:
    school_id = _school_id(teacher)
    rows = (
        db.query(Homework, Grade.label, Subject.name)
        .join(Grade, Homework.grade_id == Grade.id)
        .outerjoin(Subject, Homework.subject_id == Subject.id)
        .filter(Homework.school_id == school_id, Homework.teacher_id == teacher.id)
        .order_by(Homework.created_at.desc())
        .all()
    )
    items = []
    for hw, grade_label, subject_name in rows:
        total = (
            db.query(Teacher)
            .filter(
                Teacher.role == "student",
                Teacher.school_id == school_id,
                Teacher.grade_id == hw.grade_id,
                Teacher.approval_status == "approved",
            )
            .count()
        )
        done = (
            db.query(HomeworkStatus)
            .filter(HomeworkStatus.homework_id == hw.id, HomeworkStatus.done.is_(True))
            .count()
        )
        items.append(
            HomeworkListItem(
                id=hw.id,
                title=hw.title,
                grade_label=grade_label,
                subject_name=subject_name,
                due_date=hw.due_date,
                created_at=hw.created_at,
                done_count=done,
                total_count=total,
            )
        )
    return items


def list_for_student(db: Session, student: Teacher) -> list[HomeworkStudentOut]:
    if student.school_id is None or student.grade_id is None:
        return []
    rows = (
        db.query(Homework, Subject.name)
        .outerjoin(Subject, Homework.subject_id == Subject.id)
        .filter(Homework.school_id == student.school_id, Homework.grade_id == student.grade_id)
        .order_by(Homework.created_at.desc())
        .all()
    )
    out = []
    for hw, subject_name in rows:
        st = (
            db.query(HomeworkStatus)
            .filter(HomeworkStatus.homework_id == hw.id, HomeworkStatus.student_id == student.id)
            .first()
        )
        out.append(
            HomeworkStudentOut(
                id=hw.id,
                title=hw.title,
                description=hw.description,
                subject_name=subject_name,
                due_date=hw.due_date,
                done=bool(st and st.done),
                created_at=hw.created_at,
            )
        )
    return out


def set_done(db: Session, student: Teacher, homework_id: uuid.UUID, done: bool) -> HomeworkStudentOut:
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_id != student.school_id or hw.grade_id != student.grade_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found.")

    row = (
        db.query(HomeworkStatus)
        .filter(HomeworkStatus.homework_id == homework_id, HomeworkStatus.student_id == student.id)
        .first()
    )
    if row is None:
        row = HomeworkStatus(homework_id=homework_id, student_id=student.id)
        db.add(row)
    row.done = done
    row.done_at = datetime.now(timezone.utc) if done else None
    db.commit()

    subject_name = db.get(Subject, hw.subject_id).name if hw.subject_id else None
    return HomeworkStudentOut(
        id=hw.id,
        title=hw.title,
        description=hw.description,
        subject_name=subject_name,
        due_date=hw.due_date,
        done=row.done,
        created_at=hw.created_at,
    )
