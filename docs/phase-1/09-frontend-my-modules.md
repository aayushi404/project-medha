# 09 — My Modules Screen

Builds `/modules` (list) and `/modules/[id]` (detail) from
`../my_kits_history_wireframe.html`, renamed to **Modules** (doc 00 §1.1).

## Purpose

- Browse saved modules grouped by `CLASS N · SUBJECT`, filter by class, search
  by title.
- Open a module to read its explanation / quiz / activity, leave feedback
  (thumbs up/down + comment), and delete it.

## Files

| File | Change |
|---|---|
| `app/(protected)/(app)/modules/page.tsx` | **new** — list |
| `app/(protected)/(app)/modules/[id]/page.tsx` | **new** — detail |
| `components/modules/module-row.tsx` | **new** |
| `components/modules/filter-chips.tsx` | **new** |
| `components/modules/artifact-view.tsx` | **new** — read-only render of an artifact |
| `components/modules/feedback-bar.tsx` | **new** — thumbs + comment |
| reuse `components/dashboard/artifact-card.tsx` (doc 08) if close enough — otherwise `artifact-view.tsx` is its read-only twin |

## List screen — `/modules`

Layout from the wireframe:

- **Header:** "My Modules" (`copy.myModules`).
- **Filter row:** `<FilterChips/>` — "All" + one chip per distinct
  `grade_label` present in the data (Class 6…10), pill styling from the
  wireframe (`bg-accent text-accent-foreground` when active). Plus a search
  input (right-aligned, `Search` icon) — **client-side** substring filter over
  `title` in Phase 1.
- **Body:** `listModules(token, { subjectId? })` on mount (no filter args →
  all). Group results by `"${grade_label} · ${subject_name}"`, uppercase
  heading (`CLASS 8 · SCIENCE`), rows sorted by `updated_at` desc within group,
  groups ordered by most-recent row.
- **Row** (`module-row.tsx`): title; artifact-type tags (`PPT`-style bordered
  chips, but for `explanation` / `quiz` / `activity` → label them
  "Samjhaayish" / "Quiz" / "Activity"); `formatRelativeTimeHi(updated_at)` on
  the right. Whole row is a `next/link` to `/modules/{id}`.
  - The wireframe's download icon is **omitted in Phase 1** (PDF export is
    Phase 2, doc 00 §5).
- **Empty state:** `copy.emptyModules` + a link back to `/dashboard`.
- **Loading:** the `Loader2` spinner pattern used elsewhere.

Filters combine: active class chip + search text both applied client-side.
(Server-side `grade_id`/`subject_id` filtering exists on `GET /modules` but
Phase 1 fetches once and filters in memory — module counts per teacher are
small.)

## Detail screen — `/modules/[id]`

- `getModule(token, id)` → 404 handling: if it throws/returns 404, show "Yeh
  module nahi mila" + back link (covers deleted / not-owned).
- **Header:** back chevron → `/modules`; `title`; sub-line
  `"{grade_label} · {subject_name} · {topic_title}"`; `formatRelativeTimeHi`.
- **Artifacts:** one section per artifact, ordered `explanation`, `quiz`,
  `activity`. `<ArtifactView type=… content={content_json}/>`:
  - `explanation` → `<ReactMarkdown>` of `content_json.text`.
  - `quiz` → same rendering as doc 08's quiz card (questions, options, "Uttar"
    collapsible, difficulty tag).
  - `activity` → title, materials chips, group/duration, numbered steps,
    variation note.
  - If an expected type is absent, just omit it (no placeholder).
- **`<FeedbackBar/>`** (pinned near the top or bottom):
  - Two toggle buttons — 👍 `copy.feedbackUp` / 👎 `copy.feedbackDown` —
    reflecting `module.feedback?.rating` (`1` / `-1`).
  - Clicking sets rating immediately via `sendFeedback(token, id,
    { rating })` (optimistic; revert + toast on error).
  - An expandable comment `textarea` + "Bhejo" button →
    `sendFeedback(token, id, { rating, comment })`. Pre-fill with
    `module.feedback?.comment`.
  - Because the endpoint upserts (doc 06), re-submitting just updates.
- **Delete:** `Trash2` button → `@base-ui/react` alert dialog
  (`components/ui/dialog.tsx`) with `copy.deleteConfirm`; confirm →
  `deleteModule(token, id)` → `router.replace("/modules")` + success toast.

## State notes

- No global store; each screen fetches its own data on mount with
  `useAuth().accessToken`. Re-fetch the list on focus is optional (nice for
  "I just generated something on the dashboard, now it's in the list").
- After returning from the dashboard, the new module appears because the list
  screen fetches on mount each navigation.

## Key decisions

- **Client-side filter/search in Phase 1** — per-teacher module counts are
  small; avoids debounced server calls and keeps the screen snappy offline-ish.
  The server filter params stay available for when counts grow.
- **Download omitted, not stubbed** — PDF/PPT is Phase 2; a dead download icon
  would mislead.
- **Feedback upsert, optimistic** — one row per `(module, teacher)` (doc 02
  unique constraint); the UI mirrors that (one current rating, editable).
- **Artifact rendering shared with the dashboard** — `content_json` shapes are
  identical; `artifact-view.tsx` is the read-only sibling of
  `artifact-card.tsx` (or the same component with an `interactive` prop).

## How to test (backend docs 01–06 + frontend docs 07–08)

1. Generate a module from the dashboard (explanation + quiz + activity).
2. Go to **My Modules** → the module appears under `CLASS 8 · SCIENCE` with
   three type tags and "abhi"/"X minute pehle".
3. Type part of the title in search → list narrows; clear → restores. Click a
   different class chip → group hides; "All" restores.
4. Open the module → all three artifacts render; explanation as markdown, quiz
   answers collapsible, activity steps numbered.
5. Click 👍 → persists (`GET /modules/{id}` shows `feedback.rating: 1`); add a
   comment, "Bhejo" → persists; reload → both retained. Click 👎 → flips.
6. Delete → confirm dialog → redirected to `/modules`, module gone; opening the
   old URL shows "nahi mila".
7. Chrome MCP screenshot `/modules` and compare to
   `../my_kits_history_wireframe.html`.
8. Log in as a second teacher → their My Modules is empty; deep-linking to the
   first teacher's module id shows "nahi mila".
