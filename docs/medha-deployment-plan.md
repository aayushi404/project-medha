# Medha — Deployment Plan (Vercel + Render + Neon)

Three providers, three origins. The thing that breaks silently if skipped: the httpOnly refresh-token cookie crossing from `*.onrender.com` to `*.vercel.app` needs `SameSite=None; Secure`, or auth works in local dev and then quietly fails in production.

**Current stack (matches the repo):**
- Backend: FastAPI, `backend/` folder, package `backend`, entrypoint `backend.app:app`, managed with **uv** (`pyproject.toml` + `uv.lock`).
- Frontend: Next.js 16 App Router, `shiksha_sathi/` folder, **bun**.
- DB: Postgres +pgvector on **Neon** (already provisioned; connection strings in `backend/.env` — the commented `#DATABASE_URL` line is Neon).
- Auth: **email + password** (no OTP, no SMS). LLM: **Gemini** free tier. Retrieval: disabled until an embedding key is set.
- **One monorepo** at the project root (`git@github.com:aayushi404/project-medha.git`). Render deploys the `backend/` subdir (manual Web Service, free tier), Vercel deploys the `shiksha_sathi/` subdir.

---

## 0. What's already been done for you (in this repo)

- `backend/src/backend/core/config.py` — env-aware `Settings` (`environment`, `cookie_secure`, `cookie_samesite`).
- `backend/src/backend/auth/router.py` — refresh cookie uses `settings.cookie_secure` / `settings.cookie_samesite`; logout clears it with the matching attributes.
- `backend/requirements.txt` — pinned deps (fallback if you don't use uv on Render).
- `backend/.env.example`, `shiksha_sathi/.env.local.example` — updated with the prod vars.
- **Neon is already migrated to head (`0004_email_password_auth`) and seeded** (grades, subjects, 1 district + 1 school, the Class 6–8 curriculum chapters/topics, and a test teacher `homeofirstt@gmail.com` / `password123`).

So you can skip straight to creating the GitHub repos and the two services.

---

## 1. Env vars, per environment

| Variable | Local dev | Production |
|---|---|---|
| `DATABASE_URL` | local Docker Postgres | **Neon pooled** URL, psycopg2 driver: `postgresql+psycopg2://…-pooler.…/neondb?sslmode=require` |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | the real Vercel URL, e.g. `https://medha.vercel.app` (no trailing slash) |
| `ENVIRONMENT` | `development` | `production` |
| `COOKIE_SECURE` | `true` | `true` |
| `COOKIE_SAMESITE` | `lax` | `none` |
| `JWT_SECRET_KEY` | dev value | a fresh secret: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GEMINI_API_KEY` | your key | your key |
| `LLM_PROVIDER` / `GEMINI_MODEL` | `gemini` / `gemini-flash-lite-latest` | same |
| `NEXT_PUBLIC_API_URL` (frontend) | `http://localhost:8000` | the Render backend URL, e.g. `https://medha-backend.onrender.com` |

Never commit a production `.env`. Set these in the Render and Vercel dashboards.

---

## 2. Database (Neon) — already current

`alembic upgrade head` and the seed scripts have already been run against Neon.
The backend's **build command** (§3) re-runs `alembic upgrade head` on every
deploy, so future migrations apply automatically (it's a no-op when already
current). To run one manually from your machine instead:

```
cd backend
DATABASE_URL='postgresql+psycopg2://…-pooler.…/neondb?sslmode=require' uv run alembic upgrade head
```

The app's runtime `DATABASE_URL` should be the **pooled** endpoint — Render makes many short-lived connections.

> Only 1 school is seeded. That's enough for a demo; add more rows to `schools` (via Neon's SQL editor) before a real pilot so the onboarding typeahead has options.

---

## 3. Backend → Render (free-tier Web Service, no Blueprint)

Render's Blueprints and pre-deploy commands are paid features, so create the
service by hand.

1. Push the monorepo to GitHub (§6).
2. Render → **New → Web Service** → connect `project-medha`.
3. Settings:
   | Field | Value |
   |---|---|
   | **Root Directory** | `backend` ← **must be set** |
   | **Runtime** | Python 3 (Render reads `backend/.python-version` → 3.12) |
   | **Region** | Singapore (closest to India) |
   | **Instance Type** | Free |
   | **Build Command** | `bash render-build.sh` |
   | **Start Command** | `bash render-start.sh` |
   | **Health Check Path** | `/health` |

   **Do not use `uv run uvicorn …` as the Start Command.** On Render it
   rebuilds the package on every boot and often exits with status 1 before
   uvicorn ever starts. The scripts above install once at build time and
   start with `.venv/bin/python -m uvicorn` instead.

   *If Root Directory is blank* (monorepo root — your logs will show
   `file:///…/src/backend`), use the repo-root scripts instead:
   - Build: `bash render-build.sh`
   - Start: `bash render-start.sh`
   (these live at the repo root and `cd` into `backend/` automatically)

   *Pip fallback* (if uv gives trouble): Build Command
   `pip install -r requirements.txt && alembic upgrade head`, Start Command
   `PYTHONPATH=src python -m uvicorn backend.app:app --host 0.0.0.0 --port $PORT`,
   and add env var `PYTHONPATH=src`.

4. **Environment** tab — add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string, psycopg2 driver: `postgresql+psycopg2://neondb_owner:…@ep-…-pooler.…/neondb?sslmode=require` |
   | `JWT_SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `GEMINI_API_KEY` | your key |
   | `FRONTEND_ORIGIN` | placeholder for now (real Vercel URL in §5) |
   | `ENVIRONMENT` | `production` |
   | `COOKIE_SECURE` | `true` |
   | `COOKIE_SAMESITE` | `none` |
   | `LLM_PROVIDER` | `gemini` |
   | `GEMINI_MODEL` | `gemini-flash-lite-latest` |
   | `SARVAM_API_KEY` | your Sarvam key (**required for voice mic / talk mode**) |

5. Create the service. Note the URL (e.g. `https://medha-backend.onrender.com`).
6. Check `<render-url>/health` → `{"status":"ok"}` and `<render-url>/docs` loads.

### Render troubleshooting

**`Exited with status 1` right after `Installed 1 package` (no uvicorn logs)**
Your Start Command is almost certainly `uv run uvicorn …`. **Change it to**
`bash render-start.sh` (see §3). The `VIRTUAL_ENV` warning above that line is
harmless — the real bug is `uv run` rebuilding on start and dying silently.

**Logs show `file:///…/src/backend` instead of `file:///…/src`**
Root Directory is **not** set to `backend`. Either set it to `backend` and use
the scripts in `backend/`, or leave it blank and use the repo-root
`render-build.sh` / `render-start.sh`.

**`VIRTUAL_ENV does not match the project environment path .venv`**
Warning only — safe to ignore once you switch to `bash render-start.sh`.

**`uv sync --frozen` fails on deploy**
Run `uv lock` locally after changing `pyproject.toml`, commit `uv.lock`, redeploy.

**Service builds but `/health` never responds**
Check logs after uvicorn starts — common causes:
- `JWT_SECRET_KEY` not set in Render Environment (app crashes on import)
- `DATABASE_URL` missing or wrong (Neon pooled URL with `?sslmode=require`)

**Alembic fails during build**
Ensure `DATABASE_URL` is set under Render **Environment** (available at build time).

---

## 4. CORS + cookies — already wired, just confirm

`backend/src/backend/app.py` already does:
```python
app.add_middleware(CORSMiddleware,
    allow_origins=[settings.frontend_origin],   # exact origin, never "*" with credentials
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
    expose_headers=["X-Request-ID"])
```
and the refresh cookie is set with `secure=settings.cookie_secure`, `samesite=settings.cookie_samesite`. In production those must resolve to `true` / `none` (from the Render env vars in §3). `SameSite=None` **requires** `Secure=True`; Render serves HTTPS so that's satisfied.

The frontend already sends `credentials: "include"` on every call (`lib/api.ts` / `lib/sse.ts`) — no change needed.

---

## 5. Frontend → Vercel

1. Push the monorepo to GitHub (§6).
2. Vercel → **Add New → Project**, import `project-medha`. Set **Root Directory = `shiksha_sathi`**. Vercel auto-detects Next.js + bun.
3. **Environment Variables**: `NEXT_PUBLIC_API_URL` = the Render backend URL from §3.5.
4. Deploy. Note the URL Vercel assigns (e.g. `https://medha.vercel.app`).
5. Back in **Render**, set `FRONTEND_ORIGIN` to that exact Vercel URL (no trailing slash) and **Manual Deploy → Deploy latest commit** so CORS reflects the real origin.

---

## 6. Getting the code onto GitHub

The monorepo is already committed at the project root with `origin` set to
`git@github.com:aayushi404/project-medha.git`. Create that repo on github.com
(empty, no README), then:

```
cd /home/aayushi/projects/ai/shiksha_sathi
git push -u origin main
```

`.env` / `.env.local` are in `.gitignore` — `git status` shows only `.env.example`
templates.

- **Render**: New → Web Service → `project-medha`, **Root Directory = `backend`** (§3).
- **Vercel**: import `project-medha`, **Root Directory = `shiksha_sathi`** (§5).

---

## 7. The Render free-tier cold start

Free web services spin down after 15 min idle and take 30–60 s to wake. For your own demo that's fine — hit the URL once to warm it before showing anyone. Before putting it in front of a real teacher, either upgrade to Render's `starter` plan (~$7/mo, no spin-down) or point an UptimeRobot check at `/health` every 10 min as a stopgap.

---

## 8. End-to-end verification (in production, not just "it loads")

1. Open the Vercel URL → **Sign up** with a new email + password.
2. DevTools → Application → Cookies for the **Render** domain: `refresh_token` present with `Secure` and `SameSite=None`.
3. Reload the page → you stay logged in (silent `/auth/refresh`). This is what fails first if the cookie attributes are wrong.
4. Complete onboarding → the school typeahead returns the seeded school from Neon.
5. Pick a class/subject/chapter, ask a question → tokens stream in (Gemini). Generate a quiz + activity.
6. Open **My Modules** → the module is there; leave feedback; delete it.
7. **Edit profile** → change your subjects/classes, Save → the dashboard's Class/Subject dropdowns update.
8. Log out → cookie cleared, and the `auth_sessions` row is revoked (check in Neon's SQL editor).
9. Browser console: no CORS errors. If `FRONTEND_ORIGIN` doesn't exactly match the Vercel URL (scheme + host, no slash), requests fail in ways that look like network errors.

---

## 9. Order of operations

1. Create the empty `project-medha` repo on github.com, then `git push -u origin main`.
2. Render: **New → Web Service** → `project-medha`, Root Directory `backend`, build/start commands from §3, set all env vars → create → grab the URL.
3. Vercel: import `project-medha`, Root Directory `shiksha_sathi`, set `NEXT_PUBLIC_API_URL` to the Render URL → deploy → grab the URL.
4. Render: set `FRONTEND_ORIGIN` to the Vercel URL → Manual Deploy.
5. Run the §8 checklist.
6. Warm the free tier before demoing, or move to `starter` before a real teacher sees it.
