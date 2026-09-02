from backend.llm.client import Message

VERSION = "translate-v1"

_LANG = {
    "hi": "standard Hindi (Devanagari)",
    "hi-BiharBoli": "simple Hindi with a natural Bihari conversational tone",
    "en": "simple English",
}

_LEVEL = {
    "class-6": "Class 6 (ages 11-12)",
    "class-8": "Class 8 (ages 13-14)",
    "class-10": "Class 10 (ages 15-16)",
}


def build(
    *,
    text: str,
    target_language: str,
    mode: str,
    reading_level: str,
) -> tuple[str, list[Message]]:
    lang_label = _LANG.get(target_language, _LANG["hi-BiharBoli"])
    level = _LEVEL.get(reading_level, _LEVEL["class-6"])

    if mode == "simplify":
        task = (
            f"Rewrite the passage in {lang_label} at a {level} reading level. "
            "Use short sentences and everyday words. Keep all facts and meaning."
        )
    else:
        task = (
            f"Translate the passage into {lang_label} at a {level} reading level. "
            "Keep names, numbers, and technical terms accurate."
        )

    system = f"""You are Medha, helping a Bihar school teacher prepare classroom material.
{task}
Output ONLY the translated/rewritten text — no preamble, no bullet labels."""
    messages = [Message(role="user", content=text.strip())]
    return system, messages
