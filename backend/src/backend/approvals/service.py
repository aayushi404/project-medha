"""Shared approve / reject transaction used by both the admin (approves
principals) and principal (approves teachers) endpoints.

Each decision is one transaction: flip `approval_status`, stamp the actor and
time, and append an `approval_events` row so there's a permanent record of who
admitted or turned away whom.
"""
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.db.models import ApprovalEvent, AuthSession, Teacher
from backend.notifications import service as notifications

logger = logging.getLogger("backend.approvals")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _notify_decision(db: Session, *, actor: Teacher, subject: Teacher, approved: bool, reason: str | None) -> None:
    title = "आपका रजिस्ट्रेशन स्वीकृत हो गया" if approved else "रजिस्ट्रेशन अस्वीकृत"
    body = (
        "बधाई हो! अब आप मेधा में लॉग इन कर सकते हैं।"
        if approved
        else f"कारण: {reason}" if reason else "कोई कारण नहीं दिया गया।"
    )
    # best-effort: never let a notification failure undo an already-committed
    # approval decision.
    try:
        notifications.notify_one(
            db,
            recipient_id=subject.id,
            sender_id=actor.id,
            type="approval_approved" if approved else "approval_rejected",
            title=title,
            body=body,
        )
    except Exception:
        logger.warning("approval_notification_failed", exc_info=True)


def approve(db: Session, *, actor: Teacher, subject: Teacher) -> Teacher:
    if subject.approval_status == "approved":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This account is already approved."
        )

    subject.approval_status = "approved"
    subject.approved_by = actor.id
    subject.approved_at = _now()
    subject.rejection_reason = None
    db.add(
        ApprovalEvent(
            subject_user_id=subject.id, actor_user_id=actor.id, action="approved"
        )
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # idx_one_approved_principal_per_school -- a school can have only one
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This school already has an approved principal.",
        ) from exc
    db.refresh(subject)
    _notify_decision(db, actor=actor, subject=subject, approved=True, reason=None)
    return subject


def reject(db: Session, *, actor: Teacher, subject: Teacher, reason: str) -> Teacher:
    if subject.approval_status == "rejected":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This account is already rejected."
        )

    subject.approval_status = "rejected"
    subject.rejection_reason = reason
    subject.approved_by = None
    subject.approved_at = None
    db.add(
        ApprovalEvent(
            subject_user_id=subject.id,
            actor_user_id=actor.id,
            action="rejected",
            reason=reason,
        )
    )
    # a rejected account must not keep a live session
    db.query(AuthSession).filter(
        AuthSession.teacher_id == subject.id, AuthSession.revoked_at.is_(None)
    ).update({AuthSession.revoked_at: _now()}, synchronize_session=False)
    db.commit()
    db.refresh(subject)
    _notify_decision(db, actor=actor, subject=subject, approved=False, reason=reason)
    return subject
