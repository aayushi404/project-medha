"""Two halves of the live call, plus the teacher-facing log.

`status-callback`, `twiml`, and the `voicebot` websockets are hit by the
telephony provider, not by our own frontend, so they can't use our JWTs.
Each is instead guarded by a per-call HMAC token bound to that call's id
(see security.py), plus Twilio's request signature where available. They
fail closed.

Exotel and Twilio speak genuinely different wire protocols for the
bidirectional audio stream (field names, event shapes, and -- crucially --
audio codec: Exotel wants raw 16-bit PCM, Twilio wants 8-bit mu-law). Rather
than duplicate the whole call state machine per provider, `_run_voicebot`
below is the one state machine, parameterized by a small `_Wire` adapter per
provider; only the adapters know about the protocol differences. See
https://docs.exotel.com/exotel-agentstream/voicebot-applet and
https://www.twilio.com/docs/voice/media-streams/websocket-messages.
"""

import asyncio
import base64
import json
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Protocol

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.absence_calls import service
from backend.absence_calls.audio import (
    chunk_bytes_fixed,
    chunk_for_exotel,
    mulaw_to_pcm16,
    pcm16_to_mulaw,
    pcm16_to_wav,
    wav_to_pcm16,
    TWILIO_CHUNK_BYTES,
)
from backend.absence_calls.conversation import ConversationState, next_reply, opening_line, summarize_reason
from backend.absence_calls.schemas import AbsenceCallOut
from backend.absence_calls.security import verify_call_token, verify_twilio_signature
from backend.auth.dependencies import require_teacher
from backend.core.config import settings
from backend.db.models import AbsenceCall, Student, Teacher
from backend.db.session import SessionLocal, get_db
from backend.llm.client import LLMError, Message
from backend.speech.client import SpeechError, synthesize, transcribe

logger = logging.getLogger("backend.absence_calls")

router = APIRouter(prefix="/absence-calls", tags=["absence-calls"])

# How long we listen after each prompt before transcribing whatever came in.
# A fixed window rather than real silence detection -- simple and predictable
# for v1; tightening this to voice-activity-based cutoff is the natural next
# step once this is tested against real calls.
_LISTEN_WINDOW_SECONDS = 6.0
_MIN_UTTERANCE_BYTES = 3200  # ~200ms @ 8kHz/16-bit mono PCM; below this, treat as silence
# Hard wall-clock cap on the whole call, independent of MAX_GUARDIAN_TURNS --
# a guardian who keeps talking shouldn't be able to run the call (and its
# LLM/TTS/STT cost) past this regardless of turn count.
_MAX_CALL_SECONDS = 120.0
# Hardening limits for the (provider-facing, unauthenticated-by-JWT) websocket:
# the first frame must arrive fast and prove itself, frames and buffered audio
# are capped, and a silent socket is dropped.
_START_TIMEOUT_SECONDS = 10.0
_IDLE_TIMEOUT_SECONDS = 30.0
_MAX_FRAME_CHARS = 64 * 1024
_MAX_AUDIO_BUFFER_BYTES = 2 * 1024 * 1024
_LIVE_STATUSES = ("queued", "dialing", "ringing")
_TIME_UP_CLOSING_LINE = "माफ़ कीजिए, समय हो गया है। जानकारी देने के लिए धन्यवाद। नमस्ते।"


@router.get("", response_model=list[AbsenceCallOut])
def list_absence_calls(
    class_section_id: uuid.UUID | None = Query(default=None),
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[AbsenceCallOut]:
    rows = service.list_recent_for_teacher(db, teacher, class_section_id=class_section_id)
    return [
        AbsenceCallOut(
            id=call.id,
            student_id=student.id,
            student_name=student.full_name,
            guardian_phone=call.guardian_phone,
            status=call.status,
            reason_text=call.reason_text,
            failure_reason=call.failure_reason,
            transcript=call.transcript,
            attendance_date=str(record.attendance_date),
            created_at=call.created_at,
            completed_at=call.completed_at,
        )
        for call, student, record in rows
    ]


def _find_call_by_sid(db: Session, call_sid: str | None) -> AbsenceCall | None:
    if not call_sid:
        return None
    return db.query(AbsenceCall).filter(AbsenceCall.provider_call_sid == call_sid).first()


def _authenticated_call(
    db: Session, cid: str | None, token: str | None, purpose: str, call_sid: str | None = None
) -> AbsenceCall:
    """Resolve the AbsenceCall a provider-facing request claims to be about,
    only if the per-call token checks out for `purpose`. 403 otherwise -- the
    same answer for "no such call" and "bad token" so it isn't an oracle."""
    try:
        call_uuid = uuid.UUID(cid) if cid else None
    except ValueError:
        call_uuid = None
    if call_uuid is None or not verify_call_token(token, str(call_uuid), purpose):
        raise HTTPException(403, "Forbidden.")
    call = db.get(AbsenceCall, call_uuid)
    if call is None or (call_sid and call.provider_call_sid and call.provider_call_sid != call_sid):
        raise HTTPException(403, "Forbidden.")
    return call


def _public_url(request: Request) -> str:
    # The URL Twilio signed is the one it was given, i.e. our configured public
    # origin -- not whatever Host header a proxy forwarded.
    query = f"?{request.url.query}" if request.url.query else ""
    return f"{settings.public_base_url}{request.url.path}{query}"


# --------------------------------------------------------------------------
# Exotel: status callback (webhook). Exotel has no request signature, so the
# per-call HMAC token (security.py) is the credential; the Voicebot Applet is
# wired to our websocket URL once, manually, in Exotel's dashboard (see
# telephony.py's ExotelProvider docstring).
# --------------------------------------------------------------------------


@router.post("/exotel/status-callback")
async def exotel_status_callback(
    request: Request,
    cid: str | None = Query(default=None),
    t: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Exotel's call-progress webhook. Field names (CallSid/Status) match
    Exotel's documented StatusCallback params as of writing -- verify against
    a live account, provider webhook payloads are the part most likely to
    have drifted from docs."""
    form = await request.form()
    call_sid = str(form.get("CallSid") or form.get("Sid") or "") or None
    provider_status = form.get("Status") or form.get("DialCallStatus")
    call = _authenticated_call(db, cid, t, "status", call_sid)
    if provider_status:
        service.update_status_from_provider_status(db, call, str(provider_status))
    return {"ok": True}


# --------------------------------------------------------------------------
# Twilio: unlike Exotel, the TwiML that starts the stream is generated by us
# on every call (no dashboard flow needed) -- see TwilioProvider.place_call.
# Twilio requests carry X-Twilio-Signature (verified) on top of our per-call
# token.
# --------------------------------------------------------------------------


async def _verify_twilio_request(request: Request) -> dict[str, str]:
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}
    if not verify_twilio_signature(_public_url(request), params, request.headers.get("x-twilio-signature")):
        raise HTTPException(403, "Forbidden.")
    return params


@router.api_route("/twilio/twiml", methods=["GET", "POST"])
async def twilio_twiml(
    request: Request,
    cid: str | None = Query(default=None),
    t: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> Response:
    await _verify_twilio_request(request)
    call = _authenticated_call(db, cid, t, "twiml")
    from xml.sax.saxutils import quoteattr

    from backend.absence_calls.security import sign_call_token

    ws_url = settings.public_base_url.replace("https://", "wss://").replace("http://", "ws://")
    stream_token = sign_call_token(str(call.id), "stream")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Connect><Stream url={quoteattr(ws_url + '/absence-calls/twilio/voicebot')}>"
        f"<Parameter name=\"cid\" value={quoteattr(str(call.id))} />"
        f"<Parameter name=\"t\" value={quoteattr(stream_token)} />"
        "</Stream></Connect></Response>"
    )
    return Response(content=xml, media_type="text/xml")


@router.post("/twilio/status-callback")
async def twilio_status_callback(
    request: Request,
    cid: str | None = Query(default=None),
    t: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Twilio's call-progress webhook. CallSid/CallStatus are Twilio's
    documented StatusCallback field names (https://www.twilio.com/docs/voice/twiml)."""
    params = await _verify_twilio_request(request)
    call = _authenticated_call(db, cid, t, "status", params.get("CallSid"))
    provider_status = params.get("CallStatus")
    if provider_status:
        service.update_status_from_provider_status(db, call, provider_status)
    return {"ok": True}


# --------------------------------------------------------------------------
# The shared call state machine, parameterized per provider by a `_Wire`.
# --------------------------------------------------------------------------


class _Wire(Protocol):
    name: str
    chunk_size: int

    def encode(self, pcm: bytes) -> bytes: ...  # PCM16 -> this provider's wire codec
    def decode(self, wire_bytes: bytes) -> bytes: ...  # wire codec -> PCM16
    def parse_start(self, evt: dict) -> tuple[str | None, str | None]: ...  # -> (stream_sid, call_sid)
    def parse_credentials(self, evt: dict) -> tuple[str | None, str | None]: ...  # -> (call id, stream token)
    def parse_media_payload(self, evt: dict) -> str: ...  # -> base64 payload
    def build_media(self, stream_sid: str, seq: int, chunk_idx: int, payload_b64: str) -> dict: ...
    def build_mark(self, stream_sid: str, seq: int, name: str) -> dict: ...


@dataclass
class _ExotelWire:
    name: str = "exotel"
    chunk_size: int = 3200

    def encode(self, pcm: bytes) -> bytes:
        return pcm  # already raw/slin PCM16 -- no conversion needed

    def decode(self, wire_bytes: bytes) -> bytes:
        return wire_bytes

    def parse_start(self, evt: dict) -> tuple[str | None, str | None]:
        start_info = evt.get("start", {})
        return evt.get("stream_sid") or start_info.get("stream_sid"), start_info.get("call_sid")

    def parse_credentials(self, evt: dict) -> tuple[str | None, str | None]:
        # Exotel echoes our CustomField (`<call id>|<stream token>`) back as a
        # custom parameter on the start event -- its exact container shape
        # isn't firmly documented, so accept a bare string or a dict of them.
        custom = evt.get("start", {}).get("custom_parameters")
        if isinstance(custom, dict):
            custom = next((v for v in custom.values() if isinstance(v, str) and "|" in v), None)
        if not isinstance(custom, str) or "|" not in custom:
            return None, None
        cid, _, token = custom.partition("|")
        return cid, token

    def parse_media_payload(self, evt: dict) -> str:
        return evt.get("media", {}).get("payload", "")

    def build_media(self, stream_sid: str, seq: int, chunk_idx: int, payload_b64: str) -> dict:
        return {
            "event": "media",
            "sequence_number": seq,
            "stream_sid": stream_sid,
            "media": {
                "chunk": chunk_idx,
                "timestamp": str(int(time.monotonic() * 1000)),
                "payload": payload_b64,
            },
        }

    def build_mark(self, stream_sid: str, seq: int, name: str) -> dict:
        return {"event": "mark", "sequence_number": seq, "stream_sid": stream_sid, "mark": {"name": name}}


@dataclass
class _TwilioWire:
    name: str = "twilio"
    chunk_size: int = TWILIO_CHUNK_BYTES

    def encode(self, pcm: bytes) -> bytes:
        return pcm16_to_mulaw(pcm)

    def decode(self, wire_bytes: bytes) -> bytes:
        return mulaw_to_pcm16(wire_bytes)

    def parse_start(self, evt: dict) -> tuple[str | None, str | None]:
        start_info = evt.get("start", {})
        return evt.get("streamSid") or start_info.get("streamSid"), start_info.get("callSid")

    def parse_credentials(self, evt: dict) -> tuple[str | None, str | None]:
        params = evt.get("start", {}).get("customParameters") or {}
        if not isinstance(params, dict):
            return None, None
        cid, token = params.get("cid"), params.get("t")
        return (cid if isinstance(cid, str) else None), (token if isinstance(token, str) else None)

    def parse_media_payload(self, evt: dict) -> str:
        return evt.get("media", {}).get("payload", "")

    def build_media(self, stream_sid: str, seq: int, chunk_idx: int, payload_b64: str) -> dict:
        # Twilio's outbound media message carries no sequence_number/chunk --
        # just the payload (https://www.twilio.com/docs/voice/media-streams/websocket-messages).
        return {"event": "media", "streamSid": stream_sid, "media": {"payload": payload_b64}}

    def build_mark(self, stream_sid: str, seq: int, name: str) -> dict:
        return {"event": "mark", "streamSid": stream_sid, "mark": {"name": name}}


async def _speak(websocket: WebSocket, wire: _Wire, stream_sid: str, seq: int, text: str) -> int:
    """Synthesize `text` (Bihari-accented Hindi) and stream it to the
    provider as `media` frames, followed by a `mark` so we learn when
    playback finishes. Returns the next sequence_number to use."""
    try:
        result = await synthesize(text, language="hi-IN", accent="bihari")
        pcm = wav_to_pcm16(result.audio_bytes)
    except SpeechError as exc:
        logger.warning("absence_call_tts_failed: %s", exc)
        return seq
    except Exception:
        # A malformed/unexpected TTS response shouldn't take the whole call
        # down -- skip this line (the guardian hears silence for one turn
        # instead of the call dropping) and keep going.
        logger.exception("absence_call_tts_audio_error")
        return seq

    wire_bytes = wire.encode(pcm)
    if wire.name == "exotel":
        chunks = chunk_for_exotel(wire_bytes, chunk_bytes=wire.chunk_size)
    else:
        chunks = chunk_bytes_fixed(wire_bytes, wire.chunk_size)
    for i, chunk in enumerate(chunks):
        seq += 1
        payload_b64 = base64.b64encode(chunk).decode("ascii")
        await websocket.send_text(json.dumps(wire.build_media(stream_sid, seq, i, payload_b64)))
    seq += 1
    await websocket.send_text(json.dumps(wire.build_mark(stream_sid, seq, "prompt-end")))
    return seq


async def _transcribe_or_silence(pcm: bytes) -> str:
    if len(pcm) < _MIN_UTTERANCE_BYTES:
        return "(अभिभावक की तरफ़ से कोई जवाब नहीं आया)"
    try:
        result = await transcribe(
            pcm16_to_wav(pcm), filename="guardian.wav", content_type="audio/wav", language="hi-IN"
        )
        return result.transcript
    except SpeechError as exc:
        logger.warning("absence_call_stt_failed: %s", exc)
        return "(आवाज़ समझ में नहीं आई)"


async def _safe_summarize(conv: ConversationState) -> str:
    try:
        return await summarize_reason(conv)
    except LLMError as exc:
        logger.warning("absence_call_summary_failed: %s", exc)
        return "कॉल हुई, लेकिन वजह अपने आप summarise नहीं हो पाई -- ट्रांसक्रिप्ट देखें।"


async def _recv_json(websocket: WebSocket, timeout: float) -> dict | None:
    """One bounded frame: times out if the peer goes silent, and rejects
    oversized or non-JSON frames instead of buffering/parsing them."""
    raw = await asyncio.wait_for(websocket.receive_text(), timeout=timeout)
    if len(raw) > _MAX_FRAME_CHARS:
        return None
    try:
        evt = json.loads(raw)
    except ValueError:
        return None
    return evt if isinstance(evt, dict) else None


async def _run_voicebot(websocket: WebSocket, wire: _Wire) -> None:
    await websocket.accept()
    db = None  # opened only after the caller proves it owns this call
    call: AbsenceCall | None = None
    conv: ConversationState | None = None
    stream_sid: str | None = None
    seq = 0
    audio_buffer = bytearray()
    listening = False
    listen_started = 0.0
    call_started = 0.0

    try:
        while True:
            timeout = _IDLE_TIMEOUT_SECONDS if call is not None else _START_TIMEOUT_SECONDS
            evt = await _recv_json(websocket, timeout)
            if evt is None:
                await websocket.close(code=1008)
                return
            event = evt.get("event")

            if call is None:
                # Until a valid `start` frame authenticates us, ignore everything else
                # (Twilio sends `connected` first) but never hold resources.
                if event == "connected":
                    continue
                if event != "start":
                    await websocket.close(code=1008)
                    return
                stream_sid, call_sid = wire.parse_start(evt)
                cid, token = wire.parse_credentials(evt)
                try:
                    call_uuid = uuid.UUID(cid) if cid else None
                except ValueError:
                    call_uuid = None
                if (
                    not stream_sid
                    or not call_sid
                    or call_uuid is None
                    or not verify_call_token(token, str(call_uuid), "stream")
                ):
                    logger.warning("absence_call_voicebot_rejected provider=%s reason=bad_credentials", wire.name)
                    await websocket.close(code=1008)
                    return

                db = SessionLocal()
                call = db.get(AbsenceCall, call_uuid)
                # The SID must match what we stored when placing the call, and the
                # call must still be live -- a finished call can't be re-driven.
                if (
                    call is None
                    or call.provider_call_sid != call_sid
                    or call.status not in _LIVE_STATUSES
                ):
                    logger.warning("absence_call_voicebot_rejected provider=%s reason=state", wire.name)
                    call = None
                    await websocket.close(code=1008)
                    return

                student = db.get(Student, call.student_id)
                conv = ConversationState(student_name=(student.full_name if student else "बच्चे"))
                service.update_status_from_provider_status(db, call, "in-progress")

                call_started = time.monotonic()
                seq = await _speak(websocket, wire, stream_sid, seq, opening_line(conv.student_name))
                audio_buffer.clear()
                listening = True
                listen_started = time.monotonic()
                continue

            if event == "media" and listening and stream_sid:
                payload = wire.parse_media_payload(evt)
                if payload:
                    if len(audio_buffer) > _MAX_AUDIO_BUFFER_BYTES:
                        await websocket.close(code=1009)
                        return
                    try:
                        audio_buffer.extend(wire.decode(base64.b64decode(payload, validate=True)))
                    except ValueError:
                        await websocket.close(code=1007)
                        return
                if time.monotonic() - listen_started < _LISTEN_WINDOW_SECONDS:
                    continue

                listening = False
                assert conv is not None
                assert call is not None

                if time.monotonic() - call_started >= _MAX_CALL_SECONDS:
                    reply_text, is_final = _TIME_UP_CLOSING_LINE, True
                    conv.messages.append(Message(role="assistant", content=reply_text))
                else:
                    guardian_text = await _transcribe_or_silence(bytes(audio_buffer))
                    audio_buffer.clear()
                    try:
                        reply_text, is_final = await next_reply(conv, guardian_text)
                    except LLMError:
                        logger.exception("absence_call_llm_failed call_id=%s", call.id)
                        reply_text, is_final = "क्षमा करें, अभी तकनीकी दिक़्क़त है। धन्यवाद, नमस्ते।", True

                seq = await _speak(websocket, wire, stream_sid, seq, reply_text)

                if is_final:
                    reason = await _safe_summarize(conv)
                    transcript = "\n".join(f"{m.role}: {m.content}" for m in conv.messages)
                    service.save_transcript_and_reason(db, call, transcript=transcript, reason_text=reason)
                    await websocket.close()
                    return

                listening = True
                listen_started = time.monotonic()
                continue

            if event == "stop":
                if call is not None and call.status not in ("completed", "no_answer", "failed"):
                    reason = await _safe_summarize(conv) if conv else "कॉल पूरी नहीं हो पाई।"
                    transcript = (
                        "\n".join(f"{m.role}: {m.content}" for m in conv.messages) if conv else ""
                    )
                    service.save_transcript_and_reason(db, call, transcript=transcript, reason_text=reason)
                break
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        logger.exception("absence_call_voicebot_error provider=%s call_id=%s", wire.name, call.id if call else None)
    finally:
        if db is not None:
            db.close()


@router.websocket("/exotel/voicebot")
async def exotel_voicebot(websocket: WebSocket) -> None:
    await _run_voicebot(websocket, _ExotelWire())


@router.websocket("/twilio/voicebot")
async def twilio_voicebot(websocket: WebSocket) -> None:
    await _run_voicebot(websocket, _TwilioWire())
