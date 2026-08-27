"""Embedding provider behind an interface.

Default: Voyage AI voyage-3 (1024-dim), Anthropic's recommended partner.
Swap point: to use OpenAI text-embedding-3-small (1536-dim) instead, add an
OpenAIEmbedder here, set EMBEDDING_DIM=1536, and revert the vector-column
change from alembic migration 0003_phase1.
"""

import logging
from abc import ABC, abstractmethod

import voyageai

from backend.core.config import settings

logger = logging.getLogger("backend.retrieval")

# Voyage input_type values: "query" for a search query, "document" for stored text.
QUERY = "query"
DOCUMENT = "document"


class EmbeddingError(RuntimeError):
    pass


class Embedder(ABC):
    @property
    @abstractmethod
    def dim(self) -> int: ...

    @abstractmethod
    async def embed(self, texts: list[str], *, input_type: str) -> list[list[float]]: ...


class VoyageEmbedder(Embedder):
    def __init__(self, *, api_key: str, model: str, dim: int) -> None:
        self._api_key = api_key
        self._model = model
        self._dim = dim
        self._client: voyageai.AsyncClient | None = None

    def _sdk(self) -> voyageai.AsyncClient:
        if self._client is None:
            if not self._api_key:
                raise EmbeddingError("EMBEDDING_API_KEY is not configured")
            self._client = voyageai.AsyncClient(api_key=self._api_key)
        return self._client

    @property
    def dim(self) -> int:
        return self._dim

    async def embed(self, texts: list[str], *, input_type: str) -> list[list[float]]:
        if not texts:
            return []
        try:
            result = await self._sdk().embed(texts, model=self._model, input_type=input_type)
        except EmbeddingError:
            raise
        except Exception as exc:  # voyageai raises plain exceptions
            logger.warning("embed_error model=%s err=%s", self._model, exc)
            raise EmbeddingError(str(exc)) from exc
        return result.embeddings


_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = VoyageEmbedder(
            api_key=settings.embedding_api_key,
            model=settings.embedding_model,
            dim=settings.embedding_dim,
        )
    return _embedder
