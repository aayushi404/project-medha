"""Render the fixed voice-panel welcome to static audio assets.

The greeting text never changes, so we synthesise it once here and commit the
MP3s under shiksha_sathi/public/audio/ instead of hitting Sarvam on every panel
open. Re-run this only if the wording, speaker, or pacing needs to change:

    backend/.venv/bin/python backend/gen_greeting.py

then run the two files through ffmpeg (trim silence + loudnorm to -16 LUFS +
0.15s pad) and re-encode to 160k mono MP3.
"""

import base64
import pathlib

import httpx

# Read SARVAM_API_KEY straight from backend/.env (no app import needed).
ENV = pathlib.Path(__file__).with_name(".env")
KEY = ""
for line in ENV.read_text().splitlines():
    if line.startswith("SARVAM_API_KEY="):
        KEY = line.split("=", 1)[1].strip()
        break
assert KEY, "SARVAM_API_KEY not found in backend/.env"

TEXT = "आपका स्वागत है नए शिक्षित एवं विकसित बिहार में।"
OUT = pathlib.Path(__file__).parents[1] / "shiksha_sathi" / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

# (filename stem, Sarvam speaker, pace) — matches sarvam_tts_speaker* / pace_bihari.
VARIANTS = [
    ("greeting-hi", "shubh", 0.9),
    ("greeting-hi-bihari", "ritu", 0.88),
]

for name, speaker, pace in VARIANTS:
    resp = httpx.post(
        "https://api.sarvam.ai/text-to-speech",
        headers={"api-subscription-key": KEY, "Content-Type": "application/json"},
        json={
            "text": TEXT,
            "language_code": "hi-IN",
            "model": "bulbul:v3",
            "speaker": speaker,
            "pace": pace,
            "loudness": 1.2,
            "speech_sample_rate": 24000,
            "enable_preprocessing": True,
        },
        timeout=30,
    )
    resp.raise_for_status()
    dest = OUT / f"{name}.wav"
    dest.write_bytes(base64.b64decode(resp.json()["audios"][0]))
    print(f"wrote {dest} ({dest.stat().st_size} bytes) — now run ffmpeg cleanup")
