import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from backend.auth.dependencies import get_current_teacher
from backend.core.ownership import assert_owned
from backend.db.models import Generation, Teacher
from backend.db.session import get_db
from backend.generation import pipeline, render, service
from backend.generation.content import SUPPORTED_TYPES
from backend.generation.rate_limit import generation_rate_limit
from backend.generation.schemas import (
    FeedbackIn,
    FeedbackOut,
    GenerateIn,
    GenerationDetailOut,
    GenerationListItem,
    GenerationPatchIn,
    RegenerateIn,
    ScopeIn,
)

router = APIRouter(tags=["generation"])

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _check_type(gen_type: str) -> str:
    if gen_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Unknown or unsupported generation type: {gen_type}",
        )
    return gen_type


@router.post("/generate/{gen_type}", dependencies=[Depends(generation_rate_limit)])
async def generate(
    gen_type: str,
    payload: GenerateIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    _check_type(gen_type)
    # Resolve scope synchronously so a bad grade/subject/chapter is a clean 400,
    # not an error mid-stream.
    scope = service.resolve_scope(db, payload.scope)
    language = payload.language or current_teacher.preferred_language
    generator = pipeline.run(
        db, current_teacher, gen_type, scope, payload.params, language, source="quick_action"
    )
    return EventSourceResponse(generator, headers=_SSE_HEADERS)


@router.post(
    "/generations/{generation_id}/regenerate",
    dependencies=[Depends(generation_rate_limit)],
)
async def regenerate(
    generation_id: uuid.UUID,
    payload: RegenerateIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    parent = db.get(Generation, generation_id)
    assert_owned(current_teacher.id, parent)
    _check_type(parent.type)

    scope = service.resolve_scope(
        db,
        ScopeIn(
            grade_id=parent.grade_id,
            subject_id=parent.subject_id,
            chapter_id=parent.chapter_id,
            topic_id=parent.topic_id,
        ),
    )
    merged = {**(parent.input_params or {}), **(payload.params or {})}
    language = payload.language or parent.language
    generator = pipeline.run(
        db,
        current_teacher,
        parent.type,
        scope,
        merged,
        language,
        source="regenerate",
        session_id=parent.session_id,
        parent_generation_id=parent.id,
    )
    return EventSourceResponse(generator, headers=_SSE_HEADERS)


@router.get("/generations", response_model=list[GenerationListItem])
def list_generations(
    type: str | None = Query(default=None),
    favorite: bool = Query(default=False),
    q: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    cursor: datetime | None = Query(default=None),
    sort: Literal["date", "title"] = Query(default="date"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> list[GenerationListItem]:
    if type is not None:
        _check_type(type)
    return service.list_history(
        db,
        current_teacher,
        gen_type=type,
        favorite=favorite,
        q=q,
        limit=limit,
        sort=sort,
        cursor=cursor,
    )


@router.get("/generations/{generation_id}", response_model=GenerationDetailOut)
def get_generation(
    generation_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> GenerationDetailOut:
    return service.get_generation(db, current_teacher, generation_id)


@router.patch("/generations/{generation_id}", response_model=GenerationDetailOut)
def patch_generation(
    generation_id: uuid.UUID,
    payload: GenerationPatchIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> GenerationDetailOut:
    return service.patch_generation(db, current_teacher, generation_id, payload)


@router.delete("/generations/{generation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_generation(
    generation_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> None:
    service.delete_generation(db, current_teacher, generation_id)


@router.post("/generations/{generation_id}/feedback", response_model=FeedbackOut)
def send_feedback(
    generation_id: uuid.UUID,
    payload: FeedbackIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> FeedbackOut:
    return service.upsert_feedback(db, current_teacher, generation_id, payload)


@router.get("/generations/{generation_id}/export/{fmt}")
def export_generation(
    generation_id: uuid.UUID,
    fmt: str,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> Response:
    g = db.get(Generation, generation_id)
    assert_owned(current_teacher.id, g)
    data, filename, media_type = render.render(db, g, fmt)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
