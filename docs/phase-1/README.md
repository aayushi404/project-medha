# Phase 1 — Implementation Docs

Design docs for **Phase 1: the core text-based teaching assistant** of Medha.
Each doc covers one build-order step from
[`../phase-1.md`](../phase-1.md) §7, trimmed to the locked Phase 1 scope, plus
the three presentation-layer screens.

**Read [`00-overview.md`](00-overview.md) first** — it holds the locked
decisions (kit→module rename, backend layout, text-only scope), the
cross-cutting rules (auth/ownership, rate limiting, error shape, logging), the
new env vars, and the Phase 2 backlog.

| # | Doc | Covers |
|---|---|---|
| 00 | [overview](00-overview.md) | scope, decisions, cross-cutting rules, env, deps |
| 01 | [skeleton-hardening](01-skeleton-hardening.md) | Pydantic Settings, global error shape, request-id logging |
| 02 | [phase1-schema](02-phase1-schema.md) | `chat_sessions`, `chat_messages`, `modules`, `module_artifacts`, `module_feedback` + migration + seed |
| 03 | [curriculum-and-profile-api](03-curriculum-and-profile-api.md) | `GET /curriculum/{chapters,topics}`, `GET/PATCH /profile` |
| 04 | [llm-client-and-retrieval](04-llm-client-and-retrieval.md) | `LLMClient` + Claude adapter, prompts, `Embedder` + pgvector `Retriever`, `embed_chunks.py` |
| 05 | [chat-loop-and-explanation](05-chat-loop-and-explanation.md) | `/chat/sessions*`, SSE `/messages`, `ExplanationGen`, Module upsert |
| 06 | [quiz-activity-and-modules-library](06-quiz-activity-and-modules-library.md) | SSE `/generate` (quiz, activity), `/modules` list/detail/delete, `/modules/{id}/feedback` |
| 07 | [frontend-app-shell](07-frontend-app-shell.md) | `(app)/` sidebar shell, `useLessonContext`, `lib/api` + `lib/sse` + `lib/copy` |
| 08 | [frontend-dashboard-chat](08-frontend-dashboard-chat.md) | `/dashboard` — context bar, quick actions, streamed thread, artifact cards |
| 09 | [frontend-my-modules](09-frontend-my-modules.md) | `/modules` list + `/modules/[id]` detail + feedback + delete |

## Coding sequence

01 → 02 → 03 → 04 → 05 → 06 (backend complete) → 07 → 08 → 09.

Backend steps 01–05 give an API-only streamed assistant; 06 completes the
backend; 07–09 deliver the Dashboard and My Modules screens.

## Out of scope (Phase 2+)

PPT, mindmap, PDF export, `/modules/{id}/download`, Redis caching, RQ job queue
+ `generation_jobs` + `/jobs/{id}`, full textbook ingestion pipeline,
`Translator` adapter, voice. Details in [`00-overview.md`](00-overview.md) §5.
