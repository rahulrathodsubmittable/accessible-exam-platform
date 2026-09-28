# AI Accessible Exam Platform
**SISTec Innovation Hackathon 2026 — Problem Statement DT-13**

> *“No Visual Barrier. No Learning Barrier. No Examination Barrier.”*

An exam and practice platform built for visually impaired candidates, designed for accessibility from the start. React + Vite frontend, Vercel serverless API, Supabase (Postgres + Auth).

---

## Key Features

1. **No student login.** Candidates enter a unique Candidate ID (`EXM-2026-XXXXX`) and nothing else.
2. **Exam Mode.** A fixed-duration assessment:
   - one attempt per candidate
   - a timer enforced by the server
   - answers auto-saved as the candidate goes
   - scoring done on the server, so correct answers never reach the browser
   - optional AI explanations that clarify the question without revealing the answer, capped per question in Postgres
3. **Practice Mode.** Unlimited tries, AI concept explanations, and topic recommendations at the end.
4. **Voice and keyboard control.** Web Speech API for text-to-speech and voice commands, single-key shortcuts, ARIA live regions, a skip link and focus management.
5. **Accessibility control center** (Alt + A): text size, high contrast, reduced motion, speech speed and pitch, and voice on/off.
6. **Teacher portal** (Supabase Auth):
   - create exams and questions
   - generate Candidate IDs
   - publish or unpublish exams, and reset attempts
   - AI Paper Improvement audit
   - Vision & OCR (turn a photo of a page into text plus a screen-reader description)
   - Barrier Replay (aggregated, no personal data)
7. **Offline tolerant.** Answers are written to IndexedDB first and re-synced when the connection returns. A service worker caches the app shell.

AI features use OpenAI (`gpt-4o-mini` by default) and are optional. Without `OPENAI_API_KEY`:
- Practice Mode uses the built-in explanations.
- Results use a rule-based summary.
- AI-only teacher tools report that AI isn't configured.

---

## Architecture

```
Browser (React SPA)
 ├── Candidate flows ──► /api/* (Vercel Functions, service-role key) ──► Supabase Postgres
 └── Teacher portal ──► Supabase directly (anon key + Auth, protected by RLS)
                        └► /api/ai-paper-improve, /api/process-ocr (verified teacher token)
```

| Path | What's there |
| --- | --- |
| `src/` | React app (pages, components, contexts, hooks, services) |
| `api/` | Vercel serverless functions; `api/_lib/` holds shared helpers (not deployed as routes) |
| `shared/` | Types, scoring, Candidate ID helpers and the practice question bank, used by both `src/` and `api/` |
| `supabase/migrations/` | Database schema, RLS policies and the atomic `consume_explanation` function |
| `supabase/seed.sql` | Demo exam, 5 questions and 3 candidates |
| `tests/unit/` | Vitest unit tests |

### Security model
- **The anon key can read nothing.** Every table has row-level security, and the only policies are for signed-in teachers.
- **Candidates never touch the database directly.** The `/api` functions check the Candidate ID, time window and attempt state on every request.
- **Teachers must be on an allow-list.** A teacher needs both a Supabase Auth account and a row in `public.teachers`. Signing up alone grants nothing.
- **`SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` stay on the server.** Only `VITE_*` variables are bundled into the browser.

---

## Deploy

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run, in order:
   1. `supabase/migrations/20260928000000_initial_schema.sql`
   2. `supabase/seed.sql` (optional demo data)

   If you use the Supabase CLI instead: `supabase link` then `supabase db push`.
3. **Create a teacher account.**
   1. Go to **Authentication → Users → Add user**, and enter an email and password.
   2. In the SQL Editor, run:
      ```sql
      insert into public.teachers (user_id, full_name)
      select id, 'Your Name' from auth.users where email = 'you@example.com';
      ```
4. **Recommended:** turn off open sign-ups under **Authentication → Sign In / Providers**.
5. **Copy your keys** from **Project Settings → API**: the Project URL, the anon (or publishable) key, and the service_role key.

### 2. Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repository. The Vite preset and build settings are picked up from `vercel.json` automatically.
2. Add these Environment Variables (for Production and Preview):

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
   | `SUPABASE_URL` | Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (**secret**) |
   | `OPENAI_API_KEY` | *(optional)* enables AI features |

   If you use the **Vercel ↔ Supabase integration** instead, it sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The app reads those too.
3. Click **Deploy**. If you change a `VITE_*` variable later, redeploy, because those values are baked in at build time.

### 3. Try it
- **Exam Mode:** use `EXM-2026-A7K92`, `EXM-2026-B4P81` or `EXM-2026-K9X32`. Each ID can sit the exam once; you can reset it from Teacher portal → Candidate IDs.
- **Teacher portal:** sign in with the teacher account from step 1.3.

---

## Local development

```bash
cp .env.example .env      # fill in your Supabase (and optionally OpenAI) values
npm install
npm run dev               # http://localhost:3000, /api routes included
```

`npm run dev` serves both the frontend and the `/api` functions, so you don't need the Vercel CLI.

| Command | Purpose |
| --- | --- |
| `npm run build` | Type-check the app and API, then build to `dist/` |
| `npm run typecheck` | Type-check the app, API and config files |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (scoring, Candidate IDs) |

---

## Accessibility controls

**Exam keyboard shortcuts**

| Key | Action |
| --- | --- |
| `1`–`6` | Select option A–F |
| `N` / `P` | Next / previous question |
| `R` / `O` | Repeat question / read options |
| `S` / `M` | Skip / mark for review |
| `T` / `E` / `H` | Time left / explanation / list shortcuts |
| `Alt + A` | Accessibility settings |

**Voice commands** (Chrome and Edge, microphone permission required): "read question", "read options", "select option B", "next question", "previous question", "skip question", "mark for review", "go to question 3", "how much time is left", "explain question", "submit exam", "confirm submission", "cancel".
