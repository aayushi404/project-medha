# Phone + password login — implementation plan

Status: **Phase 0 done** (audit script + local run). **Phase 1 done locally**
(`0031_phone_login_identity`, applied to the local DB and round-tripped on a
throwaway copy). **Phase 2 done locally** (backend auth; 18 new tests pass).
**Phase 3 done locally** (student identity; 15 new tests pass). Phases 4–7
pending. Production not touched.

**Phase 3 notes**
- Self-registration and claim no longer need an email. Both take `login_phone`.
- Re-application by a rejected applicant without an email matches on the roll
  slot, and only when phone and name match. Anyone else gets the roll-taken 409.
- Claim requires the phone the school recorded, if there is one. Otherwise it
  sets the phone.
- The importer requires `login_phone` on every row. Siblings may share a phone.
  Admission numbers are no longer read or written. A legacy "Admission No" column
  is ignored.
- Teacher-facing response schemas take `email: str | None`.
- Pre-existing, not fixed: `scripts/seed_students_demo.py` uses `grade_id` and
  `roll_number`, which migration 0027 removed, so it was already broken.
- For `0032`: `scripts/seed_class_sections_demo.py` still writes admission numbers
  and no phone. It has to be updated before the required-phone check is added.

**Phase 2 deviations and findings**
- Email verification no longer gates approval of teachers or students; it still
  gates principals. Existing test `test_auth_security` updated to match.
- Google sign-in is restricted to principal/admin. Teacher registration with a
  Google token is refused.
- Staff reset codes: a teacher's code comes from their principal; a student's
  only from their **class (homeroom) teacher** of the current section, not the
  subject-based grade scope (a class teacher may have no `teacher_subjects` row).
- The audit table records code issuance only. Redemption has no teacher actor
  (the student is the actor), so it is recorded on the token's `used_at`.
- `tests/test_api_prefix.py` set `dependency_overrides[get_db]` at import time,
  poisoning every other test in the session. Now scoped to its own module.
- Frontend login still posts to the old email endpoint for teachers and students
  and will fail until Phase 4.

## Why

Many students (and some teachers) have no personal email. Teachers and students
log in with phone + password instead of email + password. Principal and admin
login is unchanged. No OTP during the trial; the phone is stored so OTP can be
switched on later without a schema change.

## Current state (verified in code)

- Login is email-keyed on every tab: `LoginIn.email: EmailStr`,
  `auth/service.py:login` looks up `Teacher`/`Student` by email.
- `students.phone_number` is `unique=True` — one phone cannot map to two student
  profiles (siblings sharing a parent's number collide). Must change.
- `teachers.phone_number` is already unique and already filled from
  `mobile_number` at registration.
- `approvals/service.py:59` refuses approval unless `email_verified_at` is set —
  a phone-only teacher could never be approved. Must change (teachers/students
  check phone, principals keep the email check).
- Email-driven flows: forgot/reset password, verification mail, Google sign-in
  (linked by email), student self-register (`email` required), `/student/claim`
  (`email` required), CSV import (sends "set password" emails).
- `admission_number` is used in ~15 places (model + unique constraint,
  `principal/student_import.py`, `principal/schemas.py`, `principal/service.py`,
  `student-detail.tsx`, `lib/api.ts`, `lib/student-csv.ts`,
  `scripts/backfill_teacher_students.py`, `scripts/seed_class_sections_demo.py`,
  migration 0021).
- **Dependency:** the teacher/student split (migrations 0023–0025) is local-only
  and not yet on production. It must reach production before this plan.

## Phase 0 — decisions and data audit (done)

- `backend/scripts/audit_phone_numbers.py` — read-only audit. Exit 0 = no
  blockers. Blockers: unparseable teacher/student phones, teacher phones that
  collide after E.164 normalisation, `role='teacher'` rows with no phone.
  Informational: students with no login phone, phones shared by students,
  admission numbers that 0032 will drop.
- Run against **local** docker DB (localhost:5431, head `0030_class_teacher_exclusivity`):
  7 teachers, 10 students, 0 blockers, 0 shared phones, 0 admission numbers.
- Not yet run against production (Neon). That needs explicit go-ahead.
- Normaliser checked: `9876543210`, `+919876543210`, `09876543210`,
  `+91 98765-43210` → `+919876543210`; non-Indian and malformed inputs → rejected.

### Decisions (provisional defaults — confirm before Phase 1)

1. Teacher email: **optional**. Principals keep email.
2. Google sign-in on teacher/student login: **disabled** on those tabs
   (it links by email and bypasses phone login). Endpoint kept behind a flag.
3. Student import `login_phone`: **required** column; no fallback to guardian phone.
4. Admission numbers: drop in 0032 **only after** confirming production has no
   data that matters.
5. Lookup response: full name + class + roll number (matches the picker design).
6. Password recovery: **staff-issued one-time codes** (principal resets teachers,
   teacher resets students) until SMS exists.

## Phase 1 — expand migration `0031_phone_login_identity` (additive)

1. Normalise `teachers.phone_number` and `students.phone_number` to E.164.
   Unparseable rows are reported, never deleted.
2. Drop the unique constraint on `students.phone_number` (confirm its name with
   the inspector first); add a non-unique partial index for lookups.
3. Add `phone_verified_at` to `teachers` and `students` (null for now; OTP hook).
4. ~~Add `NOT VALID` phone-required checks~~ **Moved to 0032.** Old code (bulk
   import, self-register, `/student/claim`) still inserts students without a
   phone, and even a NOT VALID check fires on new inserts.
5. Add `account_audit_events` for staff-issued resets.

**Finding:** the model declared `students.phone_number` as `unique=True`, but
no migration ever created that constraint. The local DB had only a plain
column. The migration guards for it anyway, and the model was corrected to a
non-unique partial index (`idx_students_phone`).

**Refusal:** the migration aborts, changing nothing, if any teacher phone is
unparseable or duplicated, or a `role='teacher'` row has no phone.
Tested on a throwaway copy with a planted bad phone: refused, stayed at `0030`.

## Phase 2 — backend auth (`auth/`)

- Split `LoginIn` into an email schema (principal/admin only) and a phone schema
  (teacher/student). `POST /auth/login` rejects teacher/student; new
  `POST /auth/login/phone`.
- `POST /auth/student/lookup {phone}` → minimal profile list (id, name, class,
  roll, photo). No guardian data, no emails.
- For students, login checks that `student_id` belongs to the given phone before
  verifying the password.
- Throttle scopes: `phone_lookup` (per IP and per phone), `login_phone`
  (per IP+phone, per phone), hashed like the existing scopes.
- `register()`: teachers need phone, email optional; principals unchanged.
- Approval gate: teachers/students check `phone_verified_at` only when
  `settings.phone_otp_required` is on (off for trial); principals keep email check.
- Staff-issued reset: 10-char single-use code, 15-minute expiry, hashed, shown
  once to staff, audited. `POST /auth/reset-with-code {phone, code, new_password}`,
  throttled per phone.
- Password policy: handle accounts with no email.

## Phase 3 — student, teacher, principal flows

- Student self-register and `/student/claim`: email optional, phone required.
- `principal/student_import.py`: drop admission column, dedupe and update path;
  add required `login_phone`; dedupe on (school, section, roll) for current year.
  Legacy CSVs with an "Admission No" column still parse (unknown column ignored).
- Drop `admission_number` from `principal/schemas.py`, `principal/service.py`,
  profile responses; make email nullable in responses.

## Phase 4 — frontend login

- `app/login/page.tsx`: Teacher tab = phone + password; Principal tab = email +
  password (unchanged); Student tab links to `/login/student`.
- New: `app/login/student/layout.tsx` (in-memory context, no storage),
  `page.tsx` (phone), `profiles/page.tsx` (cards: name, class, roll),
  `password/page.tsx`. Refresh returns to step 1.
- `lib/auth-context.tsx`: `loginWithEmail` / `loginWithPhone`.
- `lib/api.ts`, `lib/validation/auth.ts`: split schemas; `mobileField` for phone.

## Phase 5 — frontend forms

- Student self-register: email removed, login phone added.
- Staff register: email optional for teachers.
- `/student/claim`: email removed, phone added.
- `/forgot-password`: phone-only message + code-entry page.
- Principal import dialog and `lib/student-csv.ts`: admission column → login phone.
  `student-detail.tsx`: show phone instead of admission number.
- Teacher roster / student detail: "Reset login code" action.
- New strings in both `lib/i18n/en.ts` and `hi.ts`.

## Phase 6 — contract migration `0032` (after code stops reading admission_number)

- Drop `students.admission_number` and its unique constraint.
- Update or retire `scripts/backfill_teacher_students.py` and
  `scripts/seed_class_sections_demo.py`.

## Phase 7 — verification

- Backend tests: lookup returns only that phone's students; a `student_id` from
  another phone → generic 401; email login for teacher rejected; reset codes
  single-use and expiring; approval gate per role; sibling profiles with separate
  passwords; import without admission number.
- Migration dry run on a copy of the local DB.
- `tsc`, eslint, browser click-through (teacher phone login; three-step student flow).
- Production migrations (0023 → 0032) only with explicit approval.

## Security notes

- Trial trade-off: no OTP, so anyone can enter a phone number. Principal approval
  (teachers) and teacher approval (students) are the real gate until OTP is on.
- Lookup enumeration: the picker necessarily reveals which numbers have profiles
  and the names on them. Mitigated by throttles and minimal fields. Accepted trade-off.
- Student names are minors' data. Check against DPDP Act child-data rules
  (not legal advice).
- Staff resets: audited, single-use, short-lived, hashed.

**Phase 4 notes (frontend login, done locally)**
- `/login`: Teacher tab = phone + password (`loginWithPhone`). Principal tab =
  email + password (`loginWithEmail`, unchanged). Student tab links to `/login/student`.
- `/login/student` (3 steps): `layout.tsx` holds the flow in memory only (no storage);
  a refresh starts again at the phone step. `page.tsx` = phone, `profiles/` = picker
  (name, class, roll; masked number), `password/` = password for the chosen profile.
  Pending and rejected outcomes render in the layout.
- `lookupStudentProfiles` in `lib/api.ts`; `postLogin` in `lib/auth-context.tsx`
  shares error handling between the two login paths.
- Teacher and student login no longer show a "Forgot password" email link. The text
  points to the staff reset code. The code entry page is Phase 5.
- Admission-number types in `lib/api.ts` are left for Phase 5, with their consumers.
- Checked: `tsc --noEmit` and eslint on the changed files, both clean. In the browser:
  teacher phone login (wrong password shows the error, right one reaches the
  dashboard); a signed-in visit to `/login/student` redirects away; student phone →
  profile → password → signed in as the student.
- Not yet checked in the browser: the student wrong-password toast, the principal
  tab, the Hindi strings, and the pending/rejected outcome screens.

**Phase 5 notes (frontend forms, done locally)**
- Student self-register: email removed; `login_phone` required. The done screen no
  longer says "we've emailed a link" when there is no email.
- Staff register: email optional for teachers, required for principals. The done
  screen follows whether an email was given.
- `/student/claim`: email replaced by the login phone. The success text says to log in
  with the mobile number.
- `/forgot-password`: principals still reset by email. Teachers and students are
  pointed to their principal or class teacher, and to the new `/reset-with-code` page.
- `/reset-with-code` (new): teacher or student tab, phone, profile choice for students
  (lookup), code, new password. The code is normalised to upper case and without dashes.
- Principal teacher detail: "Reset login code" button. The code shows once, in
  `components/auth/reset-code-panel.tsx`, and is dropped when the panel closes.
- Teacher students page: per-row "Reset login code" action. The server allows it only
  for the student's class teacher, and the error is shown as-is.
- Import: `Admission No` replaced by a required `Login Phone` column. The CSV parser
  reports a missing login phone against the header. Email stays optional for the
  invite. The importer copy now says students claim with their phone number.
- Principal student detail shows the login phone. Privacy page wording updated.
- `lib/api.ts`: admission types removed. New `issueTeacherResetCode`,
  `issueStudentResetCode`, `resetWithCode`.
- Checked: `tsc --noEmit` and ESLint clean on the changed files. In the browser:
  student register shows the phone field and no email; reset-with-code renders; the
  principal issued a reset code for a teacher from the new button, and that code reset
  the teacher's password (the same password was set again, so seed data is unchanged).
- Not checked in the browser: the CSV import dialog (needs a file upload), the
  student-side reset button, claim, and the Hindi strings for the new screens.
- The public recovery pages (forgot, reset-with-code, claim) stay English-only, as their
  sibling pages do. The new staff-side strings are in en and hi.

**Phase 6 notes (contract migration `0032_phone_login_contract`, done locally)**
- Adds CHECKs on both tables, added NOT VALID and then validated:
  `students.phone_number` required and E.164; `teachers` with role 'teacher' require a
  phone; any teacher phone that is present must be E.164. Principals and admins may
  leave it blank.
- Drops `students.admission_number` and its unique constraint. The downgrade restores
  both, empty.
- Preflight: refuses with a list of every blocking row, changes nothing. Tested on a
  copy of the local DB: upgrade, rejected inserts (no phone, bare 10-digit), downgrade
  and re-upgrade, and the refusal path with two planted bad rows (stayed at 0031).
- Models: `Student` drops the admission column and gains the checks. `Teacher` gains
  the checks.
- Claim: the login phone must now equal the school-recorded one. The "school recorded
  no phone" branch can't occur any more. Test updated: a phone-less row is refused by
  the database.
- `scripts/seed_class_sections_demo.py`: no admission numbers. Each demo student gets
  the guardian's number as the login phone, looked up by school and name. Runs and
  re-runs cleanly on the copy (after renaming a school to match its hard-coded name).
- `scripts/backfill_teacher_students.py`: refuses once `admission_number` is gone. It
  must run before 0032 in any database that still needs the 0023-0025 split.
- `scripts/audit_phone_numbers.py`: students with no phone are now blockers, and the
  admission check tolerates the column being absent.
- Full backend suite on the local DB at 0032: 75 passed, 2 failed. The two failures
  predate this work (see Phase 2 notes).
- Pre-existing, unrelated: `seed_class_sections_demo.py` looks for a school named
  "Patna Sadar", which this local database doesn't have.

**Production order (nothing has been run on production)**
1. Run `scripts/audit_phone_numbers.py` against production (read-only). It must show
   no blockers. Any student without a phone must be fixed first (the claim/import flow
   or a direct update).
2. Deploy the code from Phases 2-5, so nothing writes admission numbers or phone-less
   students.
3. Apply 0023 through 0031, with the teacher/student backfill run where needed.
4. Apply 0032 only after step 1 is clean on the database being migrated.

**Phase 7 notes (verification, local)**
- Backend suite on the local DB at 0032: 76 passed, 2 failed. The two failures predate
  this work: `test_api_prefix::test_refresh_cookie_path_follows_the_prefix` (logout
  without the X-Medha-Client header) and `test_omr_api::test_omr_evaluate_valid_sheet`
  (missing class_section_id query param). Not fixed; they are test bugs, out of scope.
- Added: expired reset-code test (`test_an_expired_code_is_refused_with_the_generic_answer`).
  Phone-login suite: 19 passed.
- Frontend: `tsc --noEmit` passes. ESLint on every file changed in this work is clean.
  The project-wide ESLint run has 27 errors in files this work doesn't touch
  (voice, report-card, export helpers, landing, principal analytics/notice board/work
  updates, and others). Pre-existing; not fixed.
- Migration: 0032 tested on copies of the local DB (upgrade, rejected writes,
  round trip, refusal). Local DB is at 0032.
- Local servers left running for manual testing: backend http://localhost:8000
  (local DB only), frontend http://localhost:3000.
- Test accounts (local seed): teacher 9876543212 / Password@123 (Rajesh Kumar);
  principal principal.patna@medhabihar.org / Password@123; student 9800000001 /
  Password@123 (Aditi Sharma, Class 6 A, roll 1). The seed has no sibling pair; the
  sibling tests create one temporarily and restore it.

**Still needed before production**
- Dry run of the full chain on a copy of the production database (needs a dump).
- Production audit (read-only), then the production steps in the Phase 6 notes.
- Your manual test on the local servers.
