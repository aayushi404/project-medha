import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.library import service
from backend.library.schemas import LibraryPresentationDetail, LibraryPresentationItem
from backend.ppt.builder import PPTX_MEDIA_TYPE

router = APIRouter(prefix="/library", tags=["library"])


@router.get("/presentations", response_model=list[LibraryPresentationItem])
def list_presentations(
    grade_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    chapter_id: uuid.UUID | None = None,
    topic_id: uuid.UUID | None = None,
    language: str | None = None,
    q: str | None = None,
    limit: int | None = None,
    _user: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LibraryPresentationItem]:
    return service.list_presentations(
        db,
        grade_id=grade_id,
        subject_id=subject_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
        language=language,
        q=q,
        limit=limit,
    )


@router.get("/presentations/{pres_id}", response_model=LibraryPresentationDetail)
def get_presentation(
    pres_id: uuid.UUID,
    _user: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LibraryPresentationDetail:
    return service.get_presentation(db, pres_id)


@router.get("/presentations/{pres_id}/pptx")
def download_presentation(
    pres_id: uuid.UUID,
    _user: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    data, slug = service.render_presentation_ppt(db, pres_id)
    return Response(
        content=data,
        media_type=PPTX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{slug}.pptx"'},
    )
