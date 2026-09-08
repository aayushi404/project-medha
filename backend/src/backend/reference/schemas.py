import uuid

from pydantic import BaseModel, ConfigDict


class GradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    numeric_level: int


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    board: str


class SchoolSearchResult(BaseModel):
    id: uuid.UUID
    name: str
    district_name: str
    block_name: str | None = None
    udise_code: str | None = None
