# 03 — Curriculum & Profile API

**`../phase-1.md` §7 step 4** — "Onboarding + reference routers." Onboarding and
`/reference/*` shipped in Phase 0; this step adds the remaining read endpoints
the dashboard needs (`/curriculum/chapters`, `/curriculum/topics`) and the
profile endpoints (`/profile` GET/PATCH) the app shell and "Edit profile" use.

## Purpose

- Let the dashboard's **Chapter** and **Topic** selectors load real data for a
  chosen grade+subject.
- Give the frontend one call (`GET /profile`) that returns the teacher plus
  their school and their subject/grade pairs — the source for the Class /
  Subject selectors and the sidebar identity chip.
- Allow editing name / language.

## Files

| File | Change |
|---|---|
| `backend/src/backend/curriculum/__init__.py` | **new** (empty) |
| `backend/src/backend/curriculum/router.py` | **new** |
| `backend/src/backend/curriculum/schemas.py` | **new** |
| `backend/src/backend/curriculum/service.py` | **new** |
| `backend/src/backend/profile/__init__.py` | **new** (empty) |
| `backend/src/backend/profile/router.py` | **new** |
| `backend/src/backend/profile/schemas.py` | **new** |
| `backend/src/backend/profile/service.py` | **new** |
| `backend/src/backend/app.py` | `include_router` for both |

## API — curriculum

Public read (same as `/reference/*` — no auth needed; they're board reference
data). Uses `get_db` only.

### `GET /curriculum/chapters?grade_id=<uuid>&subject_id=<uuid>`

```json
[ { "id": "…", "chapter_number": 1, "title": "How Plants Make Their Food" } ]
```

- Query `CurriculumChapter` filtered by both ids, `order_by(chapter_number)`.
- Both params required (`Query(...)`); unknown ids → empty list (not 404).

### `GET /curriculum/topics?chapter_id=<uuid>`

```json
[ { "id": "…", "title": "Photosynthesis: How Green Plants Prepare Food",
    "description": "The process by which…", "sequence_order": 1 } ]
```

- Query `CurriculumTopic` filtered by `chapter_id`, `order_by(sequence_order)`.

Schemas: `ChapterOut`, `TopicOut` with `model_config = ConfigDict(
from_attributes=True)` — mirror `reference/schemas.py`.

## API — profile (auth required: `get_current_teacher`)

### `GET /profile`

```json
{
  "id": "…",
  "full_name": "Ramesh Kumar",
  "phone_number": "+919000000001",
  "preferred_language": "hi-BiharBoli",
  "onboarded_at": "2026-08-20T…Z",
  "school": { "id": "…", "name": "Govt Middle School, Patna Sadar",
              "district_name": "Patna" },
  "subjects": [
    { "subject_id": "…", "subject_name": "Science",
      "grade_id": "…", "grade_label": "Class 8", "numeric_level": 8,
      "is_primary": true }
  ]
}
```

- `school`: `None` if `teacher.school_id is None` (shouldn't happen
  post-onboarding, but handle it).
- `subjects`: join `TeacherSubject → Subject, Grade` for
  `teacher_id == current.id`, primary first then `numeric_level`.
- Service function `get_profile(db, teacher) -> ProfileOut`.

### `PATCH /profile`

Request (all optional):

```json
{ "full_name": "Ramesh Kumar", "preferred_language": "hi" }
```

- `full_name`: trimmed, non-empty if present (reuse the validator style from
  `onboarding/schemas.py`).
- `preferred_language`: constrain to a small allow-list —
  `{"hi-BiharBoli", "hi", "en"}` — reject others with 422.
- **Subject/grade edits are out of scope for Phase 1.** If `subjects` is sent,
  ignore it (or 400 with "Editing subjects isn't available yet"). Note this in
  the schema docstring.
- Returns the same shape as `GET /profile`.
- `teacher.updated_at = func.now()` on write; `db.commit()`.

## `app.py` registration

```python
from backend.curriculum.router import router as curriculum_router
from backend.profile.router import router as profile_router
...
app.include_router(curriculum_router)
app.include_router(profile_router)
```

## Key decisions

- **`/curriculum/*` is unauthenticated** — consistent with `/reference/grades`
  and `/reference/subjects`; it's public board data and the selectors need it
  before any session exists.
- **One `/profile` call returns everything the shell needs** — avoids the
  frontend stitching `/auth/me` + a subjects call + a school call. `/auth/me`
  stays as the lightweight session-check used by `auth-context`.
- **Language allow-list, not free text** — the prompts (doc 04) branch on it.
- **No new tables** — pure reads plus a narrow update to `teachers`.

## Reuse

- `reference/router.py` — the `db.query(Model).order_by(...).all()` pattern and
  the join-with-labels pattern in `search_schools`.
- `reference/schemas.py` — `ConfigDict(from_attributes=True)` response models.
- `onboarding/schemas.py` — `field_validator` for trimming `full_name`.
- `auth/dependencies.py::get_current_teacher`, `db/session.py::get_db`.

## How to test

1. `uv run uvicorn backend.app:app --reload`; open `/docs`.
2. Get a token: `POST /auth/otp/request {"phone_number":"+919000000001"}`,
   read the OTP from the uvicorn log, `POST /auth/otp/verify`.
3. `GET /profile` with the bearer token → seeded teacher, school "Govt Middle
   School, Patna Sadar", one Science / Class 8 primary subject.
4. `PATCH /profile {"full_name":"  "}` → 422. `{"preferred_language":"fr"}` →
   422. `{"full_name":"Ramesh Kumar Singh"}` → 200, reflected on re-GET.
5. From `GET /profile` grab the Class 8 `grade_id` and Science `subject_id`,
   then `GET /curriculum/chapters?grade_id=…&subject_id=…` → at least "How
   Plants Make Their Food" (+ the doc 02 seed chapters).
6. `GET /curriculum/topics?chapter_id=…` for that chapter → the photosynthesis
   topic.
