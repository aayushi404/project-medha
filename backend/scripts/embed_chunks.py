"""Backfill embeddings for textbook_content_chunks rows that don't have one.

This is the minimal Phase 1 ingestion path -- the full chunk-and-embed pipeline
(scripts/ingest_textbook.py) is Phase 2. Idempotent: only touches rows where
embedding is null.

Usage:
    uv run python scripts/embed_chunks.py
    DATABASE_URL=<url> uv run python scripts/embed_chunks.py   (needs EMBEDDING_API_KEY)
"""

import asyncio
import sys

from sqlalchemy import text

from backend.db.session import SessionLocal, engine
from backend.retrieval.embedder import DOCUMENT, EmbeddingError, get_embedder
from backend.retrieval.retriever import _to_vector_literal

_BATCH = 64


async def run() -> None:
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                "select id, content_text from textbook_content_chunks "
                "where embedding is null order by created_at"
            )
        ).all()
        if not rows:
            print("embedded 0 chunks (nothing to do)")
            return

        embedder = get_embedder()
        done = 0
        for i in range(0, len(rows), _BATCH):
            batch = rows[i : i + _BATCH]
            vecs = await embedder.embed([r.content_text for r in batch], input_type=DOCUMENT)
            for r, v in zip(batch, vecs, strict=True):
                db.execute(
                    text(
                        "update textbook_content_chunks set embedding = cast(:v as vector) "
                        "where id = cast(:id as uuid)"
                    ),
                    {"v": _to_vector_literal(v), "id": str(r.id)},
                )
            done += len(batch)
            print(f"  {done}/{len(rows)}")
        db.commit()
        print(f"embedded {done} chunks")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    try:
        asyncio.run(run())
    except EmbeddingError as exc:
        sys.exit(f"error: {exc}")


if __name__ == "__main__":
    main()
