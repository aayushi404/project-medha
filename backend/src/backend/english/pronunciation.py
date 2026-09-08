"""Pronunciation scoring — STT + word overlap + LLM tips."""

import json
import logging
import re

from backend.english.pronunciation_schemas import PronunciationOut
from backend.llm import LLMError, Message, get_llm_client
from backend.speech import client as speech_client

logger = logging.getLogger("backend.english.pronunciation")

_WORD = re.compile(r"[a-z']+")


def _words(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def word_overlap_score(expected: str, heard: str) -> int:
    exp = _words(expected)
    if not exp:
        return 0
    heard_set = set(_words(heard))
    matches = sum(1 for w in exp if w in heard_set)
    return round(100 * matches / len(exp))


async def _llm_feedback(expected: str, heard: str, score: int) -> tuple[str, list[str]]:
    system = """You are Medha, a friendly English tutor for Bihar school students.
Given what the student was asked to say and what we heard, give brief pronunciation feedback.
Reply as JSON only: {"feedback": "1-2 encouraging sentences", "tips": ["tip1", "tip2"]}
Keep tips short and actionable. Use simple English."""
    user = f'Expected: "{expected}"\nHeard: "{heard}"\nScore: {score}/100'
    client = get_llm_client()
    try:
        result = await client.complete(
            system=system,
            messages=[Message(role="user", content=user)],
            max_tokens=400,
        )
        raw = result.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.removesuffix("```").strip()
        data = json.loads(raw)
        feedback = str(data.get("feedback", "")).strip()
        tips_raw = data.get("tips") or []
        tips = [str(t).strip() for t in tips_raw if str(t).strip()][:3]
        if feedback:
            return feedback, tips
    except (LLMError, json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.warning("pronunciation_feedback_fallback: %s", exc)

    if score >= 85:
        return "Great job! Your pronunciation was clear.", ["Keep practicing aloud every day."]
    if score >= 60:
        return "Good attempt! A few words need clearer sounds.", [
            "Listen to the model, then say it slowly.",
            "Focus on one difficult word at a time.",
        ]
    return "Keep trying — speaking slowly helps.", [
        "Tap Listen and repeat word by word.",
        "Record yourself again after hearing the sentence.",
    ]


async def check_pronunciation(
    audio: bytes,
    *,
    expected_text: str,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
) -> PronunciationOut:
    expected = expected_text.strip()
    if not expected:
        raise ValueError("Expected phrase is required.")

    result = await speech_client.transcribe(
        audio,
        filename=filename,
        content_type=content_type,
        language="en",
    )
    heard = result.transcript.strip()
    score = word_overlap_score(expected, heard)
    feedback, tips = await _llm_feedback(expected, heard, score)

    return PronunciationOut(
        score=score,
        heard=heard or "(no speech detected)",
        expected=expected,
        feedback=feedback,
        tips=tips,
    )
