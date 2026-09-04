import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user, require_role
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.library import service
from backend.library.schemas import LibraryItemIn, LibraryItemOut

router = APIRouter(prefix="/library", tags=["library"])

require_librarian = require_role("teacher", "principal")


@router.get("", response_model=list[LibraryItemOut])
def list_library(
    grade_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    user: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LibraryItemOut]:
    return service.list_items(db, user, grade_id=grade_id, subject_id=subject_id)


@router.post("", response_model=LibraryItemOut)
def add_library_item(
    payload: LibraryItemIn, user: Teacher = Depends(require_librarian), db: Session = Depends(get_db)
) -> LibraryItemOut:
    return service.add_item(db, user, payload)


@router.delete("/{item_id}", status_code=204)
def delete_library_item(
    item_id: uuid.UUID, user: Teacher = Depends(require_librarian), db: Session = Depends(get_db)
) -> None:
    service.delete_item(db, user, item_id)
