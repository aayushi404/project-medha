import logging
import time
from collections.abc import AsyncIterator

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.core.config import settings
from backend.llm.client import (
    Completion,
    LLMClient,
    LLMError,
    LLMRateLimitError,
    Message,
    StreamEnd,
    TokenDelta,
    Usage,
)

logger = logging.getLogger("backend.llm")


def _raise_for(exc: genai_errors.APIError) -> None:
    """429 covers both plain rate limiting and quota exhaustion (Gemini
    reports both as RESOURCE_EXHAUSTED under this same status code)."""
    if exc.code == 429:
        raise LLMRateLimitError(str(exc)) from exc
    raise LLMError(str(exc)) from exc

# our Message.role -> Gemini content role
_ROLE = {"user": "user", "assistant": "model"}


def _to_contents(messages: list[Message]) -> list[types.Content]:
    return [
        types.Content(role=_ROLE.get(m.role, "user"), parts=[types.Part.from_text(text=m.content)])
        for m in messages
    ]


def _usage(meta: types.GenerateContentResponseUsageMetadata | None) -> Usage:
    if meta is None:
        return Usage(0, 0)
    return Usage(
        input_tokens=meta.prompt_token_count or 0,
        output_tokens=meta.candidates_token_count or 0,
    )


class GeminiClient(LLMClient):
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._client: genai.Client | None = None

    def _sdk(self) -> genai.Client:
        if self._client is None:
            if not self._api_key:
                raise LLMError("GEMINI_API_KEY is not configured")
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def stream(
        self, *, system: str, messages: list[Message], max_tokens: int = 4096
    ) -> AsyncIterator:
        started = time.monotonic()
        config = types.GenerateContentConfig(
            system_instruction=system, max_output_tokens=max_tokens
        )
        last_usage: Usage = Usage(0, 0)
        try:
            iterator = await self._sdk().aio.models.generate_content_stream(
                model=self._model, contents=_to_contents(messages), config=config
            )
            async for chunk in iterator:
                if chunk.text:
                    yield TokenDelta(text=chunk.text)
                if chunk.usage_metadata is not None:
                    last_usage = _usage(chunk.usage_metadata)
        except genai_errors.APIError as exc:
            logger.warning("llm_stream_error model=%s err=%s", self._model, exc)
            _raise_for(exc)

        logger.info(
            "llm_call kind=stream provider=gemini model=%s latency_ms=%d input_tokens=%d output_tokens=%d cache_hit=false",
            self._model,
            (time.monotonic() - started) * 1000,
            last_usage.input_tokens,
            last_usage.output_tokens,
        )
        yield StreamEnd(usage=last_usage)

    async def complete(
        self, *, system: str, messages: list[Message], max_tokens: int = 512
    ) -> Completion:
        started = time.monotonic()
        config = types.GenerateContentConfig(
            system_instruction=system, max_output_tokens=max_tokens
        )
        try:
            resp = await self._sdk().aio.models.generate_content(
                model=self._model, contents=_to_contents(messages), config=config
            )
        except genai_errors.APIError as exc:
            logger.warning("llm_complete_error model=%s err=%s", self._model, exc)
            _raise_for(exc)

        usage = _usage(resp.usage_metadata)
        logger.info(
            "llm_call kind=complete provider=gemini model=%s latency_ms=%d input_tokens=%d output_tokens=%d cache_hit=false",
            self._model,
            (time.monotonic() - started) * 1000,
            usage.input_tokens,
            usage.output_tokens,
        )
        return Completion(text=resp.text or "", usage=usage)


_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    global _client
    if _client is None:
        _client = GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)
    return _client
