import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from backend.core.rate_limits import by_actor, by_ip
from backend.auth.dependencies import get_current_user
from backend.db.models import Student, Teacher
from backend.db.session import get_db
from backend.notifications import service
from backend.notifications.schemas import (
    AnnounceIn,
    AnnounceOut,
    DeviceTokenIn,
    NotificationOut,
    UnreadCountOut,
)

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[NotificationOut])
def list_mine(
    user: Teacher | Student = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[NotificationOut]:
    return service.list_mine(db, user)


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(
    user: Teacher | Student = Depends(get_current_user), db: Session = Depends(get_db)
) -> UnreadCountOut:
    return UnreadCountOut(count=service.unread_count(db, user))


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    notification_id: uuid.UUID,
    user: Teacher | Student = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service.mark_read(db, user, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/announce", response_model=AnnounceOut, dependencies=[by_actor("announce", limit=20, window_seconds=3600)])
def announce(
    payload: AnnounceIn, user: Teacher | Student = Depends(get_current_user), db: Session = Depends(get_db)
) -> AnnounceOut:
    return service.announce(db, user, payload)


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    payload: DeviceTokenIn,
    user: Teacher | Student = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service.register_device(db, user, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/devices/{token}", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(
    token: str, user: Teacher | Student = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    service.unregister_device(db, user, token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
