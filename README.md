# Next Play Eval Coach

A web app that grades **L1 Eval Specialist sales-call transcripts** using Claude and outputs structured coaching feedback. It grades the **sales/setting motion** (discovery → pitch → $197 eval close), **not** the athlete interview.

Built as an independent clone of the Athlete Interview Command Center — same architecture, different rubric. This repo is **only** the Eval Coach.

**Live:** https://nextplay-eval-coach.vercel.app

---

## What it does

A transcript from a sales call gets pasted in, and the tool returns a copy/paste-ready coaching report: a handoff block for the athlete interview team, an auto-filled post-call form, a verdict, the biggest miss, replay moments with sharper versions, a script-execution check, a six-dimension scorecard, and one thing to lock in.

Grading is **execution-based, not outcome-based** — a clean call that didn't close is not marked down, and a sloppy call that happened to close is not an A.

### Two call types

The tool grades each call against its **own** standard:

- **Game Plan** — colder workshop lead, discovery-heavy. The job is to dig into pain, surface the outreach/posting gaps, get the parent to name and own their biggest challenge, then prescribe the starter kit + $197 eval close (+ $199 highlight upsell, post-close only).
- **Auto Book (15-min)** — warm lead who watched a pre-call video. Short by design. Qualify fast → cost question → commitment check → eval pitch → close. **Not** graded down for limited discovery depth.

A third motion (setter/booking calls) exists but is **not yet graded** — don't run those as Game Plan.

---

## Architecture

| Piece | What it is |
|---|---|
| **Hosting** | Vercel — auto-deploys from `main` ~30–60s after each commit |
| **Database** | Supabase — stores submissions, the live system prompt, the coaching reference doc, and reps |
| **Model** | `claude-sonnet-4-5`, `max_tokens: 4500` |

### Key files

- `app/page.tsx` — main UI; holds the grade-computation function, title/interview-date extraction, the transcript panel, and the Coaching Reference Library tab.
- `app/api/analyze/route.ts` — Claude streaming endpoint. Reads `system_prompt` + `coaching_reference` from Supabase, appends them, prepends the call type to the transcript.
- `lib/supabase.ts` / `lib/supabase-server.ts` — clients.
- `lib/system-prompt.ts` — default prompt (fallback only; the **live** prompt is in Supabase settings).

---

## The most important mental model: prompt vs. code

- **Prompt changes** (rubric rules, grading philosophy, output wording) → Admin Dashboard → **Edit Instructions** → paste → Save. **Live immediately, no deploy.** Stored in Supabase `settings` under key `system_prompt`.
- **Code changes** (dropdowns, fields, the grade math, title/date logic, token limit, model) → edit the file → commit to `main` → Vercel redeploys.

> Rule of thumb: anything about *what the model writes* is a prompt change. Anything about *how the app behaves around the model* is a code change.

The overall grade is **computed in code**, not by the model — `page.tsx` reads the six dimension letters from the scorecard, converts to points, averages, and sets the badge. The report text prints no overall letter grade, so it can never contradict the computed badge.

---

## Admin dashboard

Access via the **Admin Dashboard** tab (password is set in the `NEXT_PUBLIC_ADMIN_PASSWORD` env var).

Tabs: **Submit Transcript**, **View Submissions**, **Manage Reps**, **Edit Instructions**, **Coaching Reference Library**.

- **Manage Reps** — rep codes validated against the `reps` table (format `keegan-001`). If you get "code may already exist" with an empty list, the `reps` table is missing or mis-columned.
- **Coaching Reference Library** — appended to the system prompt at analysis time (Supabase key `coaching_reference`; `page.tsx` and `route.ts` must stay in sync). Two sections: OBJECTION HANDLES and MUST-PULL DISCOVERY THREADS.

---

## Environment variables (set in Vercel)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Legacy** anon key (`eyJ...` JWT format — the app's Supabase library version requires the legacy key, **not** the new `sb_publishable_...` format) |
| `ANTHROPIC_API_KEY` | Claude API key |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | Admin dashboard password |

---

## Database schema

Run in the Supabase SQL Editor on a fresh project.

```sql
-- Submissions
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_name TEXT NOT NULL,
  athlete_name TEXT NOT NULL,
  grade TEXT,
  output TEXT NOT NULL,
  transcript TEXT NOT NULL,
  interview_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  flagged BOOLEAN DEFAULT FALSE,
  rep_id UUID,
  transcript_header TEXT
);

-- Settings (system prompt, coaching reference doc, etc.)
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reps (required for Manage Reps — needs rep_name, rep_code, AND active)
CREATE TABLE reps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_name TEXT NOT NULL,
  rep_code TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX idx_submissions_rep_name ON submissions(rep_name);
CREATE INDEX idx_submissions_flagged ON submissions(flagged);
CREATE INDEX idx_settings_key ON settings(key);

-- Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on submissions" ON submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reps" ON reps FOR ALL USING (true) WITH CHECK (true);
```

**Schema gotchas:**
- `submissions` needs `rep_id` and `transcript_header` or grading a call errors.
- The `reps` table must include `rep_name`, `rep_code`, **and** `active`.

---

## Build sequence (fresh clone)

1. **Supabase** — new project → SQL Editor → run the schema above → grab the Project URL and legacy anon key.
2. **GitHub** — New repository → *Import a repository* → source URL → name it → leave credentials blank → Begin import.
3. **Vercel** — Add New → Project → import the repo → add the four env vars → Deploy.
4. **Prompt** — Admin Dashboard → Edit Instructions → paste the L1 rubric → Save.
5. **Reps** — Admin → Manage Reps → add a rep (`keegan-001`).
6. **Coaching Reference Library** — paste the seeded must-pull threads → Save.
7. **Test** — run a real transcript; confirm correct call type, useful handoff, the grade tracks the scorecard. Then run an Auto Book and a non-close before trusting it broadly.

---

## Workflow notes & gotchas

- **Pushing code:** GitHub web editor (open file → Raw to copy current contents → edit → paste → Commit to `main`). Vercel redeploys in ~1 min. When handing off updated code, replace the **whole file** rather than doing surgical find-and-replace — repeated patterns make "find this text" ambiguous.
- **Transcripts** come from the WAVV dialer. The first line is the parent's name + appointment status, so title extraction pulls from the grader's output (Parent First/Last Name) with a header fallback.
- **WAVV format is inconsistent** — some exports have inline `(MM:SS)` timestamps, others are a no-timestamp Summary/Highlights/Action-Items block. The standard paste is the no-timestamp summary; the rubric grades either, but watch that it grades the **call**, not the summary.
- **Duplicate prevention** keys off the transcript header — to re-run the same transcript, delete the old submission first.
- **Keep scripts in sync** — if the prompt's script beats change, the real scripts changed too.
- **Stop-tuning principle** — the prompt has hit the ceiling of stacked "never" rules; the grade is locked in code, and remaining slips are caught in a ~30-second human review pass. Prefer populating the Library over adding more negative rules.

---

## Open items

- **Auto Book branch is untested** — every run so far has been Game Plan. #1 real gap.
- **Non-close grading untested** — needs a declined-politely transcript run through to confirm execution-not-outcome grading holds.
- **OBJECTION HANDLES** in the Coaching Reference Library still need real examples from calls (not AI-guessed).
- **MP3 click-to-play** feature scoped but blocked on whether WAVV reliably exports a timestamped transcript + the call MP3.
