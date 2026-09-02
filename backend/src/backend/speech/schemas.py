from pydantic import BaseModel, Field


class SynthesizeIn(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: str = "en-IN"


class TranscribeOut(BaseModel):
    transcript: str
    language_code: str | None = None


class SynthesizeOut(BaseModel):
    audio_base64: str
    content_type: str = "audio/wav"
