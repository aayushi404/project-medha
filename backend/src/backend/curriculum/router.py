import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.curriculum import service
from backend.curriculum.schemas import ChapterOut, TopicOut
from backend.db.models import CurriculumChapter, CurriculumTopic
from backend.db.session import get_db

# Public board reference data (like /reference/*) -- no auth. The dashboard's
# chapter/topic selectors need this before any session exists.
router = APIRouter(tags=["curriculum"])


@router.get("/curriculum/chapters", response_model=list[ChapterOut])
def list_chapters(
    grade_id: uuid.UUID = Query(...),
    subject_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
) -> list[CurriculumChapter]:
    return service.list_chapters(db, grade_id, subject_id)


@router.get("/curriculum/topics", response_model=list[TopicOut])
def list_topics(
    chapter_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
) -> list[CurriculumTopic]:
    return service.list_topics(db, chapter_id)
