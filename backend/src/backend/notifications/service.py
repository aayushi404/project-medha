"""Notifications: an in-app inbox (always works) plus best-effort FCM push
on top (silently no-ops if Firebase isn't configured -- see push.py).
`notify()` is the fan-out primitive other features' services (homework,
timetable...) call directly rather than going through HTTP, so e.g.
assigning homework and notifying the class happens in one call.

Recipients/senders can be a `teachers` row (admin/principal/teacher) or a
`students` row -- `Notification` carries a nullable column pair for each
(recipient_id/recipient_student_id, sender_id/sender_student_id), exactly
one of each pair set. `DeviceToken` follows the same shape."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.section_access import assert_can_act_on_section
from backend.db.models import DeviceToken, Notification, Student, StudentEnrollment, Teacher
from backend.notifications import push
from backend.notifications.schemas import AnnounceIn, AnnounceOut, DeviceTokenIn, NotificationOut

Actor = Teacher | Student


def _school_id(user: Actor) -> uuid.UUID:
    if user.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return user.school_id


def _recipient_filter(user: Actor):
    return (
        Notification.recipient_student_id == user.id
        if isinstance(user, Student)
        else Notification.recipient_id == user.id
    )


def notify_one(
    db: Session,
    *,
    recipient: Actor,
    sender: Actor | None,
    type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Single-recipient convenience wrapper around `notify()`, for callers
    that already have the resolved recipient (e.g. `approvals/service.py`'s
    approve/reject hook)."""
    notify(db, recipients=[recipient], sender=sender, type=type, title=title, body=body, data=data)


def notify(
    db: Session,
    *,
    recipients: list[Actor],
    sender: Actor | None,
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
    sender_id = sender.id if isinstance(sender, Teacher) else None
    sender_student_id = sender.id if isinstance(sender, Student) else None
    db.add_all(
        [
            Notification(
                recipient_id=r.id if isinstance(r, Teacher) else None,
                recipient_student_id=r.id if isinstance(r, Student) else None,
                sender_id=sender_id,
                sender_student_id=sender_student_id,
                type=type,
                title=title,
                body=body,
                data=data,
            )
            for r in recipients
        ]
    )
    db.commit()

    teacher_ids = [r.id for r in recipients if isinstance(r, Teacher)]
    student_ids = [r.id for r in recipients if isinstance(r, Student)]
    tokens = [
        t.token
        for t in db.query(DeviceToken)
        .filter(
            (DeviceToken.user_id.in_(teacher_ids)) | (DeviceToken.student_id.in_(student_ids))
        )
        .all()
    ]
    dead = push.send_push(tokens, title=title, body=body, data=data)
    if dead:
        db.query(DeviceToken).filter(DeviceToken.token.in_(dead)).delete(synchronize_session=False)
        db.commit()
    return len(recipients)


def announce(db: Session, actor: Actor, payload: AnnounceIn) -> AnnounceOut:
    school_id = _school_id(actor)

    if payload.class_section_id is not None:
        if actor.role != "teacher":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a teacher can announce to a class_section_id.")
        assert_can_act_on_section(db, actor, payload.class_section_id)
        recipients: list[Actor] = (
            db.query(Student)
            .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
            .filter(
                Student.school_id == school_id,
                StudentEnrollment.class_section_id == payload.class_section_id,
                StudentEnrollment.left_on.is_(None),
                Student.approval_status == "approved",
            )
            .all()
        )
        type_ = "teacher_announcement"
    else:
        if actor.role != "principal":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a principal can announce to an audience.")
        if payload.audience == "teachers":
            recipients = (
                db.query(Teacher)
                .filter(
                    Teacher.role == "teacher",
                    Teacher.school_id == school_id,
                    Teacher.approval_status == "approved",
                )
                .all()
            )
        else:
            recipients = (
                db.query(Student)
                .filter(Student.school_id == school_id, Student.approval_status == "approved")
                .all()
            )
        type_ = "principal_announcement"

    count = notify(db, recipients=recipients, sender=actor, type=type_, title=payload.title, body=payload.body)
    return AnnounceOut(recipients=count)


def list_mine(db: Session, user: Actor, *, limit: int = 50) -> list[NotificationOut]:
    rows = (
        db.query(Notification)
        .filter(_recipient_filter(user))
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [NotificationOut.model_validate(r, from_attributes=True) for r in rows]


def unread_count(db: Session, user: Actor) -> int:
    return (
        db.query(func.count(Notification.id))
        .filter(_recipient_filter(user), Notification.read_at.is_(None))
        .scalar()
        or 0
    )


def mark_read(db: Session, user: Actor, notification_id: uuid.UUID) -> None:
    row = db.get(Notification, notification_id)
    is_mine = row is not None and (
        (isinstance(user, Student) and row.recipient_student_id == user.id)
        or (isinstance(user, Teacher) and row.recipient_id == user.id)
    )
    if not is_mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.commit()


def register_device(db: Session, user: Actor, payload: DeviceTokenIn) -> None:
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if existing is not None:
        existing.user_id = user.id if isinstance(user, Teacher) else None
        existing.student_id = user.id if isinstance(user, Student) else None
        existing.platform = payload.platform
        existing.last_seen_at = datetime.now(timezone.utc)
    else:
        db.add(
            DeviceToken(
                user_id=user.id if isinstance(user, Teacher) else None,
                student_id=user.id if isinstance(user, Student) else None,
                token=payload.token,
                platform=payload.platform,
            )
        )
    db.commit()


def unregister_device(db: Session, user: Actor, token: str) -> None:
    if isinstance(user, Student):
        db.query(DeviceToken).filter(
            DeviceToken.token == token, DeviceToken.student_id == user.id
        ).delete()
    else:
        db.query(DeviceToken).filter(
            DeviceToken.token == token, DeviceToken.user_id == user.id
        ).delete()
    db.commit()
