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


def delete_mark(db: Session, teacher: Teacher, student_id: uuid.UUID, subject_id: uuid.UUID, term: str) -> None:
    row = (
        db.query(ReportCardMark)
        .filter(
            ReportCardMark.student_id == student_id,
            ReportCardMark.subject_id == subject_id,
            ReportCardMark.term == term,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mark entry not found.")
    db.delete(row)
    db.commit()


def bulk_upsert_marks(db: Session, teacher: Teacher, payload: "BulkReportCardMarksIn") -> "BulkReportCardMarksOut":
    from backend.report_card.schemas import BulkReportCardMarksOut

    if teacher.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")

    _assert_teaches(db, teacher, payload.subject_id, payload.grade_id)

    students = (
        db.query(Teacher)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == teacher.school_id,
            Teacher.grade_id == payload.grade_id,
        )
        .all()
    )
    valid_student_ids = {s.id for s in students}

    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found.")

    updated_rows = []
    for mark_item in payload.marks:
        if mark_item.student_id not in valid_student_ids:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Student {mark_item.student_id} is not in this class roster.",
            )
        if mark_item.marks_obtained > payload.max_marks:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Marks obtained ({mark_item.marks_obtained}) cannot exceed maximum marks ({payload.max_marks}).",
            )

        row = (
            db.query(ReportCardMark)
            .filter(
                ReportCardMark.student_id == mark_item.student_id,
                ReportCardMark.subject_id == payload.subject_id,
                ReportCardMark.term == payload.term,
            )
            .first()
        )
        if row is None:
            row = ReportCardMark(
                student_id=mark_item.student_id,
                subject_id=payload.subject_id,
                term=payload.term,
                entered_by=teacher.id,
            )
            db.add(row)

        row.marks_obtained = mark_item.marks_obtained
        row.max_marks = payload.max_marks
        row.remarks = mark_item.remarks
        row.entered_by = teacher.id
        updated_rows.append(row)

    db.commit()

    out_marks = []
    for row in updated_rows:
        db.refresh(row)
        out_marks.append(
            ReportCardMarkOut(
                subject_id=row.subject_id,
                subject_name=subject.name,
                term=row.term,
                marks_obtained=row.marks_obtained,
                max_marks=row.max_marks,
                remarks=row.remarks,
                updated_at=row.updated_at,
            )
        )

    return BulkReportCardMarksOut(saved_count=len(out_marks), marks=out_marks)


def get_class_marks(
    db: Session, teacher: Teacher, grade_id: uuid.UUID, subject_id: uuid.UUID, term: str
) -> list[ReportCardMarkOut]:
    if teacher.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")

    _assert_teaches(db, teacher, subject_id, grade_id)

    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found.")

    rows = (
        db.query(ReportCardMark)
        .join(Teacher, ReportCardMark.student_id == Teacher.id)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == teacher.school_id,
            Teacher.grade_id == grade_id,
            ReportCardMark.subject_id == subject_id,
            ReportCardMark.term == term,
        )
        .all()
    )

    return [
        ReportCardMarkOut(
            subject_id=r.subject_id,
            subject_name=subject.name,
            term=r.term,
            marks_obtained=r.marks_obtained,
            max_marks=r.max_marks,
            remarks=r.remarks,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


