import logging

from fastapi import HTTPException, status

from backend.llm import LLMError, LLMRateLimitError, get_llm_client
from backend.llm.prompts import translate as translate_prompt
from backend.tools.schemas import TranslateIn, TranslateOut

logger = logging.getLogger("backend.tools")

_ERR_RATE_LIMIT = "AI service limit has been reached. Please contact the app developer."


async def translate_or_simplify(payload: TranslateIn) -> TranslateOut:
    system, messages = translate_prompt.build(
        text=payload.text,
        target_language=payload.target_language,
        mode=payload.mode,
        reading_level=payload.reading_level,
    )
    client = get_llm_client()
    try:
        result = await client.complete(system=system, messages=messages, max_tokens=4096)
    except LLMRateLimitError as exc:
        logger.warning("translate_rate_limited: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _ERR_RATE_LIMIT) from exc
    except LLMError as exc:
        logger.warning("translate_failed: %s", exc)
        raise

    return TranslateOut(
        result=result.text.strip(),
        mode=payload.mode,
        target_language=payload.target_language,
    )
