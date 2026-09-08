import uuid

from sqlalchemy.orm import Session

from backend.db.models import CurriculumChapter, CurriculumTopic


def list_chapters(
    db: Session, grade_id: uuid.UUID, subject_id: uuid.UUID
) -> list[CurriculumChapter]:
    return (
        db.query(CurriculumChapter)
        .filter(
            CurriculumChapter.grade_id == grade_id,
            CurriculumChapter.subject_id == subject_id,
        )
        .order_by(CurriculumChapter.chapter_number)
        .all()
    )


def list_topics(db: Session, chapter_id: uuid.UUID) -> list[CurriculumTopic]:
    return (
        db.query(CurriculumTopic)
        .filter(CurriculumTopic.chapter_id == chapter_id)
        .order_by(CurriculumTopic.sequence_order)
        .all()
    )
