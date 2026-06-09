# Claude Certified Architect – Foundations · Practice Exam Simulator

A standalone web app that simulates the **Claude Certified Architect – Foundations** certification
exam. It mirrors the real exam format described in the official exam guide: scenario-based
multiple-choice questions, random scenario selection, a timer, and domain-weighted scaled scoring.

## Run it

```bash
make server     # front-end + local SQLite backend on http://localhost:5173
```

On first run it installs dependencies (including a one-time native build of `better-sqlite3`),
then starts both the Vite app and a local API. Sign in with any `@beesbridge.us` email — in local
mode no code is required. Your results are saved to a local SQLite file (`server/data/exam.db`,
gitignored).

Other targets:

```bash
make web        # front-end only, no backend (local-only, nothing saved)
make install    # install node dependencies
make reset      # clean reinstall (fixes the npm rollup optional-dependency bug)
make build      # production build into ./dist (for Vercel)
make preview    # serve the production build
make clean      # remove node_modules, lockfile, and dist
make clean-db   # delete the local SQLite database
```

Requires Node.js 18+ and npm.

## Accounts, saved history & hosting

The same app runs **locally on SQLite** (`make server`) or **hosted on Vercel + Supabase**
(Postgres). In both modes, sign-in is restricted to **@beesbridge.us** emails, the email is the
profile id, results are saved per user, and future exams **weight failed/unseen questions much more
heavily** (spaced repetition). The mode is chosen automatically from environment variables.

See **[DEPLOY.md](DEPLOY.md)** for full Supabase setup and Vercel deployment steps.

## How the simulation works

- **Scenario selection** — The guide says 4 of 6 scenarios are presented at random. This app picks
  up to 4 at random from the scenarios that have questions in the bank, and keeps each scenario's
  questions grouped together.
- **Format** — Single-answer multiple choice. Unanswered questions are scored as incorrect.
- **Scoring** — Reported as a scaled score from 100–1000 with a pass threshold of 720, computed as
  a **domain-weighted** result using the guide's domain weightings (renormalized across the domains
  present in your exam form). The real exam is scored against a standard set by subject-matter
  experts; the scaling here is an approximation for study purposes.
- **Review** — After submitting, every question shows the correct answer, your answer, and the
  explanation, plus a per-domain performance breakdown.

## Question bank

All questions live in [`src/resources/questions.json`](src/resources/questions.json). The bank
contains **88 questions**:

- **12 official sample questions** from the exam guide, each tagged with its scenario, scored
  domain, and task statement.
- **76 community practice questions** (from the paullarionov study guide) across five scenarios,
  including a seventh scenario, *Conversational AI Architecture Patterns*. These carry a `source`
  field, and their `domainId` is heuristically inferred from question content (flagged with
  `domainInferred: true` and shown as "(inferred)" in the review screen).

To extend the exam, add more objects to the `questions` array following the same shape — the app
picks them up automatically, including for scenarios that currently have no questions (Developer
Productivity, Structured Data Extraction).

## Domains and weightings

| Domain | Weight |
| --- | --- |
| Agentic Architecture & Orchestration | 27% |
| Tool Design & MCP Integration | 18% |
| Claude Code Configuration & Workflows | 20% |
| Prompt Engineering & Structured Output | 20% |
| Context Management & Reliability | 15% |
