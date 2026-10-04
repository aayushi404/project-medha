import re
import uuid

from pydantic import BaseModel, Field, field_validator

# Anything that could break the card or a page built from it: control
# characters, and the markup characters a name never needs.
_BAD_SCHOOL_CHARS = re.compile(r"[\x00-\x1f\x7f<>{}\[\]\\`|;=]")


class AcademicYearRef(BaseModel):
    id: uuid.UUID
    label: str


class SchoolCardOut(BaseModel):
    """What the school card shows. Read by every signed-in role; `can_edit` is
    true only for the principal, so the client never decides edit rights."""

    id: uuid.UUID
    name: str
    district_name: str
    logo_url: str | None
    academic_year: AcademicYearRef | None
    can_edit: bool


class SchoolNameIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)

    @field_validator("name")
    @classmethod
    def _clean(cls, v: str) -> str:
        v = " ".join(v.split())  # trim, and collapse runs of spaces
        if len(v) < 3:
            raise ValueError("School name is too short.")
        if _BAD_SCHOOL_CHARS.search(v):
            raise ValueError("School name contains characters that aren't allowed.")
        if len(re.findall(r"[^\W\d_]", v)) < 3:
            raise ValueError("School name must contain at least three letters.")
        return v
