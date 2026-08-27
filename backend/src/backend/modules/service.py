import uuid

from sqlalchemy.orm import Session

from backend.core.ownership import assert_owned
from backend.db.models import (
    CurriculumTopic,
    Grade,
    Module,
    ModuleArtifact,
    ModuleFeedback,
    Subject,
    Teacher,
)
from backend.modules.schemas import (
    ArtifactOut,
    FeedbackIn,
    FeedbackOut,
    ModuleDetailOut,
    ModuleListItem,
)

# canonical display order for artifact types
_ARTIFACT_ORDER = {"explanation": 0, "quiz": 1, "activity": 2}


def _order_key(artifact_type: str) -> int:
    return _ARTIFACT_ORDER.get(artifact_type, 99)


def list_modules(
    db: Session,
    teacher: Teacher,
    grade_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
) -> list[ModuleListItem]:
    query = (
        db.query(Module, Grade.label, Subject.name)
        .join(Grade, Module.grade_id == Grade.id)
        .join(Subject, Module.subject_id == Subject.id)
        .filter(Module.teacher_id == teacher.id)
    )
    if grade_id is not None:
        query = query.filter(Module.grade_id == grade_id)
    if subject_id is not None:
        query = query.filter(Module.subject_id == subject_id)
    rows = query.order_by(Module.updated_at.desc()).all()
    if not rows:
        return []

    module_ids = [m.id for m, _, _ in rows]
    types_by_module: dict[uuid.UUID, set[str]] = {}
    for mid, atype in (
        db.query(ModuleArtifact.module_id, ModuleArtifact.artifact_type)
        .filter(ModuleArtifact.module_id.in_(module_ids))
        .distinct()
        .all()
    ):
        types_by_module.setdefault(mid, set()).add(atype)

    return [
        ModuleListItem(
            id=m.id,
            title=m.title,
            grade_id=m.grade_id,
            grade_label=grade_label,
            subject_id=m.subject_id,
            subject_name=subject_name,
            topic_id=m.topic_id,
            artifact_types=sorted(types_by_module.get(m.id, set()), key=_order_key),
            updated_at=m.updated_at,
        )
        for m, grade_label, subject_name in rows
    ]


def _load_owned_module(db: Session, teacher: Teacher, module_id: uuid.UUID) -> Module:
    module = db.get(Module, module_id)
    assert_owned(teacher.id, module)
    return module


def get_module_detail(db: Session, teacher: Teacher, module_id: uuid.UUID) -> ModuleDetailOut:
    module = _load_owned_module(db, teacher, module_id)
    grade = db.get(Grade, module.grade_id)
    subject = db.get(Subject, module.subject_id)
    topic_title = None
    if module.topic_id is not None:
        topic = db.get(CurriculumTopic, module.topic_id)
        topic_title = topic.title if topic is not None else None

    artifacts = (
        db.query(ModuleArtifact).filter(ModuleArtifact.module_id == module.id).all()
    )
    artifacts.sort(key=lambda a: _order_key(a.artifact_type))

    feedback = (
        db.query(ModuleFeedback)
        .filter(
            ModuleFeedback.module_id == module.id,
            ModuleFeedback.teacher_id == teacher.id,
        )
        .first()
    )

    return ModuleDetailOut(
        id=module.id,
        title=module.title,
        grade_label=grade.label,
        subject_name=subject.name,
        topic_title=topic_title,
        session_id=module.session_id,
        created_at=module.created_at,
        updated_at=module.updated_at,
        artifacts=[ArtifactOut.model_validate(a) for a in artifacts],
        feedback=FeedbackOut.model_validate(feedback) if feedback is not None else None,
    )


def delete_module(db: Session, teacher: Teacher, module_id: uuid.UUID) -> None:
    module = _load_owned_module(db, teacher, module_id)
    db.delete(module)  # cascades to module_artifacts + module_feedback
    db.commit()


def upsert_feedback(
    db: Session, teacher: Teacher, module_id: uuid.UUID, payload: FeedbackIn
) -> ModuleFeedback:
    module = _load_owned_module(db, teacher, module_id)
    feedback = (
        db.query(ModuleFeedback)
        .filter(
            ModuleFeedback.module_id == module.id,
            ModuleFeedback.teacher_id == teacher.id,
        )
        .first()
    )
    if feedback is None:
        feedback = ModuleFeedback(
            module_id=module.id,
            teacher_id=teacher.id,
            rating=payload.rating,
            comment=payload.comment,
        )
        db.add(feedback)
    else:
        feedback.rating = payload.rating
        feedback.comment = payload.comment
    db.commit()
    db.refresh(feedback)
    return feedback
