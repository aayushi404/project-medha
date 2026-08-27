import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.retrieval.embedder import QUERY, Embedder, get_embedder

logger = logging.getLogger("backend.retrieval")

_SEARCH_SQL = text(
    """
    select id, content_text, source_page,
           embedding <=> cast(:qvec as vector) as distance
    from textbook_content_chunks
    where topic_id = cast(:topic_id as uuid)
      and embedding is not null
    order by distance
    limit :k
    """
)


@dataclass
class RetrievedChunk:
    id: uuid.UUID
    content_text: str
    source_page: int | None
    distance: float


def _to_vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


class Retriever:
    def __init__(self, embedder: Embedder | None = None) -> None:
        self._embedder = embedder or get_embedder()

    async def top_k(
        self, db: Session, *, topic_id: uuid.UUID, query: str, k: int = 5
    ) -> list[RetrievedChunk]:
        """Embed `query` and return the k nearest textbook chunks for `topic_id`
        by cosine distance. Returns [] (and logs a warning) when the topic has
        no embedded chunks -- generation then proceeds ungrounded.

        Phase 1: while EMBEDDING_API_KEY is unset there are no embeddings yet,
        so this short-circuits to [] without calling the embedder. Set the key
        and run scripts/embed_chunks.py to enable grounding."""
        if not settings.embedding_api_key:
            logger.info("retrieval disabled (no EMBEDDING_API_KEY); proceeding ungrounded")
            return []
        (qvec,) = await self._embedder.embed([query], input_type=QUERY)
        rows = db.execute(
            _SEARCH_SQL,
            {"qvec": _to_vector_literal(qvec), "topic_id": str(topic_id), "k": k},
        ).all()
        if not rows:
            logger.warning("retrieval: no embedded chunks for topic %s", topic_id)
            return []
        return [
            RetrievedChunk(
                id=r.id,
                content_text=r.content_text,
                source_page=r.source_page,
                distance=float(r.distance),
            )
            for r in rows
        ]
