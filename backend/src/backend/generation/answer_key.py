"""On-demand answer key for a `question_paper` generation.

Not persisted: it's rebuilt from whatever paper content is passed in, so an
edited paper always yields a matching key. The endpoint
(`POST /generations/{id}/answer-key`) calls `build`.
"""

import json
import logging

from pydantic import BaseModel, ConfigDict, Field

from backend.generation.content import QuestionPaperContent
from backend.llm import LLMError, Message, get_llm_client
from backend.llm.prompts import language_instruction

logger = logging.getLogger("backend.generation")

_MAX_TOKENS = 3200

_FENCE_STRIPPED = ("```json", "```")


def _extract_json(text: str) -> dict | None:
    s = text.strip()
    for f in _FENCE_STRIPPED:
        if s.startswith(f):
            s = s[len(f) :]
    s = s.strip().removesuffix("```").strip()
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(s[start : end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


class AnswerKeyEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    number: int = 0
    answer: str = ""
    solution: str = ""


class AnswerKeySection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    answers: list[AnswerKeyEntry] = Field(default_factory=list)


class AnswerKey(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sections: list[AnswerKeySection] = Field(default_factory=list)


def _prompt(paper: dict, language: str) -> tuple[str, list[Message]]:
    system = f"""\
You are Medha, preparing the answer key and marking notes for a Bihar BSEB \
question paper that a government-school teacher will grade by hand.

{language_instruction(language)}

You are given the paper as JSON. For EVERY question in EVERY section, give the \
correct answer and a short solution / marking note.

Return ONLY a JSON object -- no prose, no markdown fences:
{{
  "sections": [
    {{
      "name": "<section name, copied verbatim from the paper>",
      "answers": [
        {{
          "number": <the question's position within this section, starting at 1>,
          "answer": "the correct answer -- for MCQ give the correct option letter AND its text; for short/long give a concise model answer; for a case study answer each sub-part",
          "solution": "1-3 lines: the working for a numerical, the key points an examiner looks for, or how to split the marks"
        }}
      ]
    }}
  ]
}}

Rules:
  - One "answers" entry per question, in paper order; "number" restarts at 1 in each section.
  - Be correct and specific. Show the calculation for any numerical question.
  - Keep each entry tight -- this is a teacher's key, not a textbook.
"""
    ask = "Paper JSON:\n" + json.dumps(paper, ensure_ascii=False)
    return system, [Message(role="user", content=ask)]


async def build(paper: dict, language: str) -> dict:
    """Validate the paper, ask the LLM for a key, return validated key JSON."""
    content = QuestionPaperContent.model_validate(paper or {})
    system, messages = _prompt(content.model_dump(mode="json"), language)

    client = get_llm_client()
    try:
        completion = await client.complete(
            system=system, messages=messages, max_tokens=_MAX_TOKENS
        )
    except LLMError:
        logger.warning("answer_key llm call failed", exc_info=True)
        raise

    parsed = _extract_json(completion.text)
    if not parsed or not isinstance(parsed.get("sections"), list):
        raise ValueError("answer key response was not valid JSON")
    return AnswerKey.model_validate(parsed).model_dump(mode="json")
