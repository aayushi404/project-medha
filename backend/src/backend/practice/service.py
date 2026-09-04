"""Practice questions: a teacher/principal-curated question bank per
chapter -- deliberately not AI-generated and not the private `modules/`
quiz artifacts (those stay teacher-private). `school_id` null = a
state-wide question, visible everywhere; set = only that school's own."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.db.models import PracticeQuestion, Teacher
from backend.practice.schemas import PracticeQuestionIn, PracticeQuestionOut


def list_questions(db: Session, user: Teacher, chapter_id: uuid.UUID) -> list[PracticeQuestionOut]:
    rows = (
        db.query(PracticeQuestion)
        .filter(
            PracticeQuestion.chapter_id == chapter_id,
            or_(PracticeQuestion.school_id.is_(None), PracticeQuestion.school_id == user.school_id),
        )
        .order_by(PracticeQuestion.created_at)
        .all()
    )
    return [
        PracticeQuestionOut(
            id=q.id, chapter_id=q.chapter_id, question=q.question, type=q.type,
            options=q.options, answer=q.answer, difficulty=q.difficulty, created_at=q.created_at,
        )
        for q in rows
    ]


def add_question(db: Session, user: Teacher, payload: PracticeQuestionIn) -> PracticeQuestionOut:
    if user.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    row = PracticeQuestion(
        chapter_id=payload.chapter_id,
        school_id=user.school_id,
        question=payload.question,
        type=payload.type,
        options=payload.options,
        answer=payload.answer,
        difficulty=payload.difficulty,
        created_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return PracticeQuestionOut(
        id=row.id, chapter_id=row.chapter_id, question=row.question, type=row.type,
        options=row.options, answer=row.answer, difficulty=row.difficulty, created_at=row.created_at,
    )


def delete_question(db: Session, user: Teacher, question_id: uuid.UUID) -> None:
    row = db.get(PracticeQuestion, question_id)
    if row is None or (row.school_id != user.school_id and user.role != "admin"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found.")
    db.delete(row)
    db.commit()
