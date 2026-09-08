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


def _language_code(pref: str | None) -> str | None:
    """Map Medha preferred_language tags to Sarvam BCP-47 codes.

    Returns None to let Saaras auto-detect (best for code-mixed speech).
    """
    if not pref:
        return None
    p = pref.lower()
    if p.startswith("en"):
        return "en-IN"
    if p.startswith("hi"):
        return "hi-IN"
    return None


def _input_audio_codec(content_type: str, filename: str) -> str | None:
    ct = (content_type or "").lower()
    fn = (filename or "").lower()
    if "wav" in ct or fn.endswith(".wav"):
        return "wav"
    if "webm" in ct or fn.endswith(".webm"):
        return "webm"
    if "mp4" in ct or "m4a" in ct or fn.endswith(".mp4") or fn.endswith(".m4a"):
        return "mp4"
    if "ogg" in ct or fn.endswith(".ogg"):
        return "ogg"
    if "mpeg" in ct or "mp3" in ct or fn.endswith(".mp3"):
        return "mp3"
    return None


def _parse_sarvam_error(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        if isinstance(body, dict):
            for key in ("message", "error", "detail"):
                val = body.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
    except Exception:
        pass
    text = resp.text.strip()
    if text:
        return text[:240]
    return "Could not transcribe your voice. Please try again."


async def transcribe(
    audio: bytes,
    *,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
    language: str | None = None,
) -> TranscribeResult:
    """Transcribe short audio (<30s) via Sarvam REST STT."""
    if len(audio) < 500:
        raise SpeechError(
            "Recording too short. Hold the mic a little longer while you speak."
        )

    lang = _language_code(language)
    codec = _input_audio_codec(content_type, filename)
    files = {"file": (filename, audio, content_type)}
    data: dict[str, str] = {
        "model": settings.sarvam_stt_model,
        "mode": "transcribe",
    }
    if lang:
        data["language_code"] = lang
    if codec:
        data["input_audio_codec"] = codec

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
        msg = _parse_sarvam_error(resp)
        logger.warning(
            "sarvam_stt_error status=%s codec=%s lang=%s body=%s",
            resp.status_code,
            codec,
            lang,
            resp.text[:400],
        )
        if resp.status_code in (401, 403):
            raise SpeechError(
                "Speech service authentication failed. Check SARVAM_API_KEY on the server."
            )
        raise SpeechError(msg)

    payload = resp.json()
    transcript = (payload.get("transcript") or "").strip()
    if not transcript:
        logger.warning("sarvam_stt_empty_transcript payload=%s", str(payload)[:200])
        raise SpeechError(
            "No speech detected. Speak clearly for at least one second, then tap the mic again to stop."
        )
    return TranscribeResult(
        transcript=transcript,
        language_code=payload.get("language_code"),
    )


def _tts_voice(language: str | None, accent: str | None) -> tuple[str, str, float | None]:
    """Resolve Sarvam lang, speaker, and optional pace."""
    lang = _language_code(language) or "hi-IN"
    speaker = settings.sarvam_tts_speaker
    pace: float | None = None

    pref = (language or "").lower()
    use_bihari = (accent or "").lower() == "bihari" or "bihar" in pref
    if use_bihari and lang == "hi-IN":
        speaker = settings.sarvam_tts_speaker_bihari
        pace = settings.sarvam_tts_pace_bihari

    return lang, speaker, pace


async def synthesize(
    text: str,
    *,
    language: str | None = None,
    accent: str | None = None,
) -> SynthesizeResult:
    """Convert text to speech via Sarvam Bulbul TTS."""
    lang, speaker, pace = _tts_voice(language, accent)
    body: dict[str, str | float] = {
        "text": text[:2500],
        "language_code": lang,
        "model": settings.sarvam_tts_model,
        "speaker": speaker,
    }
    if pace is not None:
        body["pace"] = pace
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
