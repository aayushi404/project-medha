import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.db.models import CurriculumChapter, Grade, LibraryPresentation, Subject
from backend.library.schemas import LibraryPresentationDetail, LibraryPresentationItem
from backend.ppt.builder import render_pptx, slugify_filename
from backend.ppt.schema import DeckParseError, parse_deck

_LIST_LIMIT = 60


def _row_to_item(pres, grade_label, subject_name, chapter_title) -> LibraryPresentationItem:
    return LibraryPresentationItem(
        id=pres.id,
        slug=pres.slug,
        title=pres.title,
        description=pres.description,
        language=pres.language,
        grade_label=grade_label,
        subject_name=subject_name,
        chapter_title=chapter_title,
        slide_count=pres.slide_count,
        updated_at=pres.updated_at,
    )


def list_presentations(
    db: Session,
    *,
    grade_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    chapter_id: uuid.UUID | None = None,
    topic_id: uuid.UUID | None = None,
    language: str | None = None,
    q: str | None = None,
    limit: int | None = None,
) -> list[LibraryPresentationItem]:
    query = (
        db.query(
            LibraryPresentation,
            Grade.label,
            Subject.name,
            CurriculumChapter.title,
        )
        .outerjoin(Grade, LibraryPresentation.grade_id == Grade.id)
        .outerjoin(Subject, LibraryPresentation.subject_id == Subject.id)
        .outerjoin(
            CurriculumChapter, LibraryPresentation.chapter_id == CurriculumChapter.id
        )
        .filter(LibraryPresentation.published.is_(True))
    )
    if grade_id is not None:
        query = query.filter(LibraryPresentation.grade_id == grade_id)
    if subject_id is not None:
        query = query.filter(LibraryPresentation.subject_id == subject_id)
    if chapter_id is not None:
        query = query.filter(LibraryPresentation.chapter_id == chapter_id)
    if topic_id is not None:
        query = query.filter(LibraryPresentation.topic_id == topic_id)
    if language:
        query = query.filter(LibraryPresentation.language == language)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                LibraryPresentation.title.ilike(like),
                LibraryPresentation.description.ilike(like),
            )
        )

    query = query.order_by(LibraryPresentation.updated_at.desc())
    query = query.limit(min(limit or _LIST_LIMIT, _LIST_LIMIT))
    return [_row_to_item(pres, g, s, c) for pres, g, s, c in query.all()]


def _load_published(db: Session, pres_id: uuid.UUID) -> LibraryPresentation:
    pres = db.get(LibraryPresentation, pres_id)
    if pres is None or not pres.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    return pres


def get_presentation(db: Session, pres_id: uuid.UUID) -> LibraryPresentationDetail:
    pres = _load_published(db, pres_id)
    grade = db.get(Grade, pres.grade_id) if pres.grade_id else None
    subject = db.get(Subject, pres.subject_id) if pres.subject_id else None
    chapter = (
        db.get(CurriculumChapter, pres.chapter_id) if pres.chapter_id else None
    )
    return LibraryPresentationDetail(
        id=pres.id,
        slug=pres.slug,
        title=pres.title,
        description=pres.description,
        language=pres.language,
        grade_label=grade.label if grade else None,
        subject_name=subject.name if subject else None,
        chapter_title=chapter.title if chapter else None,
        slide_count=pres.slide_count,
        updated_at=pres.updated_at,
        tags=pres.tags,
        spec=pres.spec_json,
    )


def render_presentation_ppt(db: Session, pres_id: uuid.UUID) -> tuple[bytes, str]:
    pres = _load_published(db, pres_id)
    try:
        deck = parse_deck(pres.spec_json)
    except DeckParseError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "These slides can't be rendered.",
        ) from exc

    grade = db.get(Grade, pres.grade_id) if pres.grade_id else None
    subject = db.get(Subject, pres.subject_id) if pres.subject_id else None
    if grade and subject:
        footer = f"Medha · {grade.label} {subject.name}"
    else:
        footer = "Medha"
    data = render_pptx(deck, footer=footer)
    return data, slugify_filename(pres.title)
