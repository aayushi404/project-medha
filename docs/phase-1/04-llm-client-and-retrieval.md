# 04 — LLM Client & Retrieval

**`../phase-1.md` §7 step 6** — "`LLMClient` interface + Claude adapter, plus
retriever against pgvector."

The vendor-swap boundary. Everything generation-related (docs 05, 06) talks to
`LLMClient` and `Retriever` — never to a provider SDK or pgvector directly.

> **As built:** shipped on **Gemini** (`llm/gemini.py`, `GeminiClient`,
> `gemini-flash-lite-latest`, free tier) selected by `LLM_PROVIDER=gemini`;
> `get_llm_client()` lives in `llm/__init__.py` and picks the provider.
> `llm/claude.py` (`ClaudeClient`) is kept for a later swap. Retrieval is wired
> but **short-circuits to `[]`** until `EMBEDDING_API_KEY` is set — no
> embeddings exist yet, so generation runs ungrounded. The sections below
> describe the provider-neutral design; substitute Gemini for Claude.

## Purpose

- A thin `LLMClient` abstraction with **streaming** (`stream`) and one-shot
  (`complete`) methods, plus a Claude implementation.
- Versioned prompt builders for explanation / quiz / activity / title.
- An `Embedder` abstraction + adapter, and a `Retriever` that embeds a query
  and runs a pgvector similarity search over `textbook_content_chunks`,
  degrading gracefully when chunks have no embeddings yet.
- A one-off `embed_chunks.py` script to backfill embeddings (full ingestion
  pipeline is Phase 2).

## Files

| File | Change |
|---|---|
| `backend/src/backend/llm/__init__.py` | **new** |
| `backend/src/backend/llm/client.py` | **new** — `LLMClient` ABC, dataclasses, `get_llm_client()` |
| `backend/src/backend/llm/claude.py` | **new** — `ClaudeClient` |
| `backend/src/backend/llm/prompts/__init__.py` | **new** |
| `backend/src/backend/llm/prompts/{explanation,quiz,activity,title}.py` | **new** |
| `backend/src/backend/retrieval/__init__.py` | **new** |
| `backend/src/backend/retrieval/embedder.py` | **new** — `Embedder` ABC + `VoyageEmbedder`, `get_embedder()` |
| `backend/src/backend/retrieval/retriever.py` | **new** — `Retriever`, `RetrievedChunk` |
| `backend/src/backend/db/models/curriculum.py` | `Vector(1536)` → `Vector(1024)` (see doc 02) |
| `backend/scripts/embed_chunks.py` | **new** — backfill |
| `backend/pyproject.toml` | `anthropic`, `voyageai`, `sse-starlette` |
| `backend/.env.example` | LLM + embedding vars (doc 00 §3) |

## `llm/client.py`

```python
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass

@dataclass
class Message:
    role: str          # 'user' | 'assistant'
    content: str

@dataclass
class Usage:
    input_tokens: int
    output_tokens: int

@dataclass
class TokenDelta:
    text: str

@dataclass
class StreamEnd:
    usage: Usage

StreamEvent = TokenDelta | StreamEnd

@dataclass
class Completion:
    text: str
    usage: Usage

class LLMClient(ABC):
    @abstractmethod
    def stream(self, *, system: str, messages: list[Message],
               max_tokens: int = 2048) -> AsyncIterator[StreamEvent]: ...

    @abstractmethod
    async def complete(self, *, system: str, messages: list[Message],
                       max_tokens: int = 512) -> Completion: ...
```

`get_llm_client()` returns a module-level singleton `ClaudeClient(settings)`.

## `llm/claude.py`

- Uses `anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)`.
- `stream`: `async with client.messages.stream(model=settings.llm_model, …)` —
  yield `TokenDelta(text)` for each `text` delta; on completion yield
  `StreamEnd(Usage(...))` from the final message's `usage`.
- `complete`: `await client.messages.create(...)`, return `Completion`.
- Wrap SDK errors (`anthropic.APIError`, timeouts) in a local
  `LLMError(RuntimeError)` so callers don't import the SDK. Log one line per
  call: `llm_call model=… latency_ms=… input_tokens=… output_tokens=…
  cache_hit=false` (doc 00 §2.3).
- No ret/caching in Phase 1.

## `llm/prompts/`

Each module exposes `build(**ctx) -> tuple[str, list[Message]]` (system +
messages) and a `VERSION = "expl-v1"` string (logged with the artifact for
future prompt iteration — store it in `module_artifacts.content_json` under
`_prompt_version` for quiz/activity, and skip for explanation or add a column
later).

Shared context passed in: `grade_label`, `subject_name`, `topic_title`,
`topic_description`, `language` (`teacher.preferred_language`),
`chunks: list[str]` (retrieved textbook text), `history: list[Message]`,
`teacher_query: str`.

- **`explanation.py`** — system prompt: "You are Medha, a teaching assistant for
  Bihar (BSEB) government-school teachers. Answer in simple {language} Hindi…
  give 2–3 concrete ways to explain {topic} to {grade_label}, each with a hook,
  an analogy rooted in rural Bihar daily life, and one board-work idea. Ground
  yourself in the textbook excerpts below; if they're empty, rely on BSEB-level
  general knowledge and say so briefly." Then the chunks, then the history +
  new query.
- **`quiz.py`** — instruct a JSON-only response matching the schema in doc 06
  §quiz. 5–10 questions, mix of MCQ / short-answer / true-false, tagged
  `difficulty: easy|medium|hard`, answers included.
- **`activity.py`** — JSON-only, matching doc 06 §activity: one low-tech
  classroom activity, `materials` explicitly `["none"]` when possible, group
  size, duration, numbered steps, one variation.
- **`title.py`** — `complete()` only; "In ≤6 words, in {language}, title this
  teaching request: {teacher_query}". Fallback handled by caller.

Prompts are plain Python f-string builders (no template engine) — matches the
"don't over-engineer" note in `../phase-1.md` §3.

## `retrieval/embedder.py`

```python
class Embedder(ABC):
    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]: ...

class VoyageEmbedder(Embedder):
    # voyageai.AsyncClient; model = settings.embedding_model ("voyage-3", 1024-dim)
    # input_type="document" for chunks, "query" for the search query
    ...

def get_embedder() -> Embedder: ...   # singleton
```

**Provider choice:** default **Voyage AI `voyage-3`** (1024-dim) — Anthropic's
recommended embedding partner, keeps the stack Claude-aligned, needs the
`vector(1024)` ALTER in doc 02. Documented alternative: OpenAI
`text-embedding-3-small` (1536-dim) — no ALTER, add `openai` instead of
`voyageai`, set `EMBEDDING_DIM=1536`. The interface makes this a one-file swap.

## `retrieval/retriever.py`

```python
@dataclass
class RetrievedChunk:
    id: uuid.UUID
    content_text: str
    source_page: int | None
    distance: float

class Retriever:
    def __init__(self, embedder: Embedder): ...

    async def top_k(self, db: Session, *, topic_id: uuid.UUID, query: str,
                    k: int = 5) -> list[RetrievedChunk]:
        # 1. embed [query] with input_type="query"
        # 2. SELECT ... FROM textbook_content_chunks
        #    WHERE topic_id = :topic_id AND embedding IS NOT NULL
        #    ORDER BY embedding <=> :qvec LIMIT :k
        #    (pgvector cosine distance operator <=>)
        # 3. if zero rows -> log warning "no grounded chunks for topic %s", return []
```

- Use SQLAlchemy Core with pgvector's SQLAlchemy support
  (`from pgvector.sqlalchemy import Vector`), or raw `text()` with a bound
  vector param formatted as `'[...]'`.
- Callers (doc 05/06) pass the returned `content_text` list into the prompt and
  persist `[c.id for c in chunks]` into `chat_messages.retrieved_chunk_ids`.

## `scripts/embed_chunks.py`

- Idempotent: `SELECT * FROM textbook_content_chunks WHERE embedding IS NULL`.
- Batches through `get_embedder().embed(...)` (`input_type="document"`),
  `UPDATE ... SET embedding = :vec`.
- Prints `embedded N chunks`. Usage mirrors `seed_phase0.py`'s docstring
  (`uv run python scripts/embed_chunks.py`, `DATABASE_URL` override supported).

## Key decisions

- **`stream` yields typed events, not raw strings** — so the final `usage` (for
  `token_count` + cost logging) rides the same channel; the router just
  forwards `TokenDelta.text` to the client and captures `StreamEnd.usage`.
- **Retrieval degrades to ungrounded generation** — the seed DB has one chunk
  with no embedding and the doc 02 seed adds chapters with none. Blocking on
  ingestion would block the whole demo. The prompt is told when grounding is
  absent.
- **Async SDKs throughout** — SSE streaming (doc 05) needs an async handler;
  `AsyncAnthropic` + `voyageai.AsyncClient` keep the request non-blocking. DB
  access stays sync `Session` (the codebase is sync SQLAlchemy) — acceptable
  for Phase 1 load; note as a Phase 2 revisit.
- **Prompts are versioned strings in-repo** — no DB-backed prompt store yet.

## How to test

1. `uv sync`; set `ANTHROPIC_API_KEY` and `EMBEDDING_API_KEY` in `backend/.env`.
2. `uv run python scripts/embed_chunks.py` → `embedded 1 chunks` (the
   photosynthesis chunk); re-run → `embedded 0 chunks`.
3. Scratch script / `python -c`:
   ```python
   import asyncio
   from backend.retrieval.embedder import get_embedder
   from backend.retrieval.retriever import Retriever
   from backend.db.session import SessionLocal
   ...
   chunks = asyncio.run(Retriever(get_embedder()).top_k(
       db, topic_id=<photosynthesis topic id>, query="how do plants make food"))
   assert chunks and "chlorophyll" in chunks[0].content_text
   ```
4. LLM smoke:
   ```python
   from backend.llm.client import get_llm_client, Message
   c = get_llm_client()
   async for ev in c.stream(system="Reply in one word.",
                            messages=[Message("user","Say hi")]):
       print(ev)
   ```
   → several `TokenDelta` then one `StreamEnd` with non-zero `output_tokens`.
5. `top_k` for a topic with no embedded chunks → `[]` + a logged warning, no
   exception.
