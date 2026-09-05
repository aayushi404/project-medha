"""Non-streaming generation operations: scope resolution, History list (with a
transitional read of pre-v2 `module_artifacts`), detail, favourite/rename,
delete, feedback. The streaming path is `backend.generation.pipeline`.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.core.ownership import assert_owned
from backend.db.models import (
    CurriculumChapter,
    CurriculumTopic,
    Generation,
    GenerationExport,
    GenerationFeedback,
    Grade,
    Module,
    ModuleArtifact,
    Subject,
    Teacher,
)
from backend.generation.schemas import (
    ExportOut,
    FeedbackIn,
    FeedbackOut,
    GenerationDetailOut,
    GenerationListItem,
    GenerationPatchIn,
    ScopeIn,
)

# pre-v2 module_artifacts.artifact_type -> v2 generation type (transitional read)
_LEGACY_TYPE_MAP = {
    "explanation": "notes",
    "quiz": "quiz",
    "activity": "lesson_plan",
    "ppt": "presentation",
}


@dataclass
class ResolvedScope:
    grade_id: uuid.UUID
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None
    topic_id: uuid.UUID | None
    grade_label: str
    subject_name: str
    chapter_title: str | None
    topic_title: str | None
    topic_description: str | None


def resolve_scope(db: Session, scope: ScopeIn) -> ResolvedScope:
    grade = db.get(Grade, scope.grade_id)
    if grade is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid grade.")
    subject = db.get(Subject, scope.subject_id)
    if subject is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid subject.")

    chapter = None
    if scope.chapter_id is not None:
        chapter = db.get(CurriculumChapter, scope.chapter_id)
        if (
            chapter is None
            or chapter.grade_id != scope.grade_id
            or chapter.subject_id != scope.subject_id
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Chapter does not match the selected class and subject.",
            )

    topic = None
    if scope.topic_id is not None:
        if scope.chapter_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "chapter_id is required when topic_id is given."
            )
        topic = db.get(CurriculumTopic, scope.topic_id)
        if topic is None or topic.chapter_id != scope.chapter_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Topic does not belong to the selected chapter."
            )

    return ResolvedScope(
        grade_id=scope.grade_id,
        subject_id=scope.subject_id,
        chapter_id=scope.chapter_id,
        topic_id=scope.topic_id,
        grade_label=grade.label,
        subject_name=subject.name,
        chapter_title=chapter.title if chapter else None,
        topic_title=topic.title if topic else None,
        topic_description=topic.description if topic else None,
    )


# ---------------------------------------------------------------- history list


def list_history(
    db: Session,
    teacher: Teacher,
    *,
    gen_type: str | None = None,
    favorite: bool = False,
    q: str | None = None,
    limit: int = 30,
    cursor: datetime | None = None,
    sort: str = "date",
) -> list[GenerationListItem]:
    query = (
        db.query(Generation, Grade.label, Subject.name, CurriculumChapter.title)
        .outerjoin(Grade, Generation.grade_id == Grade.id)
        .outerjoin(Subject, Generation.subject_id == Subject.id)
        .outerjoin(CurriculumChapter, Generation.chapter_id == CurriculumChapter.id)
        .filter(Generation.teacher_id == teacher.id)
    )
    if gen_type:
        query = query.filter(Generation.type == gen_type)
    if favorite:
        query = query.filter(Generation.is_favorite.is_(True))
    if q:
        query = query.filter(Generation.title.ilike(f"%{q.strip()}%"))
    # Cursor pagination is date-keyed; title-sort mode is a single page
    # (History's title sort is a small-list convenience, not built to page).
    if cursor is not None and sort != "title":
        query = query.filter(Generation.created_at < cursor)

    order = Generation.title.asc() if sort == "title" else Generation.created_at.desc()
    rows = query.order_by(order).limit(limit).all()
    items = [
        GenerationListItem(
            id=str(g.id),
            type=g.type,
            title=g.title,
            status=g.status,
            source=g.source,
            is_favorite=g.is_favorite,
            grade_label=grade_label,
            subject_name=subject_name,
            chapter_title=chapter_title,
            created_at=g.created_at,
        )
        for g, grade_label, subject_name, chapter_title in rows
    ]

    # Transitional: fold in pre-v2 module_artifacts on the first page so a
    # returning teacher's History isn't empty before the 0011 backfill. Flip
    # `generation_legacy_read` off in the deploy that runs 0011; drop this then.
    if settings.generation_legacy_read and cursor is None and not favorite:
        items.extend(_legacy_history(db, teacher, gen_type=gen_type, q=q))
        if sort == "title":
            items.sort(key=lambda it: it.title.lower())
        else:
            items.sort(key=lambda it: it.created_at, reverse=True)
        items = items[:limit]
    return items


def _legacy_history(
    db: Session, teacher: Teacher, *, gen_type: str | None, q: str | None
) -> list[GenerationListItem]:
    rows = (
        db.query(ModuleArtifact, Module, Grade.label, Subject.name, CurriculumChapter.title)
        .join(Module, ModuleArtifact.module_id == Module.id)
        .outerjoin(Grade, Module.grade_id == Grade.id)
        .outerjoin(Subject, Module.subject_id == Subject.id)
        .outerjoin(CurriculumChapter, Module.chapter_id == CurriculumChapter.id)
        .filter(Module.teacher_id == teacher.id)
        .order_by(ModuleArtifact.created_at.desc())
        .limit(50)
        .all()
    )
    out: list[GenerationListItem] = []
    for art, module, grade_label, subject_name, chapter_title in rows:
        mapped = _LEGACY_TYPE_MAP.get(art.artifact_type)
        if mapped is None or (gen_type and mapped != gen_type):
            continue
        if q and q.strip().lower() not in (module.title or "").lower():
            continue
        out.append(
            GenerationListItem(
                id=f"legacy:{art.id}",
                type=mapped,
                title=module.title,
                status="completed",
                source="chat",
                is_favorite=False,
                grade_label=grade_label,
                subject_name=subject_name,
                chapter_title=chapter_title,
                created_at=art.created_at,
                legacy=True,
                module_id=module.id,
            )
        )
    return out


# --------------------------------------------------------------------- detail


def _load_owned(db: Session, teacher: Teacher, generation_id: uuid.UUID) -> Generation:
    row = db.get(Generation, generation_id)
    assert_owned(teacher.id, row)
    return row


def get_generation(
    db: Session, teacher: Teacher, generation_id: uuid.UUID
) -> GenerationDetailOut:
    g = _load_owned(db, teacher, generation_id)
    grade = db.get(Grade, g.grade_id) if g.grade_id else None
    subject = db.get(Subject, g.subject_id) if g.subject_id else None
    chapter = db.get(CurriculumChapter, g.chapter_id) if g.chapter_id else None

    feedback = (
        db.query(GenerationFeedback)
        .filter(
            GenerationFeedback.generation_id == g.id,
            GenerationFeedback.teacher_id == teacher.id,
        )
        .first()
    )
    exports = db.query(GenerationExport).filter(GenerationExport.generation_id == g.id).all()

    return GenerationDetailOut(
        id=g.id,
        type=g.type,
        title=g.title,
        description=g.description,
        language=g.language,
        status=g.status,
        source=g.source,
        is_favorite=g.is_favorite,
        grade_id=g.grade_id,
        subject_id=g.subject_id,
        chapter_id=g.chapter_id,
        topic_id=g.topic_id,
        grade_label=grade.label if grade else None,
        subject_name=subject.name if subject else None,
        chapter_title=chapter.title if chapter else None,
        input_params=g.input_params,
        content_json=g.content_json,
        error_message=g.error_message,
        session_id=g.session_id,
        parent_generation_id=g.parent_generation_id,
        prompt_version=g.prompt_version,
        created_at=g.created_at,
        updated_at=g.updated_at,
        feedback=FeedbackOut.model_validate(feedback) if feedback else None,
        exports=[
            ExportOut(format=e.format, status=e.status, ready=e.status == "completed")
            for e in exports
        ],
    )


def patch_generation(
    db: Session, teacher: Teacher, generation_id: uuid.UUID, patch: GenerationPatchIn
) -> GenerationDetailOut:
    g = _load_owned(db, teacher, generation_id)
    if patch.is_favorite is not None:
        g.is_favorite = patch.is_favorite
    if patch.title is not None:
        g.title = patch.title
    db.commit()
    return get_generation(db, teacher, generation_id)


def delete_generation(db: Session, teacher: Teacher, generation_id: uuid.UUID) -> None:
    g = _load_owned(db, teacher, generation_id)
    db.delete(g)  # cascades to generation_exports + generation_feedback
    db.commit()


def upsert_feedback(
    db: Session, teacher: Teacher, generation_id: uuid.UUID, payload: FeedbackIn
) -> GenerationFeedback:
    _load_owned(db, teacher, generation_id)
    fb = (
        db.query(GenerationFeedback)
        .filter(
            GenerationFeedback.generation_id == generation_id,
            GenerationFeedback.teacher_id == teacher.id,
        )
        .first()
    )
    if fb is None:
        fb = GenerationFeedback(
            generation_id=generation_id,
            teacher_id=teacher.id,
            rating=payload.rating,
            comment=payload.comment,
        )
        db.add(fb)
    else:
        fb.rating = payload.rating
        fb.comment = payload.comment
    db.commit()
    db.refresh(fb)
    return fb
