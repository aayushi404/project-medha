"""LLM package. Import the interface + factory from here:

    from backend.llm import LLMClient, Message, get_llm_client

The concrete provider is chosen by settings.llm_provider ("gemini" now,
"claude" available). Generation code never imports gemini.py / claude.py.
"""

from backend.core.config import settings
from backend.llm.client import (
    Completion,
    LLMClient,
    LLMError,
    LLMRateLimitError,
    Message,
    StreamEnd,
    StreamEvent,
    TokenDelta,
    Usage,
)

__all__ = [
    "LLMClient",
    "LLMError",
    "LLMRateLimitError",
    "Message",
    "Usage",
    "TokenDelta",
    "StreamEnd",
    "StreamEvent",
    "Completion",
    "get_llm_client",
]


def get_llm_client() -> LLMClient:
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        from backend.llm.gemini import get_gemini_client

        return get_gemini_client()
    if provider == "claude":
        from backend.llm.claude import get_claude_client

        return get_claude_client()
    raise LLMError(f"unknown llm_provider: {settings.llm_provider!r}")
