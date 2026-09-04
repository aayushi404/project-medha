"""Chapter notes: one teacher/principal-curated revision note per
(chapter, school) -- `school_id` null rows are a state-wide fallback. A
viewer's own school's note wins over the state-wide one when both exist."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import ChapterNote, Teacher
from backend.notes.schemas import ChapterNoteIn, ChapterNoteOut


def _out(row: ChapterNote) -> ChapterNoteOut:
    return ChapterNoteOut(
        id=row.id,
        chapter_id=row.chapter_id,
        summary=row.summary,
        key_points=row.key_points or [],
        important_terms=row.important_terms or [],
        updated_at=row.updated_at,
    )


def get_note(db: Session, user: Teacher, chapter_id: uuid.UUID) -> ChapterNoteOut | None:
    own = (
        db.query(ChapterNote)
        .filter(ChapterNote.chapter_id == chapter_id, ChapterNote.school_id == user.school_id)
        .first()
    )
    if own is not None:
        return _out(own)
    global_note = (
        db.query(ChapterNote)
        .filter(ChapterNote.chapter_id == chapter_id, ChapterNote.school_id.is_(None))
        .first()
    )
    return _out(global_note) if global_note is not None else None


def upsert_note(db: Session, user: Teacher, payload: ChapterNoteIn) -> ChapterNoteOut:
    if user.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    row = (
        db.query(ChapterNote)
        .filter(ChapterNote.chapter_id == payload.chapter_id, ChapterNote.school_id == user.school_id)
        .first()
    )
    if row is None:
        row = ChapterNote(chapter_id=payload.chapter_id, school_id=user.school_id, created_by=user.id, summary="")
        db.add(row)
    row.summary = payload.summary
    row.key_points = payload.key_points
    row.important_terms = payload.important_terms
    row.created_by = user.id
    db.commit()
    db.refresh(row)
    return _out(row)


def delete_note(db: Session, user: Teacher, note_id: uuid.UUID) -> None:
    row = db.get(ChapterNote, note_id)
    if row is None or (row.school_id != user.school_id and user.role != "admin"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
    db.delete(row)
    db.commit()
