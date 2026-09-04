"""Notifications: an in-app inbox (always works) plus best-effort FCM push
on top (silently no-ops if Firebase isn't configured -- see push.py).
`notify()` is the fan-out primitive other features' services (homework,
timetable...) call directly rather than going through HTTP, so e.g.
assigning homework and notifying the class happens in one call."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db.models import DeviceToken, Notification, Teacher
from backend.notifications import push
from backend.notifications.schemas import AnnounceIn, AnnounceOut, DeviceTokenIn, NotificationOut


def _school_id(user: Teacher) -> uuid.UUID:
    if user.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return user.school_id


def notify_one(
    db: Session,
    *,
    recipient_id: uuid.UUID,
    sender_id: uuid.UUID | None,
    type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Single-recipient convenience wrapper around `notify()`, for callers
    that already have just an id (e.g. `approvals/service.py`'s
    approve/reject hook)."""
    recipient = db.get(Teacher, recipient_id)
    if recipient is None:
        return
    notify(db, recipients=[recipient], sender_id=sender_id, type=type, title=title, body=body, data=data)


def notify(
    db: Session,
    *,
    recipients: list[Teacher],
    sender_id: uuid.UUID | None,
    type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    """Fans one notification out to each recipient: an in-app row per
    person plus a best-effort push to any registered device. Returns the
    recipient count."""
    if not recipients:
        return 0
    recipient_ids = [r.id for r in recipients]
    db.add_all(
        [
            Notification(recipient_id=rid, sender_id=sender_id, type=type, title=title, body=body, data=data)
            for rid in recipient_ids
        ]
    )
    db.commit()

    tokens = [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(recipient_ids)).all()]
    dead = push.send_push(tokens, title=title, body=body, data=data)
    if dead:
        db.query(DeviceToken).filter(DeviceToken.token.in_(dead)).delete(synchronize_session=False)
        db.commit()
    return len(recipient_ids)


def announce(db: Session, actor: Teacher, payload: AnnounceIn) -> AnnounceOut:
    school_id = _school_id(actor)

    if payload.grade_id is not None:
        if actor.role != "teacher":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a teacher can announce to a grade_id.")
        recipients = (
            db.query(Teacher)
            .filter(
                Teacher.role == "student",
                Teacher.school_id == school_id,
                Teacher.grade_id == payload.grade_id,
                Teacher.approval_status == "approved",
            )
            .all()
        )
        type_ = "teacher_announcement"
    else:
        if actor.role != "principal":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a principal can announce to an audience.")
        role = "teacher" if payload.audience == "teachers" else "student"
        recipients = (
            db.query(Teacher)
            .filter(Teacher.role == role, Teacher.school_id == school_id, Teacher.approval_status == "approved")
            .all()
        )
        type_ = "principal_announcement"

    count = notify(db, recipients=recipients, sender_id=actor.id, type=type_, title=payload.title, body=payload.body)
    return AnnounceOut(recipients=count)


def list_mine(db: Session, user: Teacher, *, limit: int = 50) -> list[NotificationOut]:
    rows = (
        db.query(Notification)
        .filter(Notification.recipient_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [NotificationOut.model_validate(r, from_attributes=True) for r in rows]


def unread_count(db: Session, user: Teacher) -> int:
    return (
        db.query(func.count(Notification.id))
        .filter(Notification.recipient_id == user.id, Notification.read_at.is_(None))
        .scalar()
        or 0
    )


def mark_read(db: Session, user: Teacher, notification_id: uuid.UUID) -> None:
    row = db.get(Notification, notification_id)
    if row is None or row.recipient_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.commit()


def register_device(db: Session, user: Teacher, payload: DeviceTokenIn) -> None:
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if existing is not None:
        existing.user_id = user.id
        existing.platform = payload.platform
        existing.last_seen_at = datetime.now(timezone.utc)
    else:
        db.add(DeviceToken(user_id=user.id, token=payload.token, platform=payload.platform))
    db.commit()


def unregister_device(db: Session, user: Teacher, token: str) -> None:
    db.query(DeviceToken).filter(DeviceToken.token == token, DeviceToken.user_id == user.id).delete()
    db.commit()
