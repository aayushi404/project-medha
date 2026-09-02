"""Sarvam AI speech client — STT (Saaras) and TTS (Bulbul)."""

import base64
import logging
from dataclasses import dataclass

import httpx

from backend.core.config import settings

logger = logging.getLogger("backend.speech")

_BASE = "https://api.sarvam.ai"
_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class SpeechError(RuntimeError):
    """Raised when Sarvam speech APIs fail."""


@dataclass
class TranscribeResult:
    transcript: str
    language_code: str | None = None


@dataclass
class SynthesizeResult:
    audio_bytes: bytes
    content_type: str


def _headers() -> dict[str, str]:
    if not settings.sarvam_api_key:
        raise SpeechError("SARVAM_API_KEY is not configured")
    return {"api-subscription-key": settings.sarvam_api_key}


def _language_code(pref: str | None) -> str:
    """Map Medha preferred_language tags to Sarvam BCP-47 codes."""
    if not pref:
        return "hi-IN"
    p = pref.lower()
    if p.startswith("en"):
        return "en-IN"
    if p.startswith("hi"):
        return "hi-IN"
    return "hi-IN"


async def transcribe(
    audio: bytes,
    *,
    filename: str = "audio.webm",
    content_type: str = "audio/webm",
    language: str | None = None,
) -> TranscribeResult:
    """Transcribe short audio (<30s) via Sarvam REST STT."""
    lang = _language_code(language)
    files = {"file": (filename, audio, content_type)}
    data = {
        "model": settings.sarvam_stt_model,
        "mode": "transcribe",
        "language_code": lang,
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.post(
                f"{_BASE}/speech-to-text",
                headers=_headers(),
                files=files,
                data=data,
            )
        except httpx.HTTPError as exc:
            logger.warning("sarvam_stt_network_error: %s", exc)
            raise SpeechError("Could not reach the speech service.") from exc

    if resp.status_code >= 400:
        logger.warning("sarvam_stt_error status=%s body=%s", resp.status_code, resp.text[:200])
        raise SpeechError("Could not transcribe your voice. Please try again.")

    payload = resp.json()
    transcript = (payload.get("transcript") or "").strip()
    if not transcript:
        raise SpeechError("No speech detected. Please speak clearly and try again.")
    return TranscribeResult(
        transcript=transcript,
        language_code=payload.get("language_code"),
    )


async def synthesize(
    text: str,
    *,
    language: str | None = None,
) -> SynthesizeResult:
    """Convert text to speech via Sarvam Bulbul TTS."""
    lang = _language_code(language)
    body = {
        "text": text[:2500],
        "language_code": lang,
        "model": settings.sarvam_tts_model,
        "speaker": settings.sarvam_tts_speaker,
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.post(
                f"{_BASE}/text-to-speech",
                headers={**_headers(), "Content-Type": "application/json"},
                json=body,
            )
        except httpx.HTTPError as exc:
            logger.warning("sarvam_tts_network_error: %s", exc)
            raise SpeechError("Could not reach the speech service.") from exc

    if resp.status_code >= 400:
        logger.warning("sarvam_tts_error status=%s body=%s", resp.status_code, resp.text[:200])
        raise SpeechError("Could not generate speech. Please try again.")

    payload = resp.json()
    audios = payload.get("audios") or payload.get("audio")
    if isinstance(audios, list) and audios:
        raw = audios[0]
    elif isinstance(audios, str):
        raw = audios
    else:
        raise SpeechError("Empty speech response from the service.")

    try:
        audio_bytes = base64.b64decode(raw)
    except Exception as exc:
        raise SpeechError("Invalid speech response.") from exc

    return SynthesizeResult(audio_bytes=audio_bytes, content_type="audio/wav")
