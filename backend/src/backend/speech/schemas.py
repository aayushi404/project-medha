import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SynthesizeIn(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: str = "en-IN"
    accent: str | None = None  # "bihari" for Bihari-tuned Hindi TTS


class TranscribeOut(BaseModel):
    transcript: str
    language_code: str | None = None


class SynthesizeOut(BaseModel):
    audio_base64: str
    content_type: str = "audio/wav"


class ConverseIn(BaseModel):
    """One spoken turn. The client has already run STT (via /speech/transcribe or
    the browser) and sends the text; audio-in is a later addition."""

    session_id: uuid.UUID
    transcript: str = Field(min_length=1, max_length=2000)
    # Optional reply-language override ("in English" / "हिंदी में" mid-chat).
    # Falls back to the session's stored choice, then the teacher's preference.
    language: str | None = None
    # Result of an in-conversation command ("keep it short", "go deeper").
    style: Literal["normal", "short", "detail"] | None = None

    @field_validator("transcript")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("transcript is required")
        return v


class VoiceTurnOut(BaseModel):
    """A completed spoken exchange, for repopulating the panel when it reopens."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_transcript: str
    assistant_text: str | None
    created_at: datetime
