# Claude Certified Architect – Foundations · Practice Exam Simulator

A standalone web app that simulates the **Claude Certified Architect – Foundations** certification
exam. It mirrors the real exam format described in the official exam guide: scenario-based
multiple-choice questions, random scenario selection, a timer, and domain-weighted scaled scoring.

## Run it

```bash
make server     # installs dependencies on first run, then starts the dev server
```

Then open the URL Vite prints (defaults to http://localhost:5173 — it also opens automatically).

Other targets:

```bash
make install    # install node dependencies
make reset      # clean reinstall (fixes the npm rollup optional-dependency bug)
make build      # production build into ./dist
make preview    # serve the production build
make clean      # remove node_modules, lockfile, and dist
```

Requires Node.js 18+ and npm.

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
