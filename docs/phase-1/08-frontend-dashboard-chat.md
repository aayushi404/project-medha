# 08 — Dashboard Chat Screen

Rebuilds `/dashboard` from `../teacher_dashboard_home_wireframe.html` into the
working chat surface — "the single screen most of the product's value sits
behind" (`../phase-0.md` §9).

## Purpose

Context selectors + greeting/empty state + quick actions + a streamed
conversation thread. Sending a message or hitting a quick action creates (or
reuses) a `chat_session` and streams the result via `lib/sse.ts`, rendering
explanation as markdown and quiz/activity as structured cards.

## Files

| File | Change |
|---|---|
| `app/(protected)/(app)/dashboard/page.tsx` | **rewrite** (moved from `(protected)/dashboard/` in doc 07) |
| `components/dashboard/quick-actions.tsx` | **new** — the 4 action cards |
| `components/dashboard/message-thread.tsx` | **new** — bubble list + autoscroll |
| `components/dashboard/artifact-card.tsx` | **new** — renders quiz / activity `content_json` |
| `components/dashboard/composer.tsx` | **new** — input bar + send |
| `components/app/context-bar.tsx` | from doc 07 — wired here |

## Layout (top → bottom)

1. **Context bar** (`context-bar.tsx`) — Class / Subject / Chapter selects
   (`@base-ui/react` Select, styled like the wireframe pills). Values from
   `useLessonContext()`:
   - **Class** + **Subject** options come from `options.pairs` (`/profile`
     subject/grade pairs). Selecting a Class filters Subject to pairs for that
     grade (and vice-versa). `setGradeSubject(gradeId, subjectId)`.
   - **Chapter** options from `options.chapters`; `setChapter(id)`.
   - Topic: the wireframe shows Class/Subject/Chapter only. Derive `topicId`
     automatically = the chapter's first topic (from `getTopics`), or add a 4th
     "Topic" select if a chapter has >1 topic. Keep it optional — sessions work
     without a topic (ungrounded, doc 05).
   - The bar is sticky; on mobile it scrolls horizontally (wireframe wraps).
2. **Thread area** (`flex-1`, scrolls):
   - **Empty state** (no messages yet): centered greeting
     `copy.greeting(firstName)` + `copy.greetingSub`, then `<QuickActions/>`.
   - **Non-empty:** `<MessageThread/>`.
3. **Composer** (`composer.tsx`) — bordered input, Hindi placeholder
   (`copy.inputPlaceholder`), `Send` icon button. Enter submits; Shift+Enter
   newline. Disabled while a stream is in flight.

Keep the `motion` enter animation on the greeting block (match
`dashboard/page.tsx`'s current `initial/animate`).

## State (in `page.tsx`)

```ts
const { gradeId, subjectId, chapterId, topicId } = useLessonContext();
const [sessionId, setSessionId] = useState<string | null>(null);
const [messages, setMessages] = useState<UiMessage[]>([]);   // {id, role, content, streaming?}
const [artifacts, setArtifacts] = useState<Record<string, ArtifactPayload>>({}); // by artifact_type
const [busy, setBusy] = useState(false);
const abortRef = useRef<AbortController | null>(null);
```

- **Changing the lesson context resets the conversation** (`sessionId=null`,
  `messages=[]`, `artifacts={}`) — a new context is a new topic. Confirm-free;
  the old module is already saved.
- `UiMessage` for a streaming assistant turn: append a placeholder with
  `streaming:true`, mutate its `content` on each `onToken`, clear the flag on
  `onDone`.

## Send flow

```
ensureSession():
  if sessionId -> return it
  requires gradeId && subjectId (else toast "Pehle class aur subject chuno")
  const s = await createSession(token, { grade_id, subject_id,
             chapter_id: chapterId, topic_id: topicId })
  setSessionId(s.id); return s.id

onSend(text):
  setBusy(true)
  const id = await ensureSession()
  push user msg; push empty assistant msg (streaming)
  await streamGeneration(`/chat/sessions/${id}/messages`, { content: text }, token, {
    onToken: t => appendToLastAssistant(t),
    onDone: p => { finishAssistant(); rememberModule(p.module_id) },
    onError: m => { markAssistantFailed(m); toast.error(m) },
  }, abortRef.current.signal)
  setBusy(false)
```

## Quick actions (`quick-actions.tsx`)

Grid of cards from the wireframe. **Phase 1 status:**

| Card | Phase 1 | Action |
|---|---|---|
| Padhane ka tareeka (Teaching approach) | ✅ active | sends a canned prompt via `/messages` ("Is topic ko engaging tareeke se kaise padhaun?") |
| Quiz | ✅ active | `streamGeneration('/chat/sessions/{id}/generate', {artifact_type:'quiz'})` |
| Class Activity | ✅ active | `… {artifact_type:'activity'}` |
| PPT / Mindmap | 🔒 disabled | rendered greyed with a `copy.phase2Hint` tooltip/badge |

Decision: **keep all 4 wireframe cards visible**, PPT & Mindmap disabled — so
the screen matches the mockup and signals the roadmap, rather than hiding them.
(If the team prefers a cleaner screen, drop to the 3 active cards — trivially
changed in this one component.)

Quick actions require a session; they call `ensureSession()` first. A quick
action before any context is chosen → same toast as `onSend`.

Each assistant turn in the thread also shows inline "Quiz banao" / "Activity
banao" buttons (wireframe: quick-action buttons attached to each response) →
same `/generate` calls.

## Rendering (`message-thread.tsx` + `artifact-card.tsx`)

- Teacher bubble: right-aligned, `bg-primary text-primary-foreground`,
  `rounded-2xl`.
- Assistant bubble: left, `bg-card ring-1 ring-foreground/10`; body via
  `<ReactMarkdown remarkPlugins={[remarkGfm]}>` with a tight prose class
  (headings small, lists tight — teachers scan on phones).
- Streaming: show a blinking caret at the end while `streaming:true`.
- After `onDone`, if `artifacts` gained a quiz/activity (from a `/generate`
  call), render `<ArtifactCard/>` below the triggering turn:
  - **quiz**: numbered list; each question shows `q`, options as `A)…D)` for
    `mcq`, and a collapsible "Uttar" (answer) line; `difficulty` as a small tag.
  - **activity**: title, `materials` chips ("Kuch nahi chahiye" when
    `["none"]`), `group_size` + `duration_min` line, numbered `steps`,
    `variation` in a muted note.
- Autoscroll to bottom on new tokens unless the user has scrolled up
  (standard "stick to bottom" behaviour).

## Errors / edge cases

- 429 from rate limit → `onError` toast with the server message; the assistant
  placeholder is removed.
- Stream abort on unmount / context change → `abortRef.current?.abort()`.
- `LLMError` mid-stream (`event: error`) → keep partial text, append "⚠️ Jawaab
  poora nahi mila. Dobara koshish karein." and a Retry button.
- No `topic_id` → still works; optionally show a subtle "Chapter chuno behtar
  jawaab ke liye" hint.

## Key decisions

- **Context change = fresh thread** — matches "one Module per session" on the
  backend (doc 05); avoids a session whose messages span unrelated topics.
- **Quick action = `/generate`, free text = `/messages`** — mirrors the backend
  split (doc 06); no client-side planning.
- **Markdown for explanation, structured cards for quiz/activity** — the
  backend already separates them (artifact `content_json` vs chat text); the UI
  follows.
- **PPT/Mindmap shown-but-disabled** — keeps parity with the approved wireframe
  and advertises Phase 2.

## How to test (backend docs 01–06 + frontend doc 07 running)

1. `bun dev`, log in, land on `/dashboard`. Greeting shows the seeded first
   name; 4 quick-action cards, PPT/Mindmap greyed.
2. Context bar pre-selects Class 8 / Science (primary pair). Pick "How Plants
   Make Their Food" as Chapter.
3. Type "How do I teach photosynthesis?" → Send. Tokens stream into an
   assistant bubble; markdown renders; caret blinks then stops; thread now has
   the turn.
4. Click "Quiz banao" on that turn → streaming state, then an
   `<ArtifactCard>` quiz with 5–10 questions, answers collapsible.
5. Click "Activity banao" → activity card; `materials` shows "Kuch nahi
   chahiye" or a short chip list.
6. Change Subject/Chapter in the context bar → thread clears; `localStorage` +
   URL update; refresh keeps the new context.
7. Send 7 messages fast → 7th shows the rate-limit toast, no broken bubble.
8. Chrome MCP screenshot `/dashboard` (empty state + populated thread) and
   compare to `../teacher_dashboard_home_wireframe.html`.
