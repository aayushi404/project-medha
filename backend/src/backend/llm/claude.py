import logging
import time
from collections.abc import AsyncIterator

import anthropic

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


def _to_anthropic(messages: list[Message]) -> list[dict]:
    return [{"role": m.role, "content": m.content} for m in messages]


class ClaudeClient(LLMClient):
    def __init__(self, *, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._client: anthropic.AsyncAnthropic | None = None

    def _sdk(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            if not self._api_key:
                raise LLMError("ANTHROPIC_API_KEY is not configured")
            self._client = anthropic.AsyncAnthropic(api_key=self._api_key)
        return self._client

    async def stream(
        self, *, system: str, messages: list[Message], max_tokens: int = 4096
    ) -> AsyncIterator:
        started = time.monotonic()
        try:
            async with self._sdk().messages.stream(
                model=self._model,
                system=system,
                messages=_to_anthropic(messages),
                max_tokens=max_tokens,
            ) as stream:
                async for event in stream:
                    if event.type == "text":
                        yield TokenDelta(text=event.text)
                final = await stream.get_final_message()
        except anthropic.RateLimitError as exc:
            logger.warning("llm_stream_rate_limited model=%s err=%s", self._model, exc)
            raise LLMRateLimitError(str(exc)) from exc
        except anthropic.AnthropicError as exc:
            logger.warning("llm_stream_error model=%s err=%s", self._model, exc)
            raise LLMError(str(exc)) from exc

        usage = Usage(final.usage.input_tokens, final.usage.output_tokens)
        logger.info(
            "llm_call kind=stream model=%s latency_ms=%d input_tokens=%d output_tokens=%d cache_hit=false",
            self._model,
            (time.monotonic() - started) * 1000,
            usage.input_tokens,
            usage.output_tokens,
        )
        yield StreamEnd(usage=usage)

    async def complete(
        self, *, system: str, messages: list[Message], max_tokens: int = 512
    ) -> Completion:
        started = time.monotonic()
        try:
            resp = await self._sdk().messages.create(
                model=self._model,
                system=system,
                messages=_to_anthropic(messages),
                max_tokens=max_tokens,
            )
        except anthropic.RateLimitError as exc:
            logger.warning("llm_complete_rate_limited model=%s err=%s", self._model, exc)
            raise LLMRateLimitError(str(exc)) from exc
        except anthropic.AnthropicError as exc:
            logger.warning("llm_complete_error model=%s err=%s", self._model, exc)
            raise LLMError(str(exc)) from exc

        text = "".join(b.text for b in resp.content if b.type == "text")
        usage = Usage(resp.usage.input_tokens, resp.usage.output_tokens)
        logger.info(
            "llm_call kind=complete model=%s latency_ms=%d input_tokens=%d output_tokens=%d cache_hit=false",
            self._model,
            (time.monotonic() - started) * 1000,
            usage.input_tokens,
            usage.output_tokens,
        )
        return Completion(text=text, usage=usage)


_client: ClaudeClient | None = None


def get_claude_client() -> ClaudeClient:
    global _client
    if _client is None:
        _client = ClaudeClient(api_key=settings.anthropic_api_key, model=settings.llm_model)
    return _client
