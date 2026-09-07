"""Report card: a teacher enters one subject's marks for one student in one
term, scoped to a subject/grade they actually teach (`teacher_subjects`) so
a Hindi teacher can't enter Science marks. Deliberately lightweight -- no
term management, no grade-boundary/rank computation."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import ReportCardMark, Subject, Teacher, TeacherSubject
from backend.report_card.schemas import ReportCardMarkIn, ReportCardMarkOut, ReportCardOut


def _assert_teaches(db: Session, teacher: Teacher, subject_id: uuid.UUID, grade_id: uuid.UUID) -> None:
    taught = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == teacher.id,
            TeacherSubject.subject_id == subject_id,
            TeacherSubject.grade_id == grade_id,
        )
        .first()
    )
    if taught is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't teach this subject at this grade.")


def upsert_mark(db: Session, teacher: Teacher, payload: ReportCardMarkIn) -> ReportCardMarkOut:
    student = db.get(Teacher, payload.student_id)
    if student is None or student.role != "student" or student.school_id != teacher.school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    if student.grade_id is not None:
        _assert_teaches(db, teacher, payload.subject_id, student.grade_id)

    row = (
        db.query(ReportCardMark)
        .filter(
            ReportCardMark.student_id == payload.student_id,
            ReportCardMark.subject_id == payload.subject_id,
            ReportCardMark.term == payload.term,
        )
        .first()
    )
    if row is None:
        row = ReportCardMark(student_id=payload.student_id, subject_id=payload.subject_id, term=payload.term, entered_by=teacher.id)
        db.add(row)
    row.marks_obtained = payload.marks_obtained
    row.max_marks = payload.max_marks
    row.remarks = payload.remarks
    row.entered_by = teacher.id
    db.commit()
    db.refresh(row)

    subject = db.get(Subject, payload.subject_id)
    return ReportCardMarkOut(
        subject_id=row.subject_id,
        subject_name=subject.name,
        term=row.term,
        marks_obtained=row.marks_obtained,
        max_marks=row.max_marks,
        remarks=row.remarks,
        updated_at=row.updated_at,
    )


def get_report_card(db: Session, viewer: Teacher, student_id: uuid.UUID) -> ReportCardOut:
    student = db.get(Teacher, student_id)
    if student is None or student.role != "student":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    # a student may only view their own; teacher/principal must share the school
    if viewer.role == "student":
        if viewer.id != student.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only view your own report card.")
    elif student.school_id != viewer.school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")

    rows = (
        db.query(ReportCardMark, Subject.name)
        .join(Subject, ReportCardMark.subject_id == Subject.id)
        .filter(ReportCardMark.student_id == student_id)
        .order_by(ReportCardMark.term, Subject.name)
        .all()
    )
    marks = [
        ReportCardMarkOut(
            subject_id=m.subject_id,
            subject_name=name,
            term=m.term,
            marks_obtained=m.marks_obtained,
            max_marks=m.max_marks,
            remarks=m.remarks,
            updated_at=m.updated_at,
        )
        for m, name in rows
    ]
    return ReportCardOut(student_id=student.id, student_name=student.full_name, marks=marks)
