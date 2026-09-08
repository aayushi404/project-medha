import re

from pydantic import BaseModel, Field


class PronunciationOut(BaseModel):
    score: int = Field(ge=0, le=100)
    heard: str
    expected: str
    feedback: str
    tips: list[str] = Field(default_factory=list)
