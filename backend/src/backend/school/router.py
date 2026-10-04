from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_actor, require_principal
from backend.core.uploads import read_limited, require_kind
from backend.db.models import Student, Teacher
from backend.db.session import get_db
from backend.school import service
from backend.school.schemas import SchoolCardOut, SchoolNameIn

router = APIRouter(tags=["school"])

_MAX_LOGO_BYTES = 2 * 1024 * 1024
_ALLOWED_LOGO_KINDS = {"jpeg", "png", "webp"}


@router.get("/school", response_model=SchoolCardOut)
def get_school_card(
    actor: Teacher | Student = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> SchoolCardOut:
    """The school card for any signed-in role: name, logo, current year."""
    return service.school_card(db, actor)


@router.patch("/principal/school", response_model=SchoolCardOut)
def rename_school(
    payload: SchoolNameIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> SchoolCardOut:
    return service.rename_school(db, principal, payload.name)


@router.post("/principal/school/logo", response_model=SchoolCardOut)
async def upload_school_logo(
    file: UploadFile,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> SchoolCardOut:
    data = await read_limited(file, _MAX_LOGO_BYTES)
    require_kind(data, _ALLOWED_LOGO_KINDS, "Please upload a JPEG, PNG or WebP image.")
    return service.set_logo(db, principal, data)


@router.delete("/principal/school/logo", response_model=SchoolCardOut)
def remove_school_logo(
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> SchoolCardOut:
    return service.clear_logo(db, principal)
