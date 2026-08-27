# Medha — Deployment Plan (Vercel + Render + Neon)

Three providers, three origins. The thing that breaks silently if skipped: the httpOnly refresh-token cookie crossing from `*.onrender.com` to `*.vercel.app` needs `SameSite=None; Secure`, or auth works in local dev and then quietly fails in production.

**Current stack (matches the repo):**
- Backend: FastAPI, `backend/` folder, package `backend`, entrypoint `backend.app:app`, managed with **uv** (`pyproject.toml` + `uv.lock`).
- Frontend: Next.js 16 App Router, `shiksha_sathi/` folder, **bun**.
- DB: Postgres + pgvector on **Neon** (already provisioned; connection strings in `backend/.env` — the commented `#DATABASE_URL` line is Neon).
- Auth: **email + password** (no OTP, no SMS). LLM: **Gemini** free tier. Retrieval: disabled until an embedding key is set.
- **One monorepo** at the project root (`git@github.com:aayushi404/project-medha.git`). Render deploys the `backend/` subdir (via the root `render.yaml`), Vercel deploys the `shiksha_sathi/` subdir.

---

## 0. What's already been done for you (in this repo)

- `backend/src/backend/core/config.py` — env-aware `Settings` (`environment`, `cookie_secure`, `cookie_samesite`).
- `backend/src/backend/auth/router.py` — refresh cookie uses `settings.cookie_secure` / `settings.cookie_samesite`; logout clears it with the matching attributes.
- `backend/render.yaml` — Render Blueprint (build/start/pre-deploy commands, env var scaffold).
- `backend/requirements.txt` — pinned fallback for Render's pip auto-detect path (the Blueprint uses uv).
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

`alembic upgrade head` and the seed scripts have already been run against Neon. If you add migrations later, the Render **pre-deploy command** (`uv run alembic upgrade head`) runs them on each deploy. To run one manually against Neon from your machine:

```
cd backend
DATABASE_URL='postgresql+psycopg2://…-pooler.…/neondb?sslmode=require' uv run alembic upgrade head
```

The app's runtime `DATABASE_URL` should be the **pooled** endpoint — Render makes many short-lived connections.

> Only 1 school is seeded. That's enough for a demo; add more rows to `schools` (via Neon's SQL editor) before a real pilot so the onboarding typeahead has options.

---

## 3. Backend → Render

1. **Push `backend/` to a GitHub repo** (see §6).
2. Render → **New → Blueprint**, pick that repo. It reads `backend/render.yaml` and proposes a `medha-backend` web service (Singapore, free plan, `/health` check).
   - *Or* New → Web Service manually: runtime Python, build `pip install uv && uv sync --frozen`, start `uv run uvicorn backend.app:app --host 0.0.0.0 --port $PORT`, pre-deploy `uv run alembic upgrade head`.
3. In the service's **Environment** tab, fill the `sync: false` vars: `DATABASE_URL` (Neon pooled), `JWT_SECRET_KEY` (new secret), `GEMINI_API_KEY`, `FRONTEND_ORIGIN` (leave as a placeholder for now — you'll set the real Vercel URL in §5).
4. Deploy. Note the URL Render assigns (e.g. `https://medha-backend.onrender.com`).
5. Check `https://<render-url>/health` → `{"status":"ok"}` and `https://<render-url>/docs` loads.

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

1. **Push `shiksha_sathi/` to a GitHub repo** (see §6).
2. Vercel → **Add New → Project**, import that repo. Root directory `.`. Vercel auto-detects Next.js + bun.
3. **Environment Variables**: `NEXT_PUBLIC_API_URL` = the Render backend URL from §3.4.
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

- **Render**: New → Blueprint → `project-medha`. The root `render.yaml` has
  `rootDir: backend`, so the service builds/runs from `backend/`.
- **Vercel**: import `project-medha`, set **Root Directory = `shiksha_sathi`**.

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

1. `git commit` + push `backend/` and `shiksha_sathi/` to two GitHub repos.
2. Render: Blueprint from the backend repo → set the secret env vars → deploy → grab the URL.
3. Vercel: import the frontend repo → set `NEXT_PUBLIC_API_URL` to the Render URL → deploy → grab the URL.
4. Render: set `FRONTEND_ORIGIN` to the Vercel URL → redeploy.
5. Run the §8 checklist.
6. Warm the free tier before demoing, or move to `starter` before a real teacher sees it.
