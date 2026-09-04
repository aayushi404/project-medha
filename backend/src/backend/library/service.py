"""E-library: a curated list of links (a hosted PDF, a video, an external
page) -- deliberately not a file-storage system. A row with `school_id`
null is visible to every school (a state-wide resource, admin/seed-only
for now); teachers/principals can only add rows scoped to their own
school."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.db.models import Grade, LibraryItem, Subject, Teacher
from backend.library.schemas import LibraryItemIn, LibraryItemOut


def list_items(
    db: Session, user: Teacher, *, grade_id: uuid.UUID | None, subject_id: uuid.UUID | None
) -> list[LibraryItemOut]:
    q = (
        db.query(LibraryItem, Grade.label, Subject.name)
        .outerjoin(Grade, LibraryItem.grade_id == Grade.id)
        .outerjoin(Subject, LibraryItem.subject_id == Subject.id)
        .filter(or_(LibraryItem.school_id.is_(None), LibraryItem.school_id == user.school_id))
    )
    if grade_id is not None:
        q = q.filter(or_(LibraryItem.grade_id.is_(None), LibraryItem.grade_id == grade_id))
    if subject_id is not None:
        q = q.filter(or_(LibraryItem.subject_id.is_(None), LibraryItem.subject_id == subject_id))
    rows = q.order_by(LibraryItem.created_at.desc()).all()
    return [
        LibraryItemOut(
            id=i.id, title=i.title, description=i.description, url=i.url,
            grade_label=g, subject_name=s, created_at=i.created_at,
        )
        for i, g, s in rows
    ]


def add_item(db: Session, user: Teacher, payload: LibraryItemIn) -> LibraryItemOut:
    if user.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    item = LibraryItem(
        school_id=user.school_id,
        grade_id=payload.grade_id,
        subject_id=payload.subject_id,
        title=payload.title,
        description=payload.description,
        url=payload.url,
        added_by=user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    grade = db.get(Grade, payload.grade_id) if payload.grade_id else None
    subject = db.get(Subject, payload.subject_id) if payload.subject_id else None
    return LibraryItemOut(
        id=item.id, title=item.title, description=item.description, url=item.url,
        grade_label=grade.label if grade else None,
        subject_name=subject.name if subject else None,
        created_at=item.created_at,
    )


def delete_item(db: Session, user: Teacher, item_id: uuid.UUID) -> None:
    item = db.get(LibraryItem, item_id)
    if item is None or (item.school_id != user.school_id and user.role != "admin"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found.")
    db.delete(item)
    db.commit()
