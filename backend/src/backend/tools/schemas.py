from pydantic import BaseModel, Field


class TranslateIn(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    target_language: str = "hi-BiharBoli"  # hi | hi-BiharBoli | en
    mode: str = "translate"  # translate | simplify
    reading_level: str = "class-6"  # class-6 | class-8 | class-10


class TranslateOut(BaseModel):
    result: str
    mode: str
    target_language: str
