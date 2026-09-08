Here’s a short checklist you can send your teammate:

---

### 1. Neon (database)
Nothing manual is required if Render’s build still runs `alembic upgrade head` (it does).

Ask them to:
1. After Render deploys successfully, open Neon → SQL Editor and confirm new tables exist, e.g.:
   - `homework`, `homework_status`
   - `notifications`, `device_tokens`
   - `timetable_entries`
   - `report_card_marks`
   - `library_items`
   - `fee_payments`
   - `chapter_notes`, `practice_questions`
2. Or run: `SELECT version_num FROM alembic_version;` — it should be **`0020_notes_practice`**.

If deploy failed before migrations, run from their machine:

```bash
cd backend
DATABASE_URL='postgresql+psycopg2://…-pooler.…/neondb?sslmode=require' uv run alembic upgrade head
```

---

### 2. Render (backend)
Ask them to:
1. Make sure the service is on branch **`main`** and **redeploy latest** (Manual Deploy if auto-deploy didn’t run).
2. Confirm build uses `bash render-build.sh` (runs migrations + library seed).
3. Confirm existing env vars are still set:
   - `DATABASE_URL` (Neon **pooled** URL + `?sslmode=require`)
   - `FRONTEND_ORIGIN` = exact Vercel URL (no trailing slash)
   - `ENVIRONMENT=production`
   - `COOKIE_SECURE=true`
   - `COOKIE_SAMESITE=none` ← important for login across Vercel ↔ Render
   - `JWT_SECRET_KEY`, `GEMINI_API_KEY`, `SARVAM_API_KEY`
4. Optional new vars (only if you want these features live now):
   - `GOOGLE_CLIENT_ID` — Google sign-in
   - `FIREBASE_CREDENTIALS_PATH` — push notifications (in-app inbox works without this)
5. After deploy, check:
   - `https://<render-url>/health` → `{"status":"ok"}`
   - `https://<render-url>/docs` loads

---

### 3. Vercel (frontend)
Ask them to:
1. Redeploy from **`main`** (Root Directory should stay `shiksha_sathi`).
2. Confirm env:
   - `NEXT_PUBLIC_API_URL` = Render backend URL, e.g. `https://medha-backend.onrender.com` (no trailing slash)
3. Open the live site and smoke-test:
   - Login (teacher / principal / student)
   - Teacher: homework, notes, practice, timetable, resources
   - Principal: announcements + fees
   - Student: my-homework, my-notes, my-practice, fees

---

### Order that matters
1. Push already done on `main`  
2. **Render deploy** (migrations run here)  
3. Confirm Neon is at `0020_notes_practice`  
4. **Vercel deploy**  
5. Quick smoke test of teacher / principal / student flows  

---

**You don’t need Neon access yourself** if Render deploys cleanly — migrations apply on build. The one thing to double-check with them: Render finished green and alembic is at **`0020_notes_practice`**.