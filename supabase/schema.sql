-- Claude Architect Practice Exam — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Design: ONE shared, OPEN database for all users. There is NO Supabase Auth.
-- The app talks to these tables with the public anon key. Rows are keyed by the
-- user's email (the profile id). The @beesbridge.us "login" is only a front-end
-- gate; the single real server-side guard here is a CHECK constraint that
-- requires user_email to be a @beesbridge.us address.
--
-- NOTE: because the tables are open to the anon key, anyone who obtains the
-- anon key + project URL can read/write all rows. This is intentional for a
-- low-stakes internal tool. Do not store sensitive data here.

-- ---------------------------------------------------------------------------
-- Tables (keyed by user_email; domain enforced by CHECK)
-- ---------------------------------------------------------------------------
create table if not exists public.attempts (
  id             uuid primary key default gen_random_uuid(),
  user_email     text not null check (lower(user_email) like '%@beesbridge.us'),
  scaled_score   int,
  passed         boolean,
  raw_correct    int,
  raw_total      int,
  auto_submitted boolean default false,
  config         jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.answers (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.attempts (id) on delete cascade,
  user_email   text not null check (lower(user_email) like '%@beesbridge.us'),
  question_id  text not null,
  scenario_id  text,
  domain_id    text,
  chosen       text,
  correct_key  text,
  is_correct   boolean,
  answered_at  timestamptz not null default now()
);

create index if not exists idx_answers_user  on public.answers  (user_email, answered_at);
create index if not exists idx_attempts_user on public.attempts (user_email);

-- ---------------------------------------------------------------------------
-- Row-level security: open the shared tables to the anon role (no auth).
-- ---------------------------------------------------------------------------
alter table public.attempts enable row level security;
alter table public.answers  enable row level security;

drop policy if exists "open attempts" on public.attempts;
create policy "open attempts" on public.attempts
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "open answers" on public.answers;
create policy "open answers" on public.answers
  for all to anon, authenticated using (true) with check (true);

-- (No auth.users trigger — Supabase Auth is not used in this configuration.)
