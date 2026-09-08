"""Export a generation to a downloadable file, on demand, in memory.

Only presentation -> .pptx today (wraps the existing `backend.ppt` renderer).
PDF for the text types lands in Phase C. Nothing is written to
`generation_exports` until an object-storage bucket is configured -- until then
every export is rendered fresh on each request, exactly as decks are today.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import Generation, Grade, Subject
from backend.ppt.builder import PPTX_MEDIA_TYPE, render_pptx, slugify_filename
from backend.ppt.schema import DeckParseError, parse_deck

_SUPPORTED = {("presentation", "pptx")}


def render(
    db: Session, generation: Generation, fmt: str
) -> tuple[bytes, str, str]:
    """Returns (data, filename, media_type). 404 if this (type, format) pair
    isn't renderable yet; 422 if the stored content can't be rendered."""
    if (generation.type, fmt) not in _SUPPORTED:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"{fmt.upper()} export isn't available for this content yet.",
        )
    if generation.status != "completed" or not generation.content_json:
        raise HTTPException(status.HTTP_409_CONFLICT, "This generation isn't ready.")

    try:
        deck = parse_deck(generation.content_json)
    except DeckParseError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "These slides can't be rendered. Try generating them again.",
        ) from exc

    grade = db.get(Grade, generation.grade_id) if generation.grade_id else None
    subject = db.get(Subject, generation.subject_id) if generation.subject_id else None
    footer = (
        f"Medha · {grade.label} {subject.name}" if grade and subject else "Medha"
    )
    data = render_pptx(deck, footer=footer)
    return data, f"{slugify_filename(generation.title)}.pptx", PPTX_MEDIA_TYPE
