"""Homework: a teacher assigns work to one class_section they're assigned
to teach a subject in (see `assert_can_act_on_section_and_subject`); each
student in that section gets a personal done/not-done flag (self-reported,
not graded -- see HomeworkStatus in db/models/homework.py). Status rows
are created lazily (on the student's first read or first toggle) rather
than eagerly for the whole roster at assignment time, so a student
approved after the assignment was posted still sees it correctly with no
backfill needed."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.section_access import assert_can_act_on_section_and_subject, current_enrollment
from backend.db.models import (
    ClassSection,
    Grade,
    Homework,
    HomeworkStatus,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
)
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


def _roster_student_ids(db: Session, class_section_id: uuid.UUID) -> list[uuid.UUID]:
    return [
        row[0]
        for row in db.query(Student.id)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .filter(
            StudentEnrollment.class_section_id == class_section_id,
            StudentEnrollment.left_on.is_(None),
            Student.approval_status == "approved",
        )
        .all()
    ]


def create(db: Session, teacher: Teacher, payload: HomeworkCreateIn) -> HomeworkDetailOut:
    school_id = _school_id(teacher)
    section = assert_can_act_on_section_and_subject(db, teacher, payload.class_section_id, payload.subject_id)
    grade = db.get(Grade, section.grade_id)
    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found.")

    hw = Homework(
        teacher_id=teacher.id,
        school_id=school_id,
        class_section_id=payload.class_section_id,
        subject_id=payload.subject_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
    )
    db.add(hw)
    db.commit()
    db.refresh(hw)

    student_ids = _roster_student_ids(db, payload.class_section_id)
    recipients = db.query(Student).filter(Student.id.in_(student_ids)).all() if student_ids else []
    notifications.notify(
        db,
        recipients=recipients,
        sender=teacher,
        type="homework_assigned",
        title=f"नया गृहकार्य: {hw.title}",
        body=payload.description or "",
        data={"homework_id": str(hw.id)},
    )

    return HomeworkDetailOut(
        id=hw.id,
        title=hw.title,
        description=hw.description,
        grade_label=grade.label if grade else "",
        section=section.section,
        subject_name=subject.name,
        due_date=hw.due_date,
        created_at=hw.created_at,
    )


def list_for_teacher(db: Session, teacher: Teacher) -> list[HomeworkListItem]:
    school_id = _school_id(teacher)
    rows = (
        db.query(Homework, Grade.label, ClassSection.section, Subject.name)
        .join(ClassSection, Homework.class_section_id == ClassSection.id)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .outerjoin(Subject, Homework.subject_id == Subject.id)
        .filter(Homework.school_id == school_id, Homework.teacher_id == teacher.id)
        .order_by(Homework.created_at.desc())
        .all()
    )
    items = []
    for hw, grade_label, section, subject_name in rows:
        total = len(_roster_student_ids(db, hw.class_section_id))
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
                section=section,
                subject_name=subject_name,
                due_date=hw.due_date,
                created_at=hw.created_at,
                done_count=done,
                total_count=total,
            )
        )
    return items


def list_for_student(db: Session, student: Student) -> list[HomeworkStudentOut]:
    enrollment = current_enrollment(db, student)
    if enrollment is None:
        return []
    rows = (
        db.query(Homework, Subject.name)
        .outerjoin(Subject, Homework.subject_id == Subject.id)
        .filter(Homework.class_section_id == enrollment.class_section_id)
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


def set_done(db: Session, student: Student, homework_id: uuid.UUID, done: bool) -> HomeworkStudentOut:
    hw = db.get(Homework, homework_id)
    enrollment = current_enrollment(db, student)
    if hw is None or enrollment is None or hw.class_section_id != enrollment.class_section_id:
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
