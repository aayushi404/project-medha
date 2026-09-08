# Medha — Email/Password Auth + Role-Based Approval System

Supersedes the phone-OTP auth design. Admin → approves Principals → approve Teachers.
One account model, three roles, one login form.

---

## 0. Two design decisions worth settling first

**No separate `principals` table.** A principal needs everything a teacher account needs — email, password, sessions, profile. A parallel table duplicates the entire auth stack. Your existing `teachers` table already has a `role` column; rename the table to `users` and let `role` do the work.

**No role selector on the login form.** Role belongs on the *registration* form. At login the user enters email + password, and the backend resolves who they are. A "login as admin" tab invites probing and confuses users who tap the wrong one. One login form, role-based routing after authentication.

---

## 1. Schema changes

### 1.1 Rename `teachers` → `users`

Do it now, while the table holds only seed data.

```python
op.rename_table('teachers', 'users')
op.alter_column('teacher_subjects', 'teacher_id', new_column_name='user_id')
op.alter_column('auth_sessions', 'teacher_id', new_column_name='user_id')
op.alter_column('chat_sessions', 'teacher_id', new_column_name='user_id')
op.alter_column('lesson_kits', 'teacher_id', new_column_name='user_id')
op.alter_column('generation_jobs', 'teacher_id', new_column_name='user_id')
op.alter_column('kit_feedback', 'teacher_id', new_column_name='user_id')
```

Postgres carries foreign key constraints through a rename automatically. Update your SQLAlchemy models and repositories to match.

### 1.2 Switch auth from phone/OTP to email/password

```sql
-- Email and password become required and primary
alter table users
    alter column email set not null,
    alter column password_hash set not null;

create unique index idx_users_email_lower on users (lower(email));

-- phone_number stays, but as a contact field, not a credential
alter table users
    alter column phone_number drop not null;
alter table users drop constraint if exists users_phone_number_key;
```

Store and compare email **case-insensitively** — teachers will type `Ramesh@gmail.com` on Monday and `ramesh@gmail.com` on Friday and expect to log in both times. The functional unique index above handles this; normalize to lowercase on write too.

**Drop the OTP table** (or leave it unused if you might want OTP later — but don't maintain dead code):

```sql
drop table if exists otp_verifications;
```

### 1.3 New teacher profile fields

```sql
alter table users
    add column mobile_number text,
    add column years_of_experience int,
    add column employee_code text,          -- see note below
    add column qualification text;          -- e.g. B.Ed, M.Sc

alter table users
    add constraint chk_experience_range
        check (years_of_experience is null
               or (years_of_experience >= 0 and years_of_experience <= 50));
```

**Why `employee_code`:** the principal's job is to confirm this person actually teaches at their school. A name and phone number alone don't let them do that — but a government teacher ID does, since the principal can check it against their staff records. This is the single field that turns approval from a guess into a verification. Make it optional at the DB level but required in the teacher registration form.

`qualification` is optional — include it if you want it, it's cheap. `years_of_experience` as an integer is better than a free-text field: it's filterable and sortable, and eventually useful for personalizing how the assistant pitches explanations.

### 1.4 Approval columns

```sql
alter table users
    add constraint chk_users_role
        check (role in ('admin', 'principal', 'teacher')),
    add column approval_status text not null default 'pending',
    add column approved_by uuid references users(id),
    add column approved_at timestamptz,
    add column rejection_reason text,
    add constraint chk_users_approval_status
        check (approval_status in ('pending', 'approved', 'rejected'));

-- Admins have no school
alter table users alter column school_id drop not null;

create index idx_users_pending on users(school_id, role, approval_status)
    where approval_status = 'pending';

-- At most one approved principal per school
create unique index idx_one_approved_principal_per_school
    on users(school_id)
    where role = 'principal' and approval_status = 'approved';
```

`approved_by` self-references `users`, giving you a free audit trail of who admitted whom — worth having in a government-facing product.

### 1.5 Password reset tokens

```sql
create table password_reset_tokens (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references users(id) on delete cascade,
    token_hash      text not null,
    expires_at      timestamptz not null,
    used_at         timestamptz,
    created_at      timestamptz not null default now()
);

create index idx_reset_tokens_user on password_reset_tokens(user_id, expires_at);
```

Store the **hash** of the token, never the token itself — same reasoning as passwords. Expire in 1 hour, single-use.

### 1.6 Approval audit log

```sql
create table approval_events (
    id              uuid primary key default uuid_generate_v4(),
    subject_user_id uuid not null references users(id) on delete cascade,
    actor_user_id   uuid not null references users(id),
    action          text not null,          -- approved | rejected | revoked
    reason          text,
    created_at      timestamptz not null default now()
);
```

### 1.7 Seed the admin

Admins are never self-registered:

```python
admin = User(
    full_name="System Admin",
    email="admin@medha.local",
    password_hash=hash_password("<strong seeded password>"),
    role="admin",
    approval_status="approved",
    school_id=None,
    onboarded_at=datetime.now(timezone.utc),
)
```

Change that password on first login. Don't commit it to the repo.

---

## 2. Backend — auth

### 2.1 Password hashing

Use `passlib` with **bcrypt** (or argon2). Never store plaintext, never use a general-purpose hash like SHA-256 for passwords.

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(p: str) -> str: return pwd_context.hash(p)
def verify_password(p: str, h: str) -> bool: return pwd_context.verify(p, h)
```

Minimum password policy: 8+ characters. Resist the urge to require symbols and mixed case — for this user base, complexity rules mostly produce passwords written on sticky notes. Length is what matters.

### 2.2 Registration

`POST /auth/register`

Teacher payload:
```json
{
  "role": "teacher",
  "full_name": "...",
  "email": "...",
  "password": "...",
  "mobile_number": "...",
  "employee_code": "...",
  "years_of_experience": 7,
  "qualification": "B.Ed",
  "school_id": "uuid"
}
```

Principal payload: same minus `years_of_experience`/`employee_code` if you prefer, plus `school_id`.

Rules:
- **Reject `role: "admin"` outright.** If clients can set their own role, anyone reading your API can make themselves an admin. This is the single most important line in this document.
- Normalize email to lowercase; reject duplicates with a clear message.
- Validate mobile number format (10 digits for India; strip `+91`/spaces before storing).
- Teachers: reject if the school has no approved principal, with a readable message — otherwise they queue where nobody is watching.
- Principals: reject if the school already has an approved principal.
- Create with `approval_status='pending'`. **Return a pending status, not a session token.** Registering does not log you in.

### 2.3 Login

`POST /auth/login` — email + password.

```python
user = repo.get_by_email(email.lower())
if not user or not verify_password(password, user.password_hash):
    raise HTTPException(401, "Invalid email or password")   # same message either way

if user.approval_status == 'pending':
    raise HTTPException(403, detail={"code": "PENDING_APPROVAL"})
if user.approval_status == 'rejected':
    raise HTTPException(403, detail={"code": "REGISTRATION_REJECTED",
                                     "reason": user.rejection_reason})
```

Return the same "invalid email or password" for both a missing user and a wrong password — distinguishing them tells an attacker which emails are registered.

Only `approved` users receive tokens. Keep your existing JWT access token + httpOnly refresh cookie design (including the `SameSite=None; Secure` production config from the deployment plan) — that part doesn't change, only how credentials are checked.

**Add login rate limiting**: 5 failed attempts per email per 15 minutes. Password auth without throttling is brute-forceable in a way OTP wasn't.

### 2.4 Password reset

- `POST /auth/password-reset/request` — takes email, always returns 200 regardless of whether the email exists (again, don't leak registration status). If it exists, generate a token, store its hash, email the link.
- `POST /auth/password-reset/confirm` — token + new password. Verify hash, check not expired and not used, update `password_hash`, mark `used_at`, and **revoke all existing `auth_sessions`** for that user.

This needs an email provider. For dev, build an `EmailProvider` interface with a console-logging mock — same swappable-adapter pattern as your SMS provider. For production, Resend or Brevo both have workable free tiers.

### 2.5 Role guards

```python
def require_role(*allowed: str):
    def _guard(user = Depends(get_current_user)):
        if user.role not in allowed:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _guard

require_admin = require_role('admin')
require_principal = require_role('principal')
require_teacher = require_role('teacher')
```

---

## 3. Backend — admin & principal endpoints

### Admin
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/stats` | Schools registered, principals, teachers, pending count |
| GET | `/admin/principals/pending` | Pending applications with school details |
| POST | `/admin/principals/{id}/approve` | Approve |
| POST | `/admin/principals/{id}/reject` | Reject (reason required) |
| GET | `/admin/schools` | Schools + principal status |

### Principal
| Method | Path | Purpose |
|---|---|---|
| GET | `/principal/stats` | Teacher count, pending count |
| GET | `/principal/teachers` | Approved roster |
| GET | `/principal/teachers/pending` | Pending applications, with mobile, experience, employee code |
| POST | `/principal/teachers/{id}/approve` | Approve |
| POST | `/principal/teachers/{id}/reject` | Reject (reason required) |

**Scope every principal query by their own `school_id` in the repository layer, not the router.** A principal passing another school's teacher ID must get nothing. Router-level checks can be forgotten on the next endpoint you add; repository-level ones can't.

Each approval is one transaction: update status + `approved_by` + `approved_at`, insert an `approval_events` row. Require a reason on rejection — a teacher told only "rejected" will re-register and recreate the problem.

---

## 4. Frontend

### 4.1 Registration page
Role toggle (Principal / Teacher) at the top — this is where role selection belongs. Teacher form fields: name, email, password + confirm, mobile number, employee code, years of experience, qualification, school (typeahead). On submit, show a "waiting for principal approval" screen, not a dashboard redirect.

Keep the form on one screen if you can. A multi-step wizard for eight fields adds friction without benefit.

### 4.2 Login page
Email + password + "Forgot password?" link. No role tabs. Handle the two 403 codes distinctly:
- `PENDING_APPROVAL` → friendly waiting screen ("Your principal hasn't approved your account yet"), not a red error.
- `REGISTRATION_REJECTED` → show the reason, offer a path forward.

### 4.3 Password reset pages
Request page (email input) and confirm page (reads token from URL query param, new password + confirm).

### 4.4 Role-based routing
After `/auth/me`:
- `admin` → `/admin`
- `principal` → `/principal`
- `teacher` → `/onboarding` if `onboarded_at` is null, else `/dashboard`

Guard routes client-side for UX and server-side for actual security. Client guards alone are not security.

### 4.5 Admin dashboard
Stat cards (schools, principals, teachers, pending) + pending-approvals table: name, email, school, district, applied date, Approve/Reject. Rejection opens a modal requiring a reason.

### 4.6 Principal dashboard
Same shape, scoped to their school. The pending-teacher table should show **mobile number, employee code, and years of experience** inline — that's the information the principal needs to make the decision without clicking into each row.

---

## 5. Build order

1. Migration: rename table, email/password columns, new profile fields, approval columns, reset tokens, drop OTP table.
2. Update SQLAlchemy models + repositories.
3. Password hashing utilities; seed the admin.
4. Register + login endpoints with approval-status checks.
5. `require_role` dependencies.
6. Admin endpoints → admin dashboard. Test admin→principal approval fully before moving on.
7. Principal endpoints → principal dashboard.
8. Password reset (endpoints + email provider mock + frontend pages).
9. End-to-end click-through: seed admin → register principal → admin approves → principal logs in → register teacher → principal approves → teacher logs in → onboarding → dashboard.

Step 9 as a real click-through, not curl commands. The state transitions are where this breaks and they're only visible end to end.

---

## 6. Edge cases to decide now

- **Rejected user re-registering.** Their email already exists with `rejected`. Either allow flipping the existing row back to `pending`, or block re-registration. Pick one — don't leave the user staring at a unique-constraint error.
- **Teacher registers before any principal exists at their school.** Blocked at registration (§2.2). Queueing them invisibly creates an unowned support burden.
- **Principal leaves.** You'll need a `revoked` action eventually; the partial unique index means the old principal must be moved out of `approved` before a new one can be approved. Not V1, but it's coming.
- **Revoking an approved teacher.** Existing `auth_sessions` stay valid until expiry — revoke them in the same transaction if immediate lockout matters.
- **Schools not in your database.** Your `schools` table currently holds test seed data. Real principals will register for schools that aren't there. Either let principals propose a new school during registration (pending admin verification), or load Bihar's school list from UDISE data before the pilot. The typeahead is only as good as the list behind it — this is a real pilot blocker, not a nice-to-have.
