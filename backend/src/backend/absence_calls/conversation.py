"""The actual phone conversation: what Medha says, and how it decides when
to stop asking. Text only -- backend.absence_calls.service turns each line
into speech (Sarvam TTS) and each guardian reply back into text (Sarvam STT)
before/after calling into this module, so this stays swappable/testable
without touching audio at all.

Deliberately uses its own Gemini client/key (ABSENCE_CALL_GEMINI_API_KEY),
not the shared backend.llm.get_llm_client() the rest of the app uses -- a
live phone call's LLM usage shouldn't share quota (or a billing line) with
lesson generation and chat, in either direction.
"""

from dataclasses import dataclass, field

from backend.core.config import settings
from backend.llm.client import LLMClient, Message
from backend.llm.gemini import GeminiClient

MAX_GUARDIAN_TURNS = 3
_END_TAG = "[END]"

_call_llm_client: GeminiClient | None = None


def _get_call_llm_client() -> LLMClient:
    global _call_llm_client
    if _call_llm_client is None:
        _call_llm_client = GeminiClient(
            api_key=settings.absence_call_gemini_api_key,
            model=settings.absence_call_gemini_model,
        )
    return _call_llm_client


_SYSTEM_PROMPT = (
    "You are Medha, an automated calling assistant for a Bihar government "
    "school. You just called a student's guardian because the student, "
    "{student_name}, was marked absent from school today. "
    "Speak only in simple, warm, respectful Hindi (Devanagari script) -- a "
    "Bihari-accented voice will read your words aloud on a phone call, so "
    "keep sentences short, use no English words and no markdown/formatting. "
    "Your goal: politely ask why the child is absent today, and once you "
    "have a reason (or the guardian clearly can't or won't give one), thank "
    "them and end the call. Ask at most one follow-up question -- never "
    "interrogate. As soon as your reply should end the call, append the "
    "exact tag {end_tag} on its own after your Hindi sentence; never use "
    "that tag before you're actually ending the call."
).format(end_tag=_END_TAG, student_name="{student_name}")

_SUMMARY_SYSTEM_PROMPT = (
    "Summarize, in one short Hindi sentence with no preamble, why the "
    "student was absent today, based on this phone call transcript with "
    "their guardian. If the call wasn't answered or no clear reason was "
    "given, say that plainly instead."
)


@dataclass
class ConversationState:
    student_name: str
    messages: list[Message] = field(default_factory=list)
    guardian_turns: int = 0


def opening_line(student_name: str) -> str:
    return (
        f"नमस्ते। मैं मेधा स्कूल की तरफ़ से बोल रही हूँ। "
        f"{student_name} आज स्कूल नहीं आए। कृपया बताइए, इसकी क्या वजह है?"
    )


async def next_reply(state: ConversationState, guardian_text: str) -> tuple[str, bool]:
    """Feed the guardian's (STT'd) reply in, get Medha's next line back.
    Returns (reply_text, is_final) -- when is_final, the caller should speak
    this line and then hang up rather than listening for another reply."""
    state.messages.append(Message(role="user", content=guardian_text))
    state.guardian_turns += 1

    if state.guardian_turns > MAX_GUARDIAN_TURNS:
        closing = "ठीक है, जानकारी देने के लिए धन्यवाद। नमस्ते।"
        state.messages.append(Message(role="assistant", content=closing))
        return closing, True

    client = _get_call_llm_client()
    completion = await client.complete(
        system=_SYSTEM_PROMPT.format(student_name=state.student_name),
        messages=state.messages,
        max_tokens=150,
    )
    text = completion.text.strip()
    is_final = _END_TAG in text
    text = text.replace(_END_TAG, "").strip()
    state.messages.append(Message(role="assistant", content=text))
    return text, is_final


async def summarize_reason(state: ConversationState) -> str:
    """The one-line takeaway a teacher sees in the call log."""
    if not any(m.role == "user" for m in state.messages):
        return "अभिभावक से बात नहीं हो पाई।"
    client = _get_call_llm_client()
    transcript = "\n".join(f"{m.role}: {m.content}" for m in state.messages)
    completion = await client.complete(
        system=_SUMMARY_SYSTEM_PROMPT,
        messages=[Message(role="user", content=transcript)],
        max_tokens=80,
    )
    return completion.text.strip()
