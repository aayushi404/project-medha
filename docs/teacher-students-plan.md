# Teacher students section, student card and profile: research and plan

Status: **research done, plan proposed, no code changed.** Decisions D1-D5 below need
an answer before implementation starts.

## What you reported

1. Teachers should see students whose approval is pending in the Students section.
2. Make pending students clickable so a teacher can scan their profile.
3. Replace the one long list of all students with a choice of the teacher's classes,
   then that class's students. Improve the UI/UX.
4. On the student card, show the student's phone number instead of email.
5. Show email on the full profile only.
6. One centralised student profile component. Only teachers and the principal of that
   school may see student details, on a student profile route.

## What the code does today (verified)

### Bug 1: pending students are hidden from teachers who can act on the class

`backend/src/backend/teacher/service.py` decides what a teacher sees with
`_teacher_grade_ids`: the grades in `teacher_subjects`. Pending and approved lists,
stats, and the approve/reject checks all use this grade set.

Meanwhile `list_my_sections` (the class picker) and `assert_can_act_on_section` use a
different rule: `teaching_assignments` for the section, or `class_teacher_id`.

So a teacher can act on a section but still can't see its students. Local example:
a pending student in Class 10 A. Anita Verma can act on that section, but she has no
`teacher_subjects` row for Class 10, so the pending list hides it from her. The same
happens to any homeroom-only teacher, and the reset-code bug fixed in Phase 2 came from
the same mismatch.

### Bug 2: no class choice; whole school in one list

`GET /teacher/students` returns every approved student in the teacher's grades, with no
class filter. The UI shows one flat list.

### Card shows email

`StudentRosterItem.email` (backend) and `Row` in `components/students/student-roster.tsx`
show email. Most students have none, so the card is mostly empty.

### Profile access

- Only `GET /principal/students/{id}` returns a full profile, and it requires the
  principal (`require_principal`). A teacher gets 403.
- The principal's profile lives in `components/principal/student-detail.tsx`, route
  `app/(protected)/principal/students/[id]/page.tsx`.
- No teacher route exists for a student profile.
- `assert_can_view_student` (`core/section_access.py`) already exists. It allows a
  principal school-wide and a teacher only for students in a section they act on. It
  isn't used by any endpoint yet.

### Other findings

- Locally: 1 pending student (Class 10 A), 10 approved, 5 teachers.
- Approving and rejecting use the same grade scope, so fixing the list alone would leave
  a teacher able to see a student they can't approve.

## Decisions needed

**D1. Who may open a student's full profile?**
- (a) Principal, plus any approved teacher of the same school. This is what you wrote.
- (b) Principal, plus teachers who act on that student's section (assignment or homeroom).
  This is the rule `assert_can_view_student` already encodes.
- *Recommendation: (b).* It keeps minors' guardian details to the staff who teach them,
  and it matches the class chooser. Option (a) is a one-line change if you prefer it.

**D2. Who may approve a pending registration?**
- (a) Teachers who act on the section (assignment or homeroom). *Recommended.*
- (b) Keep the current grade rule.

**D3. Can teachers see the guardian's phone and name on the full profile?**
- Teachers record and call this number when a student is absent, so *recommend yes*.
  Confirm.

**D4. The principal's `/principal/students/[id]` route.**
- Keep it as a thin page that renders the shared component, or redirect it to
  `/students/[id]`. *Recommend: shared component on both routes, with the old URL kept.*

**D5. Log profile views?**
- Recording who opened a child's profile is worth doing for a school system. It adds a
  small audit table. *Recommend yes, as a follow-up phase.*

## Architecture

### Backend

1. **One scope rule** in `core/section_access.py`:
   - `teacher_section_ids(db, teacher)`: sections the teacher acts on, current year. This
     is `TeachingAssignment` OR `ClassSection.class_teacher_id`, the rule
     `list_my_sections` already uses.
   - `students_visible_to(db, teacher)`: current enrollments in those sections, school
     scoped. Used for lists, stats, approve/reject (per D2), and profile access (per D1).
   - Remove the `teacher_subjects` grade rule from `teacher/service.py`.
   - Approvals and rejects use the same rule, so a teacher can't see a student they
     can't act on.
2. **Endpoints** (teacher router, same prefix):
   - `GET /teacher/students?class_section_id=` and
     `GET /teacher/students/pending?class_section_id=`. Optional filter; omitted = all
     the teacher's classes.
   - `GET /teacher/sections` already exists. Feeds the class chooser, extended with
     approved/pending counts.
   - `GET /students/{student_id}`: the **single profile endpoint** for teachers and the
     principal. Permission check: approved teacher or principal of the student's school,
     then the D1 scope. Otherwise 404 (not 403), so ids can't be probed across schools.
     Students (role `student`) are never allowed.
3. **Response shapes**:
   - `StudentCard` (lists): id, full_name, class/section/roll, `login_phone`, status,
     photo_url, approved_at or applied_at. **No email, no guardian data.**
   - `StudentProfile` (full, one endpoint for both roles): card fields + `email`
     (shown; you asked for it), guardian name/relation/phone (per D3), enrolment,
     class teacher, plus `viewer` flags: `can_approve`, `can_reject`, `can_reset_login`
     (homeroom teacher only). The frontend shows actions from these flags. It never
     decides permission itself.
4. **Reuse** `approvals.service` for approve/reject and `issue_student_reset_code` for
   the reset code. Only the scope check changes.
5. **Old principal endpoint**: `GET /principal/students/{id}` returns the same DTO
   (principal call) so older clients keep working. Remove after the frontend switches.

### Frontend

1. **Centralised component** `components/students/student-profile.tsx`:
   - `<StudentProfile studentId backHref />` loads `GET /students/{id}` and renders the
     full profile. Shows the actions from `viewer` flags (approve, reject, reset code).
   - Used by `app/(protected)/(app)/students/[id]/page.tsx` (teacher) and
     `app/(protected)/principal/students/[id]/page.tsx` (principal). Both routes are thin
     wrappers. The principal's existing `components/principal/student-detail.tsx` is
     replaced by it.
2. **Students page** `app/(protected)/(app)/students/page.tsx` redesigned as three steps:
   - **Choose a class**: cards for each `GET /teacher/sections` entry, showing class,
     section, approved count, and a badge for pending. Pending classes are sorted first.
   - **Class view**: a "Waiting for approval" section on top (pending students, each
     with Approve / Reject and a click-through to the profile), then "Students" with a
     search box, and student cards.
   - **Student card**: name, class · roll, **phone** (tap to call on mobile), status
     chip. The whole card is a link to `/students/[id]`.
   - Mobile-first; back button returns to the class chooser; empty states per step.
   - No separate "all students" view. A teacher with one class lands straight in it.
3. **Shared primitives**: `StudentCard`, `PendingStudentCard`, `ClassCard` in
   `components/students/`. Used by the teacher page and, if you want, the principal's
   classes view later.
4. **Labels**: all new strings go in `lib/i18n/en.ts` and `hi.ts`.

### Data flow (teacher opens a class)

`/students` → `GET /teacher/sections` (chooser) → user picks a class →
`GET /teacher/students?class_section_id=X` and
`GET /teacher/students/pending?class_section_id=X` → user taps a card →
`/students/[id]` → `GET /students/{id}` → `<StudentProfile>`.

## Security and privacy

- Every new endpoint scopes by `school_id` first. Cross-school and out-of-scope ids are
  404, the same as today.
- Students never receive any of these endpoints, and the viewer-flags are computed on the
  server.
- Email is returned only by the full profile, not by lists.
- Guardian data (D3) goes only to staff the D1 rule admits.
- Student names and phones are a minor's data: the profile and list responses should be
  excluded from any cache (`Cache-Control: no-store`), and the frontend should not put
  them in URLs or local storage.
- Check against DPDP child-data rules before launch (not legal advice).

## Tests to add (backend)

- A homeroom-only teacher (no `teacher_subjects`) sees, approves, and rejects a pending
  student in their class.
- A teacher with no assignment to the section gets 404 on the profile and on the lists.
- A teacher at another school gets 404 on the profile.
- A student account gets 403/404 on every endpoint.
- The list payload has `login_phone` and no `email`; the profile payload has `email`.
- `can_reset_login` is true only for the homeroom teacher.
- Class filter returns only that section's students.
- Principal sees the same profile DTO as before via the old route.

## Phases

1. **Scope and bug fix (backend)**: shared scope helper; switch lists, stats, approve,
   reject to it (D2). Tests for the homeroom case. Fixes the reported pending bug.
2. **Endpoints (backend)**: class filter, card DTOs (phone, no email), unified profile
   endpoint with viewer flags (D1, D3). Tests above.
3. **Central profile component (frontend)**: `<StudentProfile>`, teacher and principal
   routes, replace principal detail.
4. **Students page redesign (frontend)**: class chooser, class view, pending first,
   card with phone, clickable. i18n.
5. **Verification**: `tsc`, eslint on changed files, backend suite, browser run as a
   homeroom-only teacher and as a subject teacher. Then your local test.
6. **(Optional, D5)** profile view audit log.

No database migration is needed. The DTO change and scope change are code-only.

## Files likely to change

- Backend: `core/section_access.py`, `teacher/service.py`, `teacher/router.py`,
  `teacher/schemas.py`, `principal/router.py`, `principal/service.py`, `principal/schemas.py`,
  `approvals/service.py` (only the scope call), new tests in `tests/`.
- Frontend: `app/(protected)/(app)/students/page.tsx`, new `students/[id]/page.tsx`,
  `principal/students/[id]/page.tsx`, `components/students/*` (new), delete
  `components/principal/student-detail.tsx`, `lib/api.ts`, `lib/i18n/en.ts`, `hi.ts`.


## Implementation notes (done locally)

Decisions taken: D1 section scope (assignment or homeroom), D2 section-based approval,
D3 teachers see guardian details, D4 shared component on both routes, D5 deferred.

- Pending bug: root cause was the grade rule (`teacher_subjects`) for lists and
  approvals. Lists, stats, approve, reject, and the class chooser now all use the one
  section rule (`core/section_access.teacher_current_section_ids`). The name is distinct
  from the older `teacher_section_ids`, which absence calls still use unchanged.
- Lists: `GET /teacher/students` and `/teacher/students/pending` take `class_section_id`.
  A class the teacher doesn't teach returns an empty list. Cards carry `login_phone` and
  no email.
- Chooser: `GET /teacher/sections` carries `students` and `pending_students` counts.
- Profile: `GET /students/{id}` (new `student_profile` module) is the one profile for
  teachers and the principal. Teachers get it for students in their sections; the
  principal, for any student in the school. Others get 404; students get 401.
  `viewer` flags say what the caller can do: approve/reject (teacher, pending),
  reset login (homeroom teacher only).
- `GET /principal/students/{id}` now returns the same shape (kept for the old URL).
- Principal's list builder fixed: it still passed `email=`, which would have failed
  after the schema change. A test now covers it.
- Frontend: `components/students/` (class chooser, student card, roster, pending list,
  shared `StudentProfileView`). Teacher page is class-first, with the class in the URL.
  Routes: `/students`, `/students/[id]`, `/principal/students/[id]`.
  `components/principal/student-detail.tsx` removed.
- Tests: `tests/test_teacher_student_scope.py` (12 cases, self-cleaning).
- Checked in the browser as Anita Verma: Class 10 A lists the pending student she
  couldn't see before; the profile opens with phone, guardian, and reset rights.
  Not browser-checked: the principal's profile route and the Hindi strings.
