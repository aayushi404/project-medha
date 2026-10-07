"""Output-side safety net for student-facing generation.

The prompts already instruct the model never to swear, insult or use
over-familiar pet names (see `prompts.CONDUCT_RULES`) -- this module is the
backstop for when a reply doesn't follow that instruction. It checks the
model's own output, never what a student types, and only for words that are
essentially always inappropriate in a classroom reply; words with an
ordinary, innocent meaning (e.g. "kutta" = dog, "saala" = brother-in-law)
are deliberately left out, since BSEB content legitimately uses them (an
animals chapter, a family example) and a blunt filter would mangle that
text. Not exhaustive -- extend `_PROFANITY_*` if something slips through.
"""

import re

# English profanity/abuse with no legitimate classroom use.
_PROFANITY_EN = [
    "fuck", "fucking", "fucker", "shit", "bitch", "asshole", "bastard",
    "slut", "whore", "dickhead", "motherfucker",
]

# Hindi/Hinglish profanity and abuse, Latin transliteration -- only words that
# are essentially always vulgar, not words that double as an ordinary noun.
_PROFANITY_HI_LATIN = [
    "chutiya", "chutiye", "chutiyapa", "madarchod", "madharchod",
    "behenchod", "bhenchod", "bhosadi", "bhosdike", "gandu", "gaandu",
    "randi", "haraami", "harami", "kamina", "kamine", "kameena",
]

# Same words, Devanagari.
_PROFANITY_HI_DEVANAGARI = [
    "चूतिया", "चूतिये", "मादरचोद", "भेनचोद", "बहनचोद", "भोसड़ी", "गांडू",
    "रंडी", "हरामी", "कमीना", "कमीने",
]

_ALL_BANNED = _PROFANITY_EN + _PROFANITY_HI_LATIN + _PROFANITY_HI_DEVANAGARI

# Python's \b is built on \w, and \w does NOT include Devanagari's combining
# vowel signs (the matras on most real words, e.g. the ी/ा/ू in हरामी) -- so a
# plain \b...\b pattern silently fails to match almost any real Devanagari
# word. This class spells out "word character" to include the whole
# Devanagari block, so the boundary actually works for both scripts.
_WORD_CHAR = r"[0-9A-Za-z_ऀ-ॿ]"
_PATTERN = re.compile(
    rf"(?<!{_WORD_CHAR})(" + "|".join(re.escape(w) for w in _ALL_BANNED) + rf")(?!{_WORD_CHAR})",
    re.IGNORECASE,
)

# "babu" is banned by name (CONDUCT_RULES), but a capitalized "Babu" is also a
# real historical title/name prefix in the BSEB syllabus ("Babu Kunwar
# Singh", "Babuji") -- redacting it there would break a real lesson. The
# address-word misuse this guards against ("theek hai babu", "suniye babu")
# is reliably lowercase mid-sentence in the Latin script, so this one is
# case-sensitive on purpose, matching lowercase only.
_BABU_LATIN = re.compile(rf"(?<!{_WORD_CHAR})babu(?!{_WORD_CHAR})")

# Devanagari has no case, so the same trick doesn't apply to "बाबू" -- instead,
# `_redact_devanagari_babu` below only redacts it when it ISN'T immediately
# followed by another word (i.e. not "बाबू <Name>"), which is how the address
# misuse reads ("बाबू, सुनिए" / "ठीक है बाबू।") versus a real name.
_BABU_DEVANAGARI = "बाबू"

# How much unflushed text a streaming caller may hold before flushing anyway,
# even with no word boundary in sight (keeps a pathological no-space run from
# growing forever). See `split_safe_prefix`.
_MAX_BUFFER_CHARS = 80


def _redact_devanagari_babu(text: str) -> tuple[str, list[str]]:
    caught: list[str] = []
    out: list[str] = []
    i = 0
    while True:
        idx = text.find(_BABU_DEVANAGARI, i)
        if idx == -1:
            out.append(text[i:])
            break
        end = idx + len(_BABU_DEVANAGARI)
        j = end
        while j < len(text) and text[j] == " ":
            j += 1
        next_is_name = j < len(text) and text[j].isalpha()
        out.append(text[i:idx])
        if next_is_name:
            out.append(_BABU_DEVANAGARI)  # "बाबू कुँवर सिंह" -- a name, keep it
        else:
            out.append("जी")  # a warm, polite sign-off in its place
            caught.append("बाबू")
        i = end
    return "".join(out), caught


def sanitize(text: str) -> tuple[str, list[str]]:
    """Replace every banned word in `text` with a neutral placeholder.
    Returns (cleaned_text, words_caught) -- the second is non-empty only when
    something was actually redacted, so callers can log it."""
    caught: list[str] = []

    def _replace(m: re.Match[str]) -> str:
        caught.append(m.group(0).lower())
        return "..."

    text = _PATTERN.sub(_replace, text)

    def _replace_babu(m: re.Match[str]) -> str:
        caught.append("babu")
        return "ji"  # "theek hai babu" -> "theek hai ji": still a warm, polite sign-off

    text = _BABU_LATIN.sub(_replace_babu, text)

    text, babu_dev_caught = _redact_devanagari_babu(text)
    caught.extend(babu_dev_caught)

    return text, caught


def split_safe_prefix(buf: str) -> tuple[str, str] | None:
    """For streaming callers: how much of `buf` is safe to check and flush
    right now without risking cutting a banned word in half (the LLM API's
    chunk boundaries don't line up with word boundaries, so a flagged word
    can arrive split across several deltas). Flushes up to the last
    whitespace; if the buffer has grown past a sane single-word length with
    no whitespace yet, flushes all of it anyway. Returns (ready, remainder),
    or None if nothing is safe to flush yet."""
    idx = max(buf.rfind(" "), buf.rfind("\n"), buf.rfind("\t"))
    if idx != -1:
        return buf[: idx + 1], buf[idx + 1 :]
    if len(buf) > _MAX_BUFFER_CHARS:
        return buf, ""
    return None
