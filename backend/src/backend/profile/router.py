from typing import Union

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user
from backend.core.images import delete_avatar, upload_avatar
from backend.core.uploads import read_limited, require_kind
from backend.db.models import Student, Teacher
from backend.db.session import get_db
from backend.profile import service
from backend.profile.schemas import (
    ProfileOut,
    ProfileUpdateIn,
    StudentSelfProfileOut,
    StudentSelfProfileUpdateIn,
)

router = APIRouter(tags=["profile"])

_MAX_PHOTO_BYTES = 5 * 1024 * 1024
_ALLOWED_PHOTO_KINDS = {"jpeg", "png", "webp"}


@router.get("/profile", response_model=Union[ProfileOut, StudentSelfProfileOut])
def get_profile(
    current_user: Teacher | Student = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut | StudentSelfProfileOut:
    if isinstance(current_user, Student):
        return service.get_student_self_profile(current_user)
    return service.get_profile(db, current_user)


@router.patch("/profile", response_model=Union[ProfileOut, StudentSelfProfileOut])
def update_profile(
    payload: ProfileUpdateIn,
    current_user: Teacher | Student = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut | StudentSelfProfileOut:
    # `ProfileUpdateIn` is a superset (it's the only shape with `subjects`);
    # a student actor only ever exercises `full_name`/`preferred_language`,
    # so any `subjects` they send is silently ignored rather than erroring.
    if isinstance(current_user, Student):
        return service.update_student_self_profile(
            db,
            current_user,
            StudentSelfProfileUpdateIn(
                full_name=payload.full_name, preferred_language=payload.preferred_language
            ),
        )
    return service.update_profile(db, current_user, payload)


@router.post("/profile/photo", response_model=Union[ProfileOut, StudentSelfProfileOut])
async def upload_profile_photo(
    file: UploadFile,
    current_user: Teacher | Student = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut | StudentSelfProfileOut:
    data = await read_limited(file, _MAX_PHOTO_BYTES)
    require_kind(data, _ALLOWED_PHOTO_KINDS, "Please upload a JPEG, PNG or WebP image.")

    kind = "student" if isinstance(current_user, Student) else "teacher"
    photo_url = upload_avatar(data, kind, current_user.id)
    service.set_photo(db, current_user, photo_url)

    if isinstance(current_user, Student):
        return service.get_student_self_profile(current_user)
    return service.get_profile(db, current_user)


@router.delete("/profile/photo", response_model=Union[ProfileOut, StudentSelfProfileOut])
def delete_profile_photo(
    current_user: Teacher | Student = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut | StudentSelfProfileOut:
    kind = "student" if isinstance(current_user, Student) else "teacher"
    delete_avatar(kind, current_user.id)
    service.clear_photo(db, current_user)

    if isinstance(current_user, Student):
        return service.get_student_self_profile(current_user)
    return service.get_profile(db, current_user)
