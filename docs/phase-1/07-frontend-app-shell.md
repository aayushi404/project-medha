# 07 — Frontend App Shell

The presentation layer for the two Phase 1 screens. Builds the sidebar shell,
the shared lesson-context state, and the API/SSE/copy libs that docs 08 and 09
consume.

> **Before coding:** this repo runs Next.js 16.3 with local docs at
> `shiksha_sathi/node_modules/next/dist/docs/01-app/` — read the relevant
> pages (route groups, layouts, `use client`) as `AGENTS.md` instructs. The
> `next dev` agent block in `AGENTS.md` is expected; commit it with the work.

## Purpose

- A persistent left sidebar (Home / My Modules / profile popover) wrapping
  `/dashboard` and `/modules`, from `../teacher_dashboard_home_wireframe.html`.
- `useLessonContext()` — the Class / Subject / Chapter / Topic selection,
  shared between screens, persisted across refreshes.
- Typed API client additions, an SSE streaming helper, and the English UI copy
  map.

## Files

| File | Change |
|---|---|
| `app/(protected)/(app)/layout.tsx` | **new** — sidebar shell + `LessonProvider` |
| `components/app/app-sidebar.tsx` | **new** — sidebar (desktop + mobile drawer) |
| `components/app/profile-menu.tsx` | **new** — avatar chip + popover (Edit profile / Logout) |
| `components/app/context-bar.tsx` | **new** — Class/Subject/Chapter selects (used by doc 08) |
| `lib/lesson-context.tsx` | **new** — `LessonProvider`, `useLessonContext` |
| `lib/api.ts` | **extend** — types + typed fetchers (see §API) |
| `lib/sse.ts` | **new** — `streamGeneration(...)` |
| `lib/copy.ts` | **new** — English string map |
| `lib/format.ts` | **extend** — `formatRelativeTime(date)` |
| `components/ui/select.tsx` | **new** — thin wrapper over `@base-ui/react/select` |
| `components/ui/popover.tsx` | **new** — thin wrapper over `@base-ui/react/popover` |
| `components/ui/dialog.tsx` | **new** — for the delete confirm in doc 09 |
| `package.json` | add `react-markdown`, `remark-gfm` |

Keep the `components/ui/*` wrappers in the exact style of the existing
`button.tsx` / `card.tsx` (`data-slot`, `cn(...)`, token classes, `@base-ui/react`
primitive underneath).

## Route structure

```
app/(protected)/
  layout.tsx                 # EXISTING auth gate (status !== "authenticated" -> /login)
  page.tsx                   # EXISTING "/" router
  onboarding/page.tsx        # EXISTING
  (app)/                     # NEW route group — no URL segment
    layout.tsx               # NEW sidebar shell + LessonProvider
    dashboard/page.tsx       # MOVED here (doc 08)
    modules/page.tsx         # NEW (doc 09)
    modules/[id]/page.tsx    # NEW (doc 09)
```

`/dashboard` currently lives at `app/(protected)/dashboard/page.tsx` — move it
into `(app)/`. The URL stays `/dashboard`. The existing `(protected)/layout.tsx`
auth gate still wraps everything; `(app)/layout.tsx` nests inside it and adds
chrome only.

## `(app)/layout.tsx`

- `"use client"`. Reads `useAuth()`; the onboarding redirect currently in
  `dashboard/page.tsx` moves here (`if (teacher && !teacher.onboarded_at)
  router.replace("/onboarding")`), so both `(app)` screens are guarded once.
- Renders `<LessonProvider>` → `<div class="flex min-h-full">` →
  `<AppSidebar/>` + `<div class="flex flex-1 flex-col">{children}</div>`.
- Fetches `/profile` once (needs a token → `useAuth().accessToken`) and passes
  `subjects` + identity into `LessonProvider` and `ProfileMenu`. Cache it in a
  ref/state; both screens read it via a small `useProfile()` from
  `lesson-context.tsx` (or a sibling context) to avoid refetching.

## `AppSidebar` (`components/app/app-sidebar.tsx`)

From the wireframe:

- **Desktop (`md+`):** fixed 210–240px column, `bg-sidebar text-sidebar-foreground`,
  `border-r`. Brand row (`BookOpen` from `lucide-react` + "Medha").
  Nav: **Home** (`/dashboard`, `Home` icon), **My Modules** (`/modules`,
  `FolderOpen` icon). Active state from `usePathname()` →
  `bg-sidebar-accent text-sidebar-accent-foreground` (wireframe uses an accent
  pill). Footer: `<ProfileMenu/>`.
- **Mobile (`<md`):** sidebar hidden; a slim top bar with a hamburger
  (`Menu` icon) opens the same nav in a slide-over (`@base-ui/react` Dialog or a
  simple `motion` panel + backdrop). Close on route change. Tap targets ≥44px
  (match onboarding `h-12`).
- Nav items are plain `next/link`.

## `ProfileMenu` (`components/app/profile-menu.tsx`)

- Chip: circular initials avatar (`bg-accent text-accent-foreground`), name,
  subtitle `"{primarySubjectName} · {primaryGradeLabel}"` from `/profile`,
  chevron. Matches wireframe.
- Click → `@base-ui/react` Popover above the chip:
  - **Edit profile** (`Settings` icon) → `router.push("/profile")` — a minimal
    `app/(protected)/(app)/profile/page.tsx` stub is fine for Phase 1 (name +
    language form calling `PATCH /profile`); can be a later doc if descoped.
  - **Logout** (`LogOut` icon, `text-destructive`) → `useAuth().logout()`.

## `lib/lesson-context.tsx`

```ts
type LessonContextValue = {
  gradeId: string | null; subjectId: string | null;
  chapterId: string | null; topicId: string | null;
  setGradeSubject: (gradeId: string, subjectId: string) => void;  // clears chapter+topic
  setChapter: (chapterId: string | null) => void;                 // clears topic
  setTopic: (topicId: string | null) => void;
  options: {
    pairs: ProfileSubject[];        // from /profile — drives Class + Subject selects
    chapters: Chapter[];            // fetched for (gradeId, subjectId)
    topics: Topic[];               // fetched for chapterId
  };
};
```

- Initial value: read from `localStorage["medha.lessonContext"]`, then override
  from URL search params (`?grade=&subject=&chapter=&topic=`) if present.
- On any change: write both `localStorage` and the URL
  (`router.replace` with updated `searchParams`, no scroll) so a refresh or a
  shared link keeps context.
- Default when nothing stored: the teacher's **primary** subject/grade pair
  from `/profile`.
- Fetches `chapters` via `getChapters(gradeId, subjectId)` when the pair
  changes; `topics` via `getTopics(chapterId)` when chapter changes. Uses
  `useDebouncedValue`? not needed — these fire on discrete selects.
- Guard: only render children once `/profile` has resolved (show the existing
  `Loader2` spinner pattern).

## `lib/api.ts` additions

Types: `Chapter`, `Topic`, `Profile`, `ProfileSubject`, `ChatSession`,
`ChatSessionDetail`, `ChatMessage`, `ModuleListItem`, `ModuleDetail`,
`ModuleArtifact`, `Feedback` — matching the response bodies in docs 03 / 05 /
06 verbatim.

Typed fetchers (thin wrappers over `apiFetch`, each returning parsed JSON or
throwing `extractErrorMessage`):

```ts
getProfile(token)                       // GET /profile
patchProfile(token, body)               // PATCH /profile
getChapters(gradeId, subjectId)         // GET /curriculum/chapters
getTopics(chapterId)                    // GET /curriculum/topics
createSession(token, body)              // POST /chat/sessions
getSession(token, id)                   // GET /chat/sessions/{id}
listSessions(token)                     // GET /chat/sessions
listModules(token, { gradeId?, subjectId? })   // GET /modules
getModule(token, id)                    // GET /modules/{id}
deleteModule(token, id)                 // DELETE /modules/{id}
sendFeedback(token, id, body)           // POST /modules/{id}/feedback
```

`/chat/sessions/{id}/messages` and `/generate` are **not** here — they stream;
see `lib/sse.ts`.

## `lib/sse.ts`

```ts
type StreamHandlers = {
  onToken: (text: string) => void;
  onDone: (payload: { module_id: string; artifact_id?: string;
                      artifact_type?: string; message_id?: string }) => void;
  onError: (message: string) => void;
};

export async function streamGeneration(
  path: string,                 // e.g. `/chat/sessions/${id}/messages`
  body: unknown,
  token: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void>
```

- `fetch(`${API_BASE_URL}${path}`, { method:"POST", headers:{...bearer,
  "Content-Type":"application/json", Accept:"text/event-stream" },
  body: JSON.stringify(body), credentials:"include", signal })`.
- Read `res.body!.getReader()`, decode, split on `\n\n`, parse `event:` /
  `data:` lines. Dispatch `token` → `onToken(JSON.parse(data).text)`,
  `done` → `onDone(JSON.parse(data))`, `error` → `onError(JSON.parse(data).message)`.
- Non-OK response (e.g. 429) → read JSON body, `onError(detail ?? message)`.
- `EventSource` is deliberately not used — it can't send the `Authorization`
  header (same reason `apiFetch` exists).

## `lib/copy.ts`

Single flat map of the English UI chrome strings used by docs 08–09, e.g.:

```ts
export const copy = {
  brand: "Medha",
  greeting: (name: string) => (name ? `Hello, ${name}` : "Hello"),
  greetingSub: "What are you teaching today?",
  inputPlaceholder: "How do I teach photosynthesis so students stay engaged?",
  qa: { explanation: "Teaching approach", quiz: "Quiz", activity: "Class activity" },
  qaSub: { explanation: "2–3 strategies", quiz: "Questions to ask", activity: "Low-tech, hands-on" },
  myModules: "My Modules",
  filterAll: "All",
  emptyModules: "No modules yet. Ask about a topic on the dashboard.",
  feedbackUp: "Helpful", feedbackDown: "Could be better",
  deleteConfirm: "Delete this module?",
  phase2Hint: "Coming soon",
} as const;
```

Not a full i18n framework — one file, typed, imported directly. A real i18n
layer is out of scope for Phase 1.

## `lib/format.ts` addition

`formatRelativeTime(iso: string): string` → "just now", "5 min ago",
"2 hr ago", "2 days ago", "1 week ago". Pure function, no deps.

## Key decisions

- **Route group `(app)/` for chrome** — keeps the auth gate
  (`(protected)/layout.tsx`) untouched and lets `/onboarding` stay
  sidebar-less. No URL change.
- **Lesson context in `localStorage` + URL** — survives refresh (teachers on
  flaky connections reload a lot) and makes a session shareable; no server
  round-trip, no new table. Not stored on the teacher record because it's
  transient working state, not a profile preference.
- **`/profile` fetched once in the shell** — both screens need the
  subject/grade pairs and identity; one call, shared via context.
- **`@base-ui/react` for Select/Popover/Dialog** — already a dependency; stay
  consistent with `button.tsx`/`card.tsx` which wrap the same lib.
- **SSE over `fetch`+ReadableStream** — bearer-header requirement (doc 05).

## How to test

1. `bun add react-markdown remark-gfm`; `bun dev`.
2. Log in as `+919000000001` → lands on `/dashboard` inside the new shell:
   sidebar visible on desktop, Home active, profile chip shows
   "Ramesh… · Science · Class 8" (seeded name).
3. Resize to mobile width → sidebar collapses to a top bar; hamburger opens the
   drawer; picking "My Modules" navigates and closes it.
4. Profile popover → "Logout" clears the session and redirects to `/login`.
5. In React devtools, `useLessonContext()` shows the primary pair pre-selected;
   changing it updates `localStorage["medha.lessonContext"]` and the URL
   `?grade=…&subject=…`; a hard refresh keeps the selection.
6. `streamGeneration` unit check: point it at
   `/chat/sessions/<id>/messages` with a valid token and confirm `onToken`
   fires repeatedly then `onDone` once (needs backend docs 05 running).
