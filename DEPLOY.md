# Deployment & Backend Setup

The app runs in one of two storage modes, chosen automatically from environment variables:

| Mode | When | Login | Storage |
| --- | --- | --- | --- |
| **Local** | `make server` (no Supabase env) | @beesbridge.us email gate (no code) | local SQLite file |
| **Supabase** | env vars set (Vercel / `.env.local`) | @beesbridge.us email gate (no code) | shared Postgres (open table) |

There is **no real authentication** — entering a `@beesbridge.us` email is a front-end gate, and the
email is the profile id. Both modes save results keyed by email and use the same strong
spaced-repetition weighting (failed and unseen questions appear much more often).

---

## 1. Run locally (`make server`)

```bash
make server
```

This launches the Vite front-end (http://localhost:5173) **and** a small local API backed by
SQLite (http://localhost:8787). Sign in with any `@beesbridge.us` email — locally no code is
required (it's a dev convenience). Results are written to `server/data/exam.db`, which is
**gitignored** and never committed. Use `make clean-db` to wipe it.

> First run compiles `better-sqlite3` (a native module) — that's normal and only happens once.

---

## 2. Set up Supabase (for hosted/production)

No Supabase Auth is used — only the database.

1. Create a project at https://supabase.com (free tier is fine).
2. In **SQL Editor → New query**, paste and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `attempts` and `answers` tables (one **shared** dataset for all users, keyed by
   email), opens row-level security to the **anon** role, and adds a CHECK constraint so only
   `@beesbridge.us` emails can be written.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

That's it — you don't need to touch the Auth section at all.

---

## 3. Deploy to Vercel

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. At https://vercel.com → **Add New → Project**, import the repo. Vercel auto-detects Vite; the
   included [`vercel.json`](vercel.json) sets the build command (`npm run build`), output
   (`dist`), and SPA rewrites.
3. In **Project → Settings → Environment Variables**, add (for Production + Preview):

   | Key | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon public key |

4. **Deploy.** Because the env vars are present, the deployed app runs in Supabase mode: users
   enter a `@beesbridge.us` email and their history persists in the shared Postgres table.

### CLI alternative

```bash
npm i -g vercel
vercel            # first deploy / link project
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod     # production deploy
```

---

## How weighting works

After each exam, every answered question is recorded. On the next exam the question pool is sampled
with weights:

- never seen → **5×**
- last answer wrong → **8×**
- answered correctly once → 1×
- correct twice → 0.35×
- correct 3+ times in a row → 0.12× (mastered, rarely repeats)

Scenarios are still picked at random (4 of those with questions) and questions are drawn
round-robin across them, so you always get a spread while the misses resurface until mastered.
Tune the multipliers in `src/lib/history.js` (`weightForStats`).

## Data & auth model

- **Single shared, open database.** All users' attempts/answers live in the same `attempts` and
  `answers` tables, keyed by `user_email` (the profile id).
- **No real auth.** Entering a `@beesbridge.us` email is a front-end gate only; the app reads/writes
  with the public anon key. The one server-side guard is the `@beesbridge.us` CHECK constraint, so
  only that domain's emails can be stored.
- **Tradeoff:** anyone who obtains the anon key + project URL can read/write all rows, and the
  email gate can be bypassed by calling the API directly. This is intentional for a low-stakes
  internal tool — don't store anything sensitive here. (If you later want it locked down, re-enable
  Supabase Auth and switch the RLS policies to `to authenticated`.)
