import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user, require_role
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.notes import service
from backend.notes.schemas import ChapterNoteIn, ChapterNoteOut

router = APIRouter(prefix="/notes", tags=["notes"])

require_note_author = require_role("teacher", "principal")


@router.get("", response_model=ChapterNoteOut | None)
def get_note(
    chapter_id: uuid.UUID, user: Teacher = Depends(get_current_user), db: Session = Depends(get_db)
) -> ChapterNoteOut | None:
    return service.get_note(db, user, chapter_id)


@router.post("", response_model=ChapterNoteOut)
def upsert_note(
    payload: ChapterNoteIn, user: Teacher = Depends(require_note_author), db: Session = Depends(get_db)
) -> ChapterNoteOut:
    return service.upsert_note(db, user, payload)


@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: uuid.UUID, user: Teacher = Depends(require_note_author), db: Session = Depends(get_db)
) -> None:
    service.delete_note(db, user, note_id)
