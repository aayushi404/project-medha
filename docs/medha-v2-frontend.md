# Medha v2 — Frontend Architecture Plan

**Status:** design, not yet implemented
**Companion docs:** `medha-v2-schema.md`, `medha-v2-backend.md`
**Stack:** Next.js 16 App Router (see `AGENTS.md` — read `node_modules/next/dist/docs/` before coding), React 19, Tailwind v4, `@base-ui/react`, `motion`, `lucide-react`.

Design language borrows from the SAVRA reference screens (5 screenshots in the
planning thread): a warm home with **coloured Quick Action cards**, a clean
tabbed **History**, a full-bleed **document viewer** per artifact type, and a
distinct **Ask** surface. Keep Medha's editorial type system (Fraunces + Manrope)
and terracotta as the action colour; add the pastel category tints and a violet
"AI" accent.

---

## 1. Route restructure

Today: `app/(protected)/(app)/dashboard` is the teacher home *and* the chat.
v2 splits them.

```
app/(protected)/(app)/                     teacher shell (sidebar + drawer, unchanged wrapper)
  home/            page.tsx                NEW landing — greeting + Quick Actions grid + Ask/Call entry
  ask/             page.tsx                the conversation surface (today's dashboard/, narrowed)
  create/
    [type]/        page.tsx                generation flow: form → stream → viewer   (type ∈ 5 kinds)
    [type]/[id]/   page.tsx                saved-artifact viewer + toolbar
  history/         page.tsx                tabbed list (All / Lessons / Quizzes / …), search, sort
  library/         page.tsx                curated browse
  modules/         …                       kept, de-emphasised in nav (grouping view)
  profile/  students/  tools/  attendance/  unchanged
```

**Post-login redirect** (`app/(protected)/home/page.tsx` role router): teachers
now land on `/home` instead of `/dashboard`. `onboarded_at` gate unchanged.

**Sidebar nav** (`components/app/app-sidebar.tsx` `NAV`): reorder to
`Home · Ask Medha · History · My Modules · Students · Tools · Attendance`.
`Ask Medha` gets a chat-bubble icon in the violet accent.

---

## 2. Screens

### 2.1 `/home` — from SAVRA screenshot 7

- Header: `Hi, {firstName}!` + plan badge, subtitle "What should we make today?".
  Right side: **Call Tara**-style voice launcher (reuses `VoiceChatLauncher`) +
  an "Ask Medha" pill that routes to `/ask`.
- **Quick Actions grid** — 2-col desktop, 1-col mobile. Six `QuickActionCard`s:

  | Card | tint token | routes to |
  |---|---|---|
  | Create Lesson Plan | `--tint-lesson` | `/create/lesson_plan` |
  | Create Worksheet | `--tint-worksheet` | `/create/worksheet` *(disabled until type ships)* |
  | Create Presentation | `--tint-presentation` | `/create/presentation` |
  | Create Question Paper | `--tint-question-paper` | `/create/question_paper` |
  | Create Quiz | `--tint-quiz` | `/create/quiz` |
  | Create Notes | `--tint-notes` | `/create/notes` |

  Card = tinted panel, illustration/icon, terracotta CTA button (matches the
  screenshot — the button stays brand-colour, only the panel is tinted).
- Below the grid: **"Recent"** — last ~4 `generations` (reuse `HistoryRow`),
  "View all" → `/history`.

### 2.2 `/ask` — from SAVRA screenshots 3 & 4

Today's `dashboard/page.tsx`, refactored:

- Empty state: `Afternoon, {name}` centred, curriculum picker (`ContextBar` —
  grade + subject required, chapter optional), one-line "Ask me anything…".
  Drop the quiz/activity/ppt QuickActions from here (they live on `/home` now).
- Thread: `MessageThread` unchanged, **plus** an inline document card when
  `message.generation_id` is set — a compact `<GenerationCard variant="inline">`
  with PDF / Copy / Expand actions (screenshot 4). "Expand" → `/create/{type}/{id}`.
- Composer: keep voice mic; add a `+` menu with `/lesson` `/quiz` `/notes` …
  slash affordances (Phase F) that pre-target a generation.
- Left rail (desktop) / accordion (mobile): **"Earlier for this chapter"** —
  `listGenerations({ chapterId })`, so a teacher sees what they already made.
- `VoiceChatLauncher` unchanged (converse SSE, `voice_turns`).

### 2.3 `/create/[type]` — the generation flow

Three states in one route, no page nav between them:

1. **Form.** `CreateForm` = `ContextBar` (grade/subject/chapter/topic) + a
   type-specific param panel:
   - lesson_plan: periods (1–6), focus/notes textarea
   - presentation: slide count, tone (simple / detailed), include speaker notes
   - question_paper: total marks, duration, section mix (MCQ/short/long counts)
   - quiz: question count, difficulty, types to include
   - notes: depth (summary / standard / detailed), include key terms
   - language selector (defaults to `profile.preferred_language`)
2. **Streaming.** `POST /generate/{type}` via `streamGeneration` (existing
   `lib/sse.ts`). Text types render tokens live into the viewer skeleton;
   presentation shows a `progress` stepper. Cancel = `AbortController`.
3. **Viewer.** On `done`, swap to `<GenerationView type id>` (§3) with the
   toolbar. `router.replace('/create/{type}/{id}')` so refresh/share works.

`cached:true` in the `done` frame → skip the stream animation, show instantly,
toast "Reused an earlier version".

### 2.4 `/create/[type]/[id]` — saved viewer — from SAVRA screenshot 6

`GET /generations/{id}` → `<GenerationView>` + `<GenerationToolbar>`:

- Header: `‹ {title}` + inline-editable title (`PATCH`), favourite star.
- Body: per-type renderer (§3). Lesson plan = the horizontally-scrollable
  columnar table from screenshot 6 (`overflow-x-auto` wrapper — see the mobile
  rules in §6).
- Toolbar (sticky bottom on mobile, inline on desktop): **Share · Print ·
  Regenerate · Feedback** on the left; **Download** (`▾ PDF / PPTX`) on the
  right, terracotta outline. `Feedback` opens the existing `FeedbackBar`
  (`POST /generations/{id}/feedback`). `Regenerate` opens a small dialog to
  tweak `input_params` then re-streams.

### 2.5 `/history` — from SAVRA screenshot 5

- Title + subtitle, an "Ask Medha" search field top-right (routes to `/ask`
  with the query, or filters — start with route).
- `HistoryTabs`: All · Lessons · Quizzes · Question Papers · Worksheets ·
  Presentations · Notes  → `?type=` on `listGenerations`. "Sort By: Date"
  select (date / title).
- `HistoryList`: rows show `title`, `{grade} · {subject}`, timestamp, a type
  badge (tinted). Row → `/create/{type}/{id}`. Infinite scroll via `cursor`.
- Empty state per tab.

### 2.6 `/library`

Grid of curated `GenerationCard`s filtered by `type` + curriculum. "Use this"
→ `POST /library/{id}/clone` → opens the teacher's new copy in the viewer.

---

## 3. Component inventory

| Component | New? | Notes |
|---|---|---|
| `QuickActionCard` | new | tinted panel + icon + terracotta CTA; `disabled` state |
| `CreateForm` | new | `ContextBar` + `<ParamPanel type>`; validates before enabling "Generate" |
| `ParamPanel` | new | switch on `type`; small controlled fields, `@base-ui` Select/NumberField |
| `GenerationStream` | new | wraps `streamGeneration`; exposes `{status, tokens, progress, error, generationId}` |
| `GenerationView` | new | switch on `type` → the renderer below |
| `LessonPlanView` | new | columnar table, `overflow-x-auto`, sticky first col on desktop |
| `QuestionPaperView` | new | sectioned, marks in the margin, print stylesheet |
| `NotesView` | new | `react-markdown` sections + key-points list (reuse `MARKDOWN_CLASS`) |
| `QuizView` | **reuse** | `components/dashboard/artifact-card.tsx` — generalise props off `content_json` |
| `DeckView` | **reuse** | existing slide viewer from the PPT feature |
| `GenerationToolbar` | new | Share/Print/Regenerate/Feedback/Download; sticky-bottom on mobile |
| `GenerationCard` | new | list/grid/inline variants; used by History, Library, `/ask` inline, `/home` recent |
| `HistoryTabs` / `HistoryList` / `HistoryRow` | new | tab state in the URL |
| `FavoriteToggle` | new | optimistic `PATCH` |
| `RegenerateDialog` | new | `@base-ui` Dialog, edits `input_params`, re-streams |
| `ContextBar` | **reuse** | `components/app/context-bar.tsx` — already curriculum-aware + i18n |
| `FeedbackBar` | **reuse** | repoint to `/generations/{id}/feedback` |
| `VoiceChatLauncher` | **reuse** | unchanged |

---

## 4. `lib/api.ts` + `lib/sse.ts`

`lib/api.ts` additions (keep the existing `apiFetch` + typed-wrapper style):

```ts
export type GenerationType =
  "lesson_plan" | "presentation" | "question_paper" | "notes" | "quiz" | "worksheet" | "notice";

export type GenerationListItem = {
  id: string; type: GenerationType; title: string;
  grade_label: string | null; subject_name: string | null; chapter_title: string | null;
  is_favorite: boolean; status: "queued"|"running"|"completed"|"failed";
  created_at: string;
};
export type GenerationDetail = GenerationListItem & {
  content_json: unknown;            // narrowed per-type at the view boundary
  input_params: Record<string, unknown> | null;
  feedback: { rating: number | null; comment: string | null } | null;
  exports: { format: string; ready: boolean }[];
};

listGenerations(token, { type?, favorite?, q?, chapterId?, cursor?, limit? })
getGeneration(token, id)
patchGeneration(token, id, { is_favorite?, title? })
deleteGeneration(token, id)
sendGenerationFeedback(token, id, { rating, comment? })
listLibrary(token, { type?, gradeId?, subjectId?, chapterId? })
cloneLibrary(token, id)
generationExportUrl(id, format)                 // -> `${API_BASE_URL}/generations/${id}/export/${format}`
```

`createGeneration` / `regenerate` go through **`streamGeneration`** (already
supports the bearer header). `lib/sse.ts`:

- extend `StreamDone` with `generation_id?: string`, `cached?: boolean`
- add a `progress` branch: `onProgress?: (p: {stage:string; done:number; total:number}) => void`

Per-type `content_json` TS types live in `lib/generation-types.ts`, mirroring
the backend Pydantic models (§3 of the backend doc).

---

## 5. Palette extension (`app/globals.css`)

**Unchanged:** `--primary` (ink), `--terracotta` (brand action — every CTA
button stays this), the Fraunces/Manrope type system, radii.

**Added** — pastel category tints (panel backgrounds, badges) + one violet "AI"
accent (Ask Medha surfaces, the chat mark, generation-in-progress). All `oklch`,
defined in both `:root` and `.dark`, then exposed as utilities.

```css
:root {
  /* category tints — low-chroma, high-lightness; for card panels + badges */
  --tint-lesson:          oklch(0.955 0.028  25);   /* rose / peach   */
  --tint-worksheet:       oklch(0.950 0.033 265);   /* periwinkle     */
  --tint-presentation:    oklch(0.952 0.035 305);   /* lavender       */
  --tint-question-paper:  oklch(0.960 0.040  95);   /* cream / butter */
  --tint-quiz:            oklch(0.953 0.030  40);   /* soft coral     */
  --tint-notes:           oklch(0.955 0.033 155);   /* mint           */
  --tint-notice:          oklch(0.952 0.030 230);   /* sky            */
  --tint-foreground:      var(--ink);               /* text on any tint */

  /* violet — the "AI / Ask Medha" accent (SAVRA's purple) */
  --violet:               oklch(0.545 0.170 295);
  --violet-foreground:    oklch(0.985 0.005 300);
  --violet-muted:         oklch(0.950 0.030 300);   /* subtle violet wash */
}

.dark {
  /* tints: drop lightness, keep hue, so badges/panels read on the dark ground */
  --tint-lesson:          oklch(0.330 0.045  25);
  --tint-worksheet:       oklch(0.330 0.050 265);
  --tint-presentation:    oklch(0.335 0.055 305);
  --tint-question-paper:  oklch(0.345 0.050  95);
  --tint-quiz:            oklch(0.335 0.048  40);
  --tint-notes:           oklch(0.335 0.050 155);
  --tint-notice:          oklch(0.335 0.045 230);
  --tint-foreground:      oklch(0.955 0.012 85);

  --violet:               oklch(0.680 0.150 295);
  --violet-foreground:    oklch(0.180 0.020 300);
  --violet-muted:         oklch(0.320 0.045 300);
}

@theme inline {
  --color-tint-lesson:         var(--tint-lesson);
  --color-tint-worksheet:      var(--tint-worksheet);
  --color-tint-presentation:   var(--tint-presentation);
  --color-tint-question-paper: var(--tint-question-paper);
  --color-tint-quiz:           var(--tint-quiz);
  --color-tint-notes:          var(--tint-notes);
  --color-tint-notice:         var(--tint-notice);
  --color-tint-foreground:     var(--tint-foreground);
  --color-violet:              var(--violet);
  --color-violet-foreground:   var(--violet-foreground);
  --color-violet-muted:        var(--violet-muted);
}
```

Gives `bg-tint-lesson`, `text-violet`, `bg-violet-muted`, etc. A
`TYPE_TINT: Record<GenerationType, string>` map in `lib/generation-types.ts`
keeps card/badge colours in one place.

Contrast: every tint pairs with `--tint-foreground` (≈ ink / near-white) at
≥ 7:1; the violet button uses `--violet-foreground`. Validate with the
`dataviz` skill's contrast checker before merging.

---

## 6. Mobile-first rules

The teacher audience is majority phone. Every screen is designed at 360px first.

- **Shell:** `h-dvh` + `overflow-hidden` root, `min-h-0` flex chain so only the
  content pane scrolls; sidebar → the existing `@base-ui` drawer under `md`.
  (Already the pattern — keep it.)
- **Quick Actions:** `grid-cols-1 sm:grid-cols-2`. Cards min-height ~140px, full
  tap target is the card, not just the button.
- **Create form:** single column; param panel fields stack; sticky "Generate"
  button pinned above the keyboard safe-area (`pb-[env(safe-area-inset-bottom)]`).
- **Document viewers:** wide content (lesson-plan table, question paper) lives in
  an `overflow-x-auto` scroller — the page body never scrolls sideways. Lesson
  plan: sticky first column (`position: sticky; left: 0`) on ≥ sm only.
- **Toolbar:** on mobile it's a fixed bottom bar (`fixed inset-x-0 bottom-0`,
  safe-area padding); on desktop it's inline under the document. Actions that
  don't fit collapse into a `⋯` menu.
- **History:** tabs scroll horizontally (`overflow-x-auto`, no wrap); rows are
  full-width, single line title + wrapped meta.
- **Touch targets:** `≥ 40px`; use the `pointer-coarse:` variant for extra
  padding (same approach as the recent chat-actions mobile fix).
- **Streaming:** the token area is the scroll container and auto-sticks to
  bottom (reuse `MessageThread`'s `stick` ref logic).

---

## 7. i18n

Extend `lib/i18n/en.ts` + `hi.ts` (typed by `Copy`):

- `nav.askMedha`, `nav.history`
- `home.*` — greeting variants, "What should we make today", `quickActions.*`
  (one label per type), `recent`, `viewAll`
- `create.*` — per-type form labels, param field labels, `generate`,
  `generating`, `regenerate`, `reusedEarlier`, `cancel`
- `generation.*` — toolbar (`share`, `print`, `download`, `feedback`),
  `favorite`, `unfavorite`, `deleteConfirm`, per-type `viewLabels`
- `history.*` — tab names, `sortBy`, `sortDate`, `sortTitle`, empty states
- `library.*` — `useThis`, `curated`

Curriculum strings (grade/subject/chapter) already flow through
`useCurriculumT()` — reuse it in every new list row and viewer header.

---

## 8. Build-order (tracks the backend phases)

| FE phase | Ships | Depends on BE phase |
|---|---|---|
| 1 | palette tokens + `TYPE_TINT`; `/home` with Quick Action cards (cards route, forms stubbed) | A |
| 2 | `/create/[type]` full flow (form → stream → viewer) for quiz + notes + lesson_plan; `GenerationView` renderers; `lib/api.ts` + `sse.ts` additions | B |
| 3 | `/history` tabbed list + search + favourite; `/create/[type]/[id]` saved viewer + toolbar; presentation + question_paper types | B/C |
| 4 | `/ask` refactor (drop quick actions, add inline `GenerationCard`, "Earlier for this chapter" rail) | B |
| 5 | `/library`; PDF download button; `RegenerateDialog` | C |
| 6 | chat slash-affordances + inline generation; worksheet/notice cards enabled | F |

Each phase: `bunx tsc --noEmit`, `bun run lint`, `bun run build` clean before
merge (run from `shiksha_sathi/`).
