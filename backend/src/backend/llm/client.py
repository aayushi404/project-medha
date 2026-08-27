"""Vendor-neutral LLM interface. Generation code (chat/service.py, generators)
depends only on this module -- never on the `anthropic` SDK directly."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass


class LLMError(RuntimeError):
    """Raised for any upstream LLM failure so callers don't import the SDK."""


@dataclass
class Message:
    role: str  # 'user' | 'assistant'
    content: str


@dataclass
class Usage:
    input_tokens: int
    output_tokens: int


@dataclass
class TokenDelta:
    """A chunk of streamed assistant text."""

    text: str


@dataclass
class StreamEnd:
    """Terminal event of a stream, carrying the final token accounting."""

    usage: Usage


StreamEvent = TokenDelta | StreamEnd


@dataclass
class Completion:
    text: str
    usage: Usage


class LLMClient(ABC):
    @abstractmethod
    def stream(
        self, *, system: str, messages: list[Message], max_tokens: int = 4096
    ) -> AsyncIterator[StreamEvent]:
        """Async-generate: yield TokenDelta objects, then exactly one StreamEnd."""
        ...

    @abstractmethod
    async def complete(
        self, *, system: str, messages: list[Message], max_tokens: int = 512
    ) -> Completion:
        """One-shot, non-streamed generation (used for short calls, e.g. titles)."""
        ...
