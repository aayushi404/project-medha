"""Audio glue between the telephony providers' wire formats and Sarvam's
file-based STT/TTS.

Exotel's Voicebot Applet speaks raw/slin: 16-bit signed little-endian PCM,
mono, at whatever sample rate the websocket URL requested (we use 8000 Hz --
standard PSTN quality, and Sarvam's STT/TTS both handle it fine). Twilio's
Media Streams, in contrast, speak 8-bit G.711 mu-law at a fixed 8000 Hz (see
https://www.twilio.com/docs/voice/media-streams/websocket-messages) -- a
different codec entirely, not just a different sample rate. Sarvam's
endpoints want/return a self-describing audio file (wav here) independent of
either, so this module has to (a) wrap outgoing PCM in a WAV header for
Sarvam STT, (b) parse+resample Sarvam's WAV reply down to 8 kHz mono PCM,
and (c) convert between that PCM and whichever wire codec the active
provider needs -- see backend/src/backend/absence_calls/router.py's `_Wire`
adapters, which pick the right functions here per provider.
"""

# stdlib on 3.12; the audioop-lts backport provides the same module under
# the same import name on 3.13+ (see pyproject.toml).
import audioop
import io
import wave

import numpy as np

EXOTEL_SAMPLE_RATE = 8000
EXOTEL_SAMPLE_WIDTH = 2  # 16-bit
EXOTEL_CHANNELS = 1


def pcm16_to_wav(pcm: bytes, *, sample_rate: int = EXOTEL_SAMPLE_RATE) -> bytes:
    """Wrap raw 16-bit mono PCM in a minimal WAV container (Sarvam STT wants
    a file, not a bare byte stream)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(EXOTEL_CHANNELS)
        w.setsampwidth(EXOTEL_SAMPLE_WIDTH)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


def wav_to_pcm16(wav_bytes: bytes, *, target_rate: int = EXOTEL_SAMPLE_RATE) -> bytes:
    """Parse a WAV file (Sarvam TTS output -- whatever rate/width/channels it
    used) into raw 16-bit PCM at `target_rate` mono, for Exotel playback."""
    with wave.open(io.BytesIO(wav_bytes), "rb") as w:
        channels = w.getnchannels()
        width = w.getsampwidth()
        rate = w.getframerate()
        raw = w.readframes(w.getnframes())

    if width == 1:
        # unsigned 8-bit -> signed 16-bit
        samples = (np.frombuffer(raw, dtype=np.uint8).astype(np.int16) - 128) * 256
    elif width == 2:
        samples = np.frombuffer(raw, dtype="<i2").astype(np.int16)
    elif width == 4:
        samples = (np.frombuffer(raw, dtype="<i4") >> 16).astype(np.int16)
    else:
        raise ValueError(f"Unsupported WAV sample width: {width} bytes")

    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1).astype(np.int16)

    if rate != target_rate and len(samples) > 1:
        duration = len(samples) / rate
        target_len = max(1, round(duration * target_rate))
        src_x = np.linspace(0.0, 1.0, num=len(samples), endpoint=False)
        dst_x = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
        samples = np.interp(dst_x, src_x, samples.astype(np.float64)).astype(np.int16)

    return samples.astype("<i2").tobytes()


def chunk_for_exotel(pcm: bytes, *, chunk_bytes: int = 3200) -> list[bytes]:
    """Split PCM into Exotel-legal chunks: multiples of 320 bytes (20ms @
    8kHz/16-bit/mono), 3.2KB (100ms) by default -- within Exotel's documented
    3.2KB-100KB range."""
    chunk_bytes -= chunk_bytes % 320
    chunk_bytes = max(chunk_bytes, 320)
    return chunk_bytes_fixed(pcm, chunk_bytes)


def chunk_bytes_fixed(data: bytes, size: int) -> list[bytes]:
    """Split `data` into fixed-size pieces (the last one may be shorter)."""
    return [data[i : i + size] for i in range(0, len(data), size)] or [b""]


# --- Twilio Media Streams: 8-bit G.711 mu-law, fixed 8kHz mono, no WAV/PCM
# header -- see https://www.twilio.com/docs/voice/media-streams/websocket-messages.
# `audioop`'s width=2 means "the *linear* side is 16-bit PCM"; mu-law itself
# is always 1 byte/sample, width doesn't apply to it.
TWILIO_CHUNK_BYTES = 160  # 20ms @ 8kHz mu-law (1 byte/sample) -- Twilio's standard framing


def pcm16_to_mulaw(pcm: bytes) -> bytes:
    return audioop.lin2ulaw(pcm, 2)


def mulaw_to_pcm16(mulaw: bytes) -> bytes:
    return audioop.ulaw2lin(mulaw, 2)
