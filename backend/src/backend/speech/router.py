from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from backend.auth.dependencies import get_current_user
from backend.db.models import Teacher
from backend.speech import client
from backend.speech.schemas import SynthesizeIn, SynthesizeOut, TranscribeOut

router = APIRouter(prefix="/speech", tags=["speech"])

_MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/transcribe", response_model=TranscribeOut)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    user: Teacher = Depends(get_current_user),
) -> TranscribeOut:
    """Speech-to-text via Sarvam Saaras. Accepts short audio clips (<30s)."""
    _ = user  # auth gate — any approved user may transcribe
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty audio file.")
    if len(data) > _MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Audio file too large.")

    content_type = file.content_type or "audio/webm"
    filename = file.filename or "audio.webm"
    try:
        result = await client.transcribe(
            data,
            filename=filename,
            content_type=content_type,
            language=language,
        )
    except client.SpeechError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE if "not configured" in str(exc).lower() else status.HTTP_422_UNPROCESSABLE_ENTITY,
            str(exc),
        ) from exc

    return TranscribeOut(transcript=result.transcript, language_code=result.language_code)


@router.post("/synthesize", response_model=SynthesizeOut)
async def synthesize_speech(
    payload: SynthesizeIn,
    user: Teacher = Depends(get_current_user),
) -> SynthesizeOut:
    """Text-to-speech via Sarvam Bulbul. Returns base64-encoded WAV audio."""
    _ = user
    try:
        result = await client.synthesize(
            payload.text,
            language=payload.language,
            accent=payload.accent,
        )
    except client.SpeechError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE if "not configured" in str(exc).lower() else status.HTTP_422_UNPROCESSABLE_ENTITY,
            str(exc),
        ) from exc

    import base64

    return SynthesizeOut(
        audio_base64=base64.b64encode(result.audio_bytes).decode("ascii"),
        content_type=result.content_type,
    )
