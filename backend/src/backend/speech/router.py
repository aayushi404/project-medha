import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from backend.ask.service import load_owned_session
from backend.auth.dependencies import get_current_teacher, get_current_user
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.speech import client, service
from backend.speech.rate_limit import voice_rate_limit
from backend.speech.schemas import (
    ConverseIn,
    SynthesizeIn,
    SynthesizeOut,
    TranscribeOut,
    VoiceTurnOut,
)

router = APIRouter(prefix="/speech", tags=["speech"])

_MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB
_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


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


@router.post("/converse", dependencies=[Depends(voice_rate_limit)])
async def converse(
    payload: ConverseIn,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    """One spoken turn with Medha. SSE: `token`* → `audio` (base64 WAV) → `done`,
    or a single `error`. Ownership is checked here so a bad session is a clean
    JSON 404, not an error mid-stream."""
    session = load_owned_session(db, teacher, payload.session_id)
    generator = service.stream_converse(
        db, teacher, session, payload.transcript, payload.language, payload.style
    )
    return EventSourceResponse(generator, headers=_SSE_HEADERS)


@router.get("/sessions/{session_id}/turns", response_model=list[VoiceTurnOut])
def list_voice_turns(
    session_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> list[VoiceTurnOut]:
    """Recent completed voice turns for a session, oldest first -- the panel
    replays these when it reopens."""
    load_owned_session(db, teacher, session_id)
    turns = service.list_recent_turns(db, session_id, limit)
    return [VoiceTurnOut.model_validate(t) for t in turns]
