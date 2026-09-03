# Teacher voice assistant — design & implementation plan

Productionises the teacher-facing voice conversation with Medha. Sarvam AI is
already wired for STT (`saaras:v3`) and TTS (`bulbul:v3`); this plan fixes *how
Medha answers when spoken to*, pipelines the audio path for low latency, gives
the conversation memory, and makes the whole thing safe to put in front of real
teachers. Student voice is explicitly out of scope here.

---

## 1. Where we are today

| Piece | File | State |
|---|---|---|
| STT proxy | `backend/src/backend/speech/router.py` → `client.transcribe` | Works. Multipart audio → Sarvam `/speech-to-text`, returns `{transcript, language_code}`. 10 MB cap, codec sniffing, `en-IN`/`hi-IN`/auto mapping, good error copy. |
| TTS proxy | same → `client.synthesize` | Works. JSON `{text, language, accent}` → Sarvam `/text-to-speech`, returns **one** base64 WAV. Speaker `shubh`; Bihari = speaker `ritu` @ `pace 0.92`. Text capped 2500. |
| Voice panel | `shiksha_sathi/components/voice/voice-chat-panel.tsx` | Dialog + FAB (`VoiceChatLauncher`). States idle/listening/thinking/speaking. Push-to-talk (`VoiceRecorder`) + hands-free (`ContinuousVoiceListener`, RMS VAD: silence 0.018, 1400 ms → stop, 20 s max). Browser Web Speech / `speechSynthesis` fallbacks. |
| Client audio prep | `shiksha_sathi/lib/speech-input.ts` | Decodes mic capture → 16 kHz mono WAV via `OfflineAudioContext`. |
| Wiring | `dashboard/page.tsx:260` | Voice launcher posts the transcript to **`/chat/sessions/{id}/messages`** — the *same* endpoint as typed chat. |

### What is actually broken

1. **Wrong response shape.** Voice reuses `llm/prompts/explanation.py`, whose
   contract is "2–3 teaching approaches, each with a hook, a rural analogy, a
   blackboard action, then a misconception" — a wall of markdown with lists and
   headings. Spoken aloud this is unbearable, and the client only reads
   `reply.slice(0, 800)` so it also cuts off mid-sentence.
2. **Latency stack, nothing pipelined.** Full clip upload → full STT → full LLM
   stream buffered → full TTS synth → base64 → decode → `new Audio().play()`.
   First audio realistically lands 5–15 s after the teacher stops talking.
3. **No conversation memory in the UI.** The panel keeps local `messages` only,
   never hydrates prior turns. The shared `chat_session` also interleaves long
   typed explanations and artifact ack-lines ("Quiz ready — 5 questions.") into
   what would become voice context.
4. **No barge-in.** Medha cannot be interrupted except via the stop button.
5. **Not hardened.** `/speech/*` has *no* rate limit (chat does), a new
   `httpx.AsyncClient` per request (no pooling), no retry/circuit-breaker, no
   per-turn metering, no cost ceiling on the arbitrary-length `/synthesize`
   text, no observability, no kill switch.
6. **Fake feedback.** `VoiceWaveform` is a CSS animation, not real mic
   amplitude; no interim transcript while listening.

---

## 2. Interaction design (teacher)

**Persona:** Medha is *a colleague in the staff room* — not a narrator, not a
textbook. A teacher between two periods, chalk in hand, asks her something the
way they'd ask another teacher.

### Modes

- **Push-to-talk** (default; robust in a noisy classroom): tap mic → speak →
  tap to send.
- **Hands-free conversation**: tap once, talk naturally; Medha replies aloud and
  re-opens the mic. End by tapping the mic or saying a stop word
  («बस» / «रुको» / "stop").

### Turn lifecycle & affordances

| State | Shown | Target |
|---|---|---|
| `idle` | "Tap and ask me anything about your lesson." If a chapter is set: "You're on **‹chapter›**. What do you want to work through?" | — |
| `listening` | **Real** waveform from `AnalyserNode` amplitude + **interim transcript** forming live | — |
| `thinking` | "Medha soch rahi hai…" + pulse | first audio **< 1.5 s** after mic stop (Phase B) |
| `speaking` | waveform + **running caption** (sentence being spoken, highlighted); **barge-in** armed | — |
| after speaking | hands-free → back to `listening` after 300 ms grace; PTT → `idle` | — |

### In-conversation controls (spoken or tapped)

- "फिर से बोलो" / "say that again" → replay last TTS (served from cache).
- "धीरे" / "slower" → drop `pace` for the rest of the session.
- "छोटा जवाब" / "keep it short" → Medha holds replies to ≤ 2 sentences.
- "in English" / "हिंदी में" → switch reply language mid-conversation.
- Per Medha turn in the transcript: **replay**, **copy**, **"Turn into a full
  lesson"** (re-runs the same ask through the existing `explanation` pipeline and
  drops the rich markdown module onto the dashboard — voice stays short, depth is
  one tap away).

### Honest fallbacks

| Failure | Behaviour |
|---|---|
| Mic permission denied | Inline "how to enable the mic" + focus the text composer |
| Sarvam STT down / circuit open | "I can't hear you right now — type instead?" + composer; try browser Web Speech if present |
| Sarvam TTS down | Show the caption text, speak it with browser `speechSynthesis` silently, badge "using a basic voice" |
| `voice_enabled=false` (kill switch) | FAB hidden |

---

## 3. How Medha should *sound* — the core change

New prompt builder **`backend/src/backend/llm/prompts/voice.py`**,
`VERSION = "voice-v1"`, separate from `explanation.py`. Same *substance* as the
explanation prompt (Bihar-rooted analogy, one blackboard action, the common
misconception) but **delivered one piece per turn across a dialogue** instead of
dumped at once.

System-prompt rules:

- **Speak, don't write.** No markdown, no headings, no bullet or numbered lists.
  Sequence in words: "पहले… फिर… उसके बाद…".
- **One breath, one idea.** Default 2–4 short sentences (~40–70 words, ~15–25 s
  of audio). Longer *only* if the teacher explicitly asks to go deep.
- **Turn-taking.** End most turns with a short hook back to the teacher
  ("वो analogy बताऊँ जो मैं इस्तेमाल करती?" / "Want a question to open the class
  with?") so it's a conversation, not a monologue.
- **Acknowledge, then answer.** 2–3 word receipt ("अच्छा, समझ गई.") before the
  substance.
- **Spoken register.** Natural conversational Hindi / Bihari, respectful «आप»,
  contractions, "चलिए / देखिए / मान लीजिए". Numbers and units as words
  ("तीन गुना", not "3x"); no symbols (`%`, `→`, `x`).
- **No meta.** Never "As an AI…", never name the format, never "here is a list".

Generation params for the voice path:

- `max_tokens ≈ 180` normal · `≈ 400` when session `reply_style = "detail"`.
- Pass `reply_style` ("normal" | "short" | "detail") + the rolling
  `voice_summary` (see §4) into `build()`.
- Light prosody in V1: keep Sarvam `pace` (0.9 Bihari), and post-process a comma
  pause after the acknowledgement clause. Full SSML deferred.

`language_instruction()` in `llm/prompts/__init__.py` already has a
`hi-BiharBoli` entry — voice-v1 reuses it and adds the "spoken, no lists,
short" clauses.

---

## 4. Conversation history — store it, but separate from typed chat

**Decision:** reuse `chat_sessions` for scoping/ownership, add a dedicated
`voice_turns` table + per-session voice state. Typed `chat_messages` is left
untouched so long explanations and ack-lines never leak into voice context and
vice-versa.

### Migration `00XX_voice_turns.py`

```
create table voice_turns (
    id               uuid pk default uuid_generate_v4(),
    session_id       uuid not null references chat_sessions(id) on delete cascade,
    user_transcript  text not null,
    assistant_text   text not null,
    stt_language     text,
    stt_confidence   real,
    barge_in         boolean not null default false,
    stt_ms           int,
    llm_ms           int,
    tts_ms           int,
    tokens_in        int,
    tokens_out       int,
    tts_chars        int,
    created_at       timestamptz not null default now()
);
create index idx_voice_turns_session on voice_turns(session_id, created_at);

alter table chat_sessions
    add column voice_summary     text,
    add column voice_reply_style text not null default 'normal',
    add column voice_language    text;
```

### Context assembly per turn

`system(voice-v1)` + `voice_summary` + **last 6 `voice_turns`** + new transcript.
After a turn, if `voice_turns` since the last summary > 8, run one cheap
`client.complete()` summarise call and refresh `voice_summary`.

### Retention & privacy

- **No audio is ever persisted** — STT/TTS clips are transient in memory only.
  State this in the UI ("Medha doesn't keep recordings").
- Transcripts kept 90 days for the teacher's own review + prompt tuning, then a
  nightly job nulls `user_transcript` / `assistant_text` and keeps only metrics.
- "Clear voice history" control in teacher settings → hard-deletes the
  teacher's `voice_turns`.

---

## 5. Backend implementation

### 5.1 New streaming endpoint — `POST /speech/converse` (SSE)

Body: `{ session_id, transcript?, language?, style? }` (audio may also be sent as
multipart for a one-call STT+converse; transcript path is primary — the client
already has interim STT).

Generator:

1. If audio present → `client.transcribe`; else use `transcript`.
2. Persist a stub `voice_turn` (so a dropped connection still records the ask).
3. Build context (§4) → `client.stream(system, messages, max_tokens=voice cap)`.
4. **Sentence-chunk the token stream**; for each completed sentence fire a
   Sarvam TTS call and emit:
   - `event: token` → `{ text }` (caption, immediate)
   - `event: audio` → `{ seq, b64, mime }` (per-sentence clip, as it's ready)
   - `event: done` → `{ turn_id, llm_ms, tts_ms, tokens }`
   - `event: error` → `{ message, fallback: "type_instead" | "browser_tts" | "retry" }`
5. On completion, finalise the `voice_turn` row + refresh summary if due.

This pipelines LLM and TTS so first audio ≈ first sentence latency, not full
answer latency.

`/speech/transcribe` and `/speech/synthesize` stay as-is (English/pronunciation
features + fallback).

### 5.2 Sarvam client hardening — `speech/client.py`

- **Module-level shared `httpx.AsyncClient`** with a connection pool and tuned
  `Timeout(connect=5, read=30, write=10, pool=5)`; close on app shutdown.
- **1 retry** with jitter on `httpx.TimeoutException` / 5xx.
- **Circuit breaker**: after N consecutive Sarvam failures, open for M seconds →
  `/converse` immediately emits `error{fallback:"browser_tts"|"type_instead"}`
  instead of hanging.
- **TTS cache**: in-process LRU (later Redis) keyed by
  `(text, speaker, pace, language)` for canned lines (greetings, "say that
  again", every error prompt). Skip for dynamic replies.

### 5.3 Limits, metering, config

- **Rate limit** `/speech/*` mirroring `chat/rate_limit.py`: e.g. 20 voice
  turns/min and 400/day per teacher; reject audio clips > 30 s **before**
  calling Sarvam; cap `transcript` length.
- **Cost ceiling**: monthly TTS-character budget per teacher
  (`voice_tts_char_budget_monthly`); over budget → browser TTS only.
- **Metering**: the per-turn `*_ms` / `tokens` / `tts_chars` columns + a nightly
  rollup table for a cost dashboard.
- **Structured logs**: add `request_id`, `session_id`, `turn_id`, stage timings,
  Sarvam status to the existing `backend.speech` logger.
- **New settings** (`core/config.py`): `voice_enabled` (kill switch),
  `voice_max_reply_tokens`, `voice_detail_reply_tokens`,
  `voice_turn_rate_limit_per_min` / `_per_day`, `voice_tts_char_budget_monthly`,
  `voice_summary_every_n_turns`.
- `GET /speech/config` → `{ voice_enabled, char_budget_remaining }` for the FE.

### 5.4 History API

- `GET /speech/sessions/{id}/turns?limit=20` → recent `voice_turns` for panel
  hydration.
- `DELETE /speech/sessions/{id}/turns` and `DELETE /speech/voice-history`
  (all sessions) for the "clear" control.

---

## 6. Frontend implementation

- **`VoiceChatPanel` consumes `/speech/converse` SSE.** Play `audio` frames
  through a **gapless Web Audio queue** (`AudioBufferSourceNode` scheduled
  back-to-back) while rendering `token` captions with sentence highlighting.
- **Barge-in.** Keep an `AnalyserNode` RMS monitor running *during* `speaking`;
  on sustained voice over the calibrated threshold → stop playback, flush the
  queue, mark the turn `barge_in`, go to `listening`. Depends on
  `echoCancellation` + ducking Medha's output; if unreliable on the device, fall
  back to the explicit stop button only.
- **Interim transcript.** Show partial text while listening — browser interim
  results where available, else a typing shimmer.
- **Real waveform.** Drive `VoiceWaveform` from `AnalyserNode` amplitude.
- **Adaptive VAD.** Calibrate the silence threshold from ~500 ms of ambient
  noise on start; raise `SILENCE_MS` in loud rooms.
- **History hydrate.** On open, call `GET /speech/sessions/{id}/turns`.
- **Mobile.** Unlock `AudioContext` on the first mic tap (iOS Safari gesture
  requirement); keep the `audio/mp4` recording branch.
- **Network resilience.** SSE reconnect with `Last-Event-ID` to resume the
  caption stream; if `audio` frames stall > 3 s, speak the rest of the caption
  with browser TTS.
- **Kill switch.** Hide the FAB when `/speech/config` returns
  `voice_enabled=false`.
- **A11y.** Captions always rendered; `Space` = push-to-talk, `Esc` = stop;
  `aria-live="polite"` on the caption region.
- **Client telemetry.** Beacon `mic-stop → first-caption` and
  `first-caption → first-audio` to `/telemetry/voice` for the latency dashboard.

---

## 7. QA & rollout

- **Golden-set eval** (CI, against recorded fixtures / Sarvam sandbox): 30–40
  teacher questions — clean Hindi, Bihari, code-mixed, classroom noise. Assert:
  STT WER under threshold, reply ≤ length cap, **zero markdown / list markers**,
  first-audio latency budget, language honoured.
- **Load test** `/speech/converse` for concurrent SSE streams within the Render
  instance's limits.
- **Dashboards**: p50/p95 first-audio latency, STT failure rate, TTS char spend
  vs budget, barge-in rate, turn-abandonment rate.
- **Staged rollout** behind `voice_enabled` + a per-teacher flag: internal → ~5
  pilot teachers → all.

---

## 8. Phasing

| Phase | Scope | Outcome |
|---|---|---|
| **A — make it bearable** (~1 wk) | `voice-v1` prompt + token cap; `/speech/converse` **non-pipelined** (STT→full LLM→full TTS) but on the voice prompt; shared httpx client; `/speech/*` rate limit; `voice_turns` table + history hydrate + honest fallbacks; per-turn timings logged | Medha gives short, spoken, list-free answers with memory. Latency still ~4–8 s. |
| **B — make it fast** (~1 wk) | sentence-chunked LLM→TTS pipelining with `audio` SSE frames; gapless Web Audio playback; real waveform + interim transcript; canned-line TTS cache | First audio < 1.5 s; feels responsive. |
| **C — make it feel human** (~1 wk) | barge-in; adaptive VAD; rolling `voice_summary`; "shorter / slower / in English" voice commands; "Turn into a full lesson"; comma-pause prosody | Natural back-and-forth. |
| **D — harden** (ongoing) | circuit breaker; golden-set eval in CI; cost + latency dashboards; retention job; staged-rollout flags | Safe for all pilot teachers. |

---

## 9. Open questions

1. Does the Sarvam plan allow **partial/streaming STT**? If yes, we can show a
   true live transcript and shave STT latency; if not, interim stays
   browser-only.
2. Sarvam TTS **latency per sentence** at our text sizes — measure before
   committing to the per-sentence pipeline granularity (may need to chunk on
   clause, or batch 2 short sentences).
3. Redis availability on Render — needed for a cross-instance TTS cache and
   shared rate-limit counters; in-process is fine for a single instance.
4. Confirm the 90-day transcript retention with whoever owns data policy for the
   pilot.
