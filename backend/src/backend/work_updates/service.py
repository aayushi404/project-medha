"""Teacher daily work updates. A teacher files one per (grade, subject,
chapter) after teaching; the principal of the school can add a note, a badge
or a flag; students in that grade can approve or disapprove ("this really
was taught"), and the teacher and principal see exactly who reacted how."""

import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.section_access import current_enrollment
from backend.db.models import (
    ClassSection,
    CurriculumChapter,
    Homework,
    Student,
    Teacher,
    WorkUpdate,
    WorkUpdateReaction,
)
from backend.profile.service import _assigned_subjects
from backend.work_updates.schemas import (
    HomeworkRef,
    PrincipalFeedbackIn,
    ReactionOut,
    WorkUpdateCreateIn,
    WorkUpdateOut,
    WorkUpdateStudentOut,
)

IST = timezone(timedelta(hours=5, minutes=30))  # schools run on Bihar time
STUDENT_WINDOW_DAYS = 14
STAFF_LIMIT = 200


def _today() -> date:
    return datetime.now(IST).date()


def _school_id(user: Teacher) -> uuid.UUID:
    if user.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return user.school_id


def _todays_homework(db: Session, teacher: Teacher, grade_id: uuid.UUID, subject_id: uuid.UUID) -> list[HomeworkRef]:
    """Homework this teacher set today for this grade and subject. Read here,
    not taken from the client, so the report can't claim or hide it."""
    start = datetime.combine(_today(), time.min, tzinfo=IST)
    rows = (
        db.query(Homework.id, Homework.title)
        .join(ClassSection, Homework.class_section_id == ClassSection.id)
        .filter(
            Homework.teacher_id == teacher.id,
            Homework.subject_id == subject_id,
            ClassSection.grade_id == grade_id,
            Homework.created_at >= start,
        )
        .order_by(Homework.created_at)
        .all()
    )
    return [HomeworkRef(id=r[0], title=r[1]) for r in rows]


def todays_homework_for_teacher(
    db: Session, teacher: Teacher, grade_id: uuid.UUID, subject_id: uuid.UUID
) -> list[HomeworkRef]:
    return _todays_homework(db, teacher, grade_id, subject_id)


def create(db: Session, teacher: Teacher, payload: WorkUpdateCreateIn) -> WorkUpdateOut:
    school_id = _school_id(teacher)
    pair = next(
        (
            p
            for p in _assigned_subjects(db, teacher)
            if p.grade_id == payload.grade_id and p.subject_id == payload.subject_id
        ),
        None,
    )
    if pair is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to teach that class and subject.")
    chapter = db.get(CurriculumChapter, payload.chapter_id)
    if chapter is None or chapter.grade_id != payload.grade_id or chapter.subject_id != payload.subject_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That chapter doesn't belong to the class and subject.")

    activities = list(dict.fromkeys(payload.activities))
    homework = _todays_homework(db, teacher, payload.grade_id, payload.subject_id)
    if homework and "homework_given" not in activities:
        activities.append("homework_given")
    other = (payload.other_topics or "").strip() or None
    detail = (payload.activity_detail or "").strip() or None
    if "hands_on_activity" in activities and not detail:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Say which class activity was done.")
    note = payload.note.strip()
    if not note:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A short note for the principal is required.")

    row = WorkUpdate(
        teacher_id=teacher.id,
        school_id=school_id,
        grade_id=payload.grade_id,
        subject_id=payload.subject_id,
        chapter_id=chapter.id,
        work_date=_today(),
        grade_label=pair.grade_label,
        subject_name=pair.subject_name,
        chapter_title=chapter.title,
        activities=activities,
        topics=[t.strip() for t in payload.topics if t.strip()],
        other_topics=other,
        activity_detail=detail,
        homework=[h.model_dump(mode="json") for h in homework],
        ai_usefulness=payload.ai_usefulness,
        note=note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _staff_out(db, [row])[0]


def _staff_out(db: Session, rows: list[WorkUpdate]) -> list[WorkUpdateOut]:
    if not rows:
        return []
    ids = [r.id for r in rows]
    reactions: dict[uuid.UUID, list[ReactionOut]] = {}
    for rx, name in (
        db.query(WorkUpdateReaction, Student.full_name)
        .join(Student, Student.id == WorkUpdateReaction.student_id)
        .filter(WorkUpdateReaction.work_update_id.in_(ids))
        .order_by(Student.full_name)
        .all()
    ):
        reactions.setdefault(rx.work_update_id, []).append(
            ReactionOut(student_id=rx.student_id, student_name=name, value=rx.value)
        )
    names = {
        t.id: t.full_name
        for t in db.query(Teacher.id, Teacher.full_name).filter(Teacher.id.in_({r.teacher_id for r in rows}))
    }
    return [
        WorkUpdateOut(
            id=r.id,
            teacher_id=r.teacher_id,
            teacher_name=names.get(r.teacher_id, ""),
            work_date=r.work_date,
            created_at=r.created_at,
            grade_label=r.grade_label,
            subject_name=r.subject_name,
            chapter_title=r.chapter_title,
            activities=r.activities,
            topics=r.topics,
            other_topics=r.other_topics,
            activity_detail=r.activity_detail,
            homework=[HomeworkRef(**h) for h in r.homework],
            ai_usefulness=r.ai_usefulness,
            note=r.note,
            principal_note=r.principal_note,
            principal_badge=r.principal_badge,
            flagged=r.flagged,
            feedback_at=r.feedback_at,
            reactions=reactions.get(r.id, []),
        )
        for r in rows
    ]


def list_for_staff(db: Session, user: Teacher) -> list[WorkUpdateOut]:
    """A principal sees the whole school; a teacher sees only their own."""
    q = db.query(WorkUpdate).filter(WorkUpdate.school_id == _school_id(user))
    if user.role != "principal":
        q = q.filter(WorkUpdate.teacher_id == user.id)
    return _staff_out(db, q.order_by(WorkUpdate.created_at.desc()).limit(STAFF_LIMIT).all())


def give_feedback(db: Session, principal: Teacher, update_id: uuid.UUID, payload: PrincipalFeedbackIn) -> WorkUpdateOut:
    row = db.get(WorkUpdate, update_id)
    if row is None or row.school_id != principal.school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work update not found.")
    note = (payload.note or "").strip() or None
    if payload.flagged and not note:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Add a note explaining why you are flagging this.")
    row.principal_note = note
    row.principal_badge = payload.badge
    row.flagged = payload.flagged
    row.feedback_by_id = principal.id
    row.feedback_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _staff_out(db, [row])[0]


def list_for_student(db: Session, student: Student) -> list[WorkUpdateStudentOut]:
    enrollment = current_enrollment(db, student)
    if enrollment is None:
        return []
    section = db.get(ClassSection, enrollment.class_section_id)
    if section is None:
        return []
    since = _today() - timedelta(days=STUDENT_WINDOW_DAYS)
    rows = (
        db.query(WorkUpdate)
        .filter(
            WorkUpdate.school_id == section.school_id,
            WorkUpdate.grade_id == section.grade_id,
            WorkUpdate.work_date >= since,
        )
        .order_by(WorkUpdate.created_at.desc())
        .all()
    )
    if not rows:
        return []
    ids = [r.id for r in rows]
    counts: dict[uuid.UUID, dict[str, int]] = {}
    mine: dict[uuid.UUID, str] = {}
    for rx in db.query(WorkUpdateReaction).filter(WorkUpdateReaction.work_update_id.in_(ids)).all():
        counts.setdefault(rx.work_update_id, {"approve": 0, "disapprove": 0})[rx.value] += 1
        if rx.student_id == student.id:
            mine[rx.work_update_id] = rx.value
    names = {
        t.id: t.full_name
        for t in db.query(Teacher.id, Teacher.full_name).filter(Teacher.id.in_({r.teacher_id for r in rows}))
    }
    return [
        WorkUpdateStudentOut(
            id=r.id,
            teacher_name=names.get(r.teacher_id, ""),
            work_date=r.work_date,
            created_at=r.created_at,
            grade_label=r.grade_label,
            subject_name=r.subject_name,
            chapter_title=r.chapter_title,
            activities=r.activities,
            topics=r.topics,
            other_topics=r.other_topics,
            activity_detail=r.activity_detail,
            homework=[HomeworkRef(**h) for h in r.homework],
            approve_count=counts.get(r.id, {}).get("approve", 0),
            disapprove_count=counts.get(r.id, {}).get("disapprove", 0),
            my_reaction=mine.get(r.id),
        )
        for r in rows
    ]


def react(db: Session, student: Student, update_id: uuid.UUID, value: str | None) -> WorkUpdateStudentOut:
    enrollment = current_enrollment(db, student)
    row = db.get(WorkUpdate, update_id)
    section = db.get(ClassSection, enrollment.class_section_id) if enrollment else None
    if row is None or section is None or row.school_id != section.school_id or row.grade_id != section.grade_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work update not found.")

    existing = (
        db.query(WorkUpdateReaction)
        .filter(WorkUpdateReaction.work_update_id == update_id, WorkUpdateReaction.student_id == student.id)
        .first()
    )
    if value is None:
        if existing is not None:
            db.delete(existing)
    elif existing is None:
        db.add(WorkUpdateReaction(work_update_id=update_id, student_id=student.id, value=value))
    else:
        existing.value = value
        existing.updated_at = datetime.now(timezone.utc)
    db.commit()
    return next(u for u in list_for_student(db, student) if u.id == update_id)
