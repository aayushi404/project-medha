# Student role — implementation plan

Adds a fourth role, `student`, on top of the existing admin → principal → teacher
approval chain. A student registers with their class + roll number, a teacher at
their school approves, the student then sets a login credential ("creates an
account"), logs in, and lands on a doubt-solving AI dashboard scoped to their
grade.

## Design decisions

1. **Students are rows in the `teachers` table** with `role = 'student'`, same as
   admin/principal. Reuses `/auth/login`, `auth_sessions`, JWT + silent refresh,
   `get_current_user`, `require_role()`, and `approvals.service` (approve/reject +
   `approval_events` audit) unchanged. The table name stays (prior decision); the
   code already treats it as a generic user table.

2. **Two-phase onboarding**, exactly as described:
   - *Phase 1 — register*: `full_name`, `school`, `grade`, `roll_number`. No
     credential. Row is created `role='student'`, `approval_status='pending'`,
     `email = NULL`, `password_hash = NULL`.
   - *Phase 2 — teacher approves* (or rejects with a reason) from a new "Students"
     screen in the teacher app.
   - *Phase 3 — activate account*: the student re-enters
     `school + grade + roll_number + full_name` to locate their **approved** row
     (which still has `email IS NULL`), and sets `email` + `password`.
   - *Phase 4 — login*: the existing `/auth/login`. `approval_status` gating and
     the `PENDING_APPROVAL` / `REGISTRATION_REJECTED` responses already work.

   **Tradeoff:** phase 3 identity check is `school+grade+roll+name` match, not a
   secret. Acceptable for a school-internal roster; a per-student claim code
   (shown in the teacher roster) can be layered on later without a schema change
   beyond one nullable column.

3. **Student doubt chat is a separate `/tutor/*` API**, not the teacher `/chat/*`.
   Same `chat_sessions` / `chat_messages` tables (the `teacher_id` FK points at
   `teachers.id`, which a student row satisfies), but **no Module / artifact side
   effects** and a student-facing prompt. Own rate limiter.

4. Students get **no** saved modules, quiz/activity generators, onboarding wizard,
   or subject assignments. Grade is fixed from their row; they only pick
   subject → chapter → ask.

## Backend

### Migration `0006_student_role.py` (down_revision `0005_role_approval`)
- `teachers.grade_id UUID NULL` → `grades.id` (`fk_teachers_grade`); index.
- `teachers.roll_number TEXT NULL`.
- `email`: drop `teachers_email_key`, `alter_column(..., nullable=True)`, create
  partial unique index `uq_teachers_email` `WHERE email IS NOT NULL`.
- `password_hash`: `alter_column(..., nullable=True)`.
- Replace `chk_teachers_role` → `role IN ('admin','principal','teacher','student')`.
- Partial unique `idx_one_student_per_roll` on `(school_id, grade_id, roll_number)`
  `WHERE role='student' AND roll_number IS NOT NULL`.
- Full `downgrade()`.

### Models — `db/models/teacher.py`
Add `grade_id`, `roll_number`; make `email`, `password_hash` `Mapped[str | None]`;
update `__table_args__` (role check, email → partial unique index, roll index).

### `auth`
- `schemas.py`: `TeacherOut` gains `grade_id: uuid.UUID | None`,
  `roll_number: str | None`.
- `service.login`: unchanged (works for students once credentials + approval are
  set). Add a guard: a `role='student'` row with `password_hash IS NULL` should
  answer `PENDING_APPROVAL`-style so a not-yet-activated student gets a sensible
  message rather than "invalid email".
- `dependencies.py`: `require_student = require_role("student")`.

### New `backend/student/` (registration + activation, no auth)
- `schemas.py`: `StudentRegisterIn` (full_name, school_id, grade_id, roll_number),
  `StudentActivateIn` (school_id, grade_id, roll_number, full_name, email,
  password), `StudentRegisterOut`.
- `service.py`:
  - `register()` — validate school + grade exist; require the school to have ≥1
    approved teacher; reject a duplicate pending/approved roll in that class;
    create the pending row.
  - `activate()` — find the unique `role='student'`, `approval_status='approved'`,
    `email IS NULL` row matching school+grade+roll+`ilike(full_name)`; 404/409 if
    none / ambiguous; set `email` (unique-checked) + `password_hash`; return.
- `router.py`: `POST /student/register`, `POST /student/activate`.

### New `backend/teacher/` (teacher-facing student approvals, `require_teacher`)
Mirror of `backend/principal/`:
- `GET /teacher/students/pending` (school-scoped, optional `?grade_id=`)
- `GET /teacher/students` (approved roster)
- `POST /teacher/students/{id}/approve` · `POST /teacher/students/{id}/reject`
- `GET /teacher/students/stats`
- Scoping (`student.school_id == teacher.school_id`, `role=='student'`) lives in
  the service via a `_get_scoped_student()` helper; delegates to
  `approvals.service`.

### New `backend/tutor/` (student doubt chat, `require_student`)
- `llm/prompts/doubt.py` — `VERSION="doubt-v1"`. System prompt addresses the
  **student** directly: simple Hindi/English, build understanding step by step,
  ask a guiding question before the full answer, ground in textbook chunks.
- `service.py` — `create_session` (grade forced to `student.grade_id`; validate
  subject/chapter against grade), `list_sessions`, `get_session_detail`,
  `stream_message` (trimmed copy of `chat.service.stream_message`: persist user
  msg → retrieve → stream → persist assistant msg → `done`; **no** `_upsert_module`).
- `router.py`: `POST /tutor/sessions`, `GET /tutor/sessions`,
  `GET /tutor/sessions/{id}`, `POST /tutor/sessions/{id}/messages` (SSE).
- `rate_limit.py` — copy of `chat/rate_limit.py`.

### `app.py`
`include_router` for `student_router`, `teacher_router`, `tutor_router`.

## Frontend (`shiksha_sathi/`)

### `lib/api.ts`
- `Role` += `"student"`. `Teacher` type += `grade_id`, `roll_number`.
- `registerStudent()`, `activateStudent()`.
- Teacher-side: `getStudentStats`, `getPendingStudents`, `getStudentRoster`,
  `approveStudent`, `rejectStudent`.
- Tutor chat: `createTutorSession`, `listTutorSessions`, `getTutorSession`
  (types mirror the existing `ChatSession*`).
- `lib/sse.ts`: make `StreamDone.module_id` optional.

### Auth / routing
- `lib/auth-context.tsx`: `register`-style `registerStudent`/`activateStudent`
  passthroughs (no session side effect).
- `app/(protected)/home/page.tsx`: `role === "student"` → `/student`.
- `components/auth/role-gate.tsx`: already generic (`role` prop) — reuse.

### Public pages
- `app/register/page.tsx`: add a third **Student** toggle → renders a phase-1
  student form (name, `SchoolTypeahead`, grade `<Select>`, roll number). On
  success → `PendingScreen` with a "Once approved, activate your account" link to
  `/student/activate`.
- `app/student/activate/page.tsx` (new, `Suspense`-wrapped): school + grade + roll
  + name + email + password → `activateStudent()` → on success route to `/login`
  with a success toast.
- `app/login/page.tsx`: add "Student? Activate your account" link; landing
  `components/landing/auth-section.tsx` gets a third **I'm a Student** card.

### Student dashboard — `app/(protected)/(student)/`
- `layout.tsx`: guard `role === "student"` (else `/home`); light shell —
  brand + "Log out", no teacher sidebar. Wrap in a small `StudentProfileProvider`
  (calls `/auth/me` data already in context; fetch grade label from
  `/reference/grades`).
- `student/page.tsx`: header = subject `<Select>` + chapter `<Select>`
  (`getSubjects`, `getChapters(studentGradeId, subjectId)`); body = chat thread
  (`components/chat/turn.tsx`) + `Composer`; empty state = greeting + hint.
  Streams via `streamGeneration('/tutor/sessions/{id}/messages', …)`; creates the
  session lazily on first send (like the dashboard). Reset thread when
  subject/chapter changes.
- `components/student/subject-chapter-bar.tsx` — the picker.
- Optional (include if cheap): a "Recent doubts" popover from `listTutorSessions`.

### Teacher "Students" screen
- `components/app/app-sidebar.tsx`: add `{ href: "/students", … , icon: GraduationCap }`.
- `app/(protected)/(app)/students/page.tsx`: mirrors `principal/page.tsx` — stats,
  pending list (approve / `RejectDialog`), roster; optional grade filter chips.
- `components/students/pending-students.tsx`, `components/students/student-roster.tsx`.
- `lib/copy.ts`: new strings (nav label, greetings, picker labels).

## Migration / seed / verify
- Run `alembic upgrade head` on the dev DB.
- Extend `seed_phase0.py`: two demo students at the test school in Class 8 —
  one `approved` **with** credentials (`student@demo.com` / `password123`) for
  instant testing, one `pending` for the approval demo.
- Smoke test (TestClient script in `scratchpad/`): register student → teacher
  approves → activate → login → create tutor session → stream a doubt.
- `npm run lint` + `npm run build` in `shiksha_sathi/`.

## Explicitly out of scope
Password reset / email provider (still deferred); student saved modules;
student-side quiz/activity generation; SMS/OTP; parent accounts.
