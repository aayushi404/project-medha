from typing import Any

from fastapi import HTTPException, status


def assert_owned(teacher_id: Any, row: Any, attr: str = "teacher_id") -> None:
    """404 (not 403) if `row` is missing or not this teacher's -- don't reveal
    that someone else's id exists. Call this in the service layer for every
    per-teacher resource read/write so ownership can't be forgotten on a new
    endpoint."""
    if row is None or getattr(row, attr) != teacher_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
