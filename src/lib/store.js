// Backend abstraction. Two modes, same interface:
//   - 'supabase'  : Postgres + email-OTP auth (used on Vercel / production)
//   - 'local'     : local Node API backed by SQLite (used by `make server`)
//   - 'none'      : no backend; app runs as a plain local-only practice tool
//
// Mode is chosen from env at build time:
//   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY  -> 'supabase'
//   else VITE_LOCAL_API (defaults to localhost:8787 in dev) -> 'local'
//   else -> 'none'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const LOCAL_API =
  import.meta.env.VITE_LOCAL_API || (import.meta.env.DEV ? 'http://localhost:8787' : '')

export const ALLOWED_DOMAIN = 'beesbridge.us'
export const MODE = SUPABASE_URL && SUPABASE_ANON ? 'supabase' : LOCAL_API ? 'local' : 'none'
export const configured = MODE !== 'none'
// No real auth: sign-in is a single-step front-end domain gate (no email code).
export const needsCode = false

export function emailAllowed(email) {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith('@' + ALLOWED_DOMAIN)
}

// Supabase client uses the anon key only — no Supabase Auth. The shared tables
// are open to the anon role (see supabase/schema.sql).
const supabase = MODE === 'supabase' ? createClient(SUPABASE_URL, SUPABASE_ANON) : null

const LOCAL_KEY = 'exam_local_session'

async function api(path, opts = {}) {
  const res = await fetch(LOCAL_API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body
}

// ---- session (front-end gate only, no real auth) ------------------------
// "Signing in" just records the chosen @beesbridge.us email locally and uses
// it as the profile id. There is no password and no email code.

export async function getSession() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function onAuthChange() {
  // No external auth provider to subscribe to.
  return () => {}
}

// Single-step sign-in: validate the domain, store the email as the session.
export async function signInStart(email) {
  const clean = email.trim().toLowerCase()
  if (!emailAllowed(clean)) {
    return { error: `Only @${ALLOWED_DOMAIN} email addresses can sign in.` }
  }
  const user = { id: clean, email: clean }
  // In local mode, register the user row (server also re-checks the domain).
  if (MODE === 'local') {
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ email: clean }) })
    } catch (e) {
      return { error: e.message }
    }
  }
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(user))
  } catch {
    /* ignore storage errors */
  }
  return { error: null, email: clean, user }
}

// Kept for interface compatibility; there is no code to verify.
export async function signInVerify() {
  return { error: null }
}

export async function signOut() {
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* ignore */
  }
}

// ---- persistence --------------------------------------------------------

export async function saveAttempt({ user, exam, answers, result, config, autoSubmitted }) {
  if (MODE === 'none' || !user) return { skipped: true }

  const answerRows = exam.questions.map((q) => ({
    question_id: q.id,
    scenario_id: q.scenarioId,
    domain_id: q.domainId,
    chosen: answers[q.id] ?? null,
    correct_key: q.correct,
    is_correct: answers[q.id] === q.correct
  }))

  if (MODE === 'supabase') {
    const { data: attempt, error: aErr } = await supabase
      .from('attempts')
      .insert({
        user_email: user.email,
        scaled_score: result.scaled,
        passed: result.passed,
        raw_correct: result.rawCorrect,
        raw_total: result.rawTotal,
        auto_submitted: autoSubmitted,
        config
      })
      .select('id')
      .single()
    if (aErr) return { error: aErr.message }
    const rows = answerRows.map((r) => ({
      attempt_id: attempt.id,
      user_email: user.email,
      ...r
    }))
    const { error: ansErr } = await supabase.from('answers').insert(rows)
    return { error: ansErr ? ansErr.message : null }
  }

  // local
  try {
    await api('/api/attempts', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        attempt: {
          scaled_score: result.scaled,
          passed: result.passed,
          raw_correct: result.rawCorrect,
          raw_total: result.rawTotal,
          auto_submitted: autoSubmitted,
          config
        },
        answers: answerRows
      })
    })
    return { error: null }
  } catch (e) {
    return { error: e.message }
  }
}

export async function loadAnswerHistory(user) {
  if (MODE === 'none' || !user) return []
  if (MODE === 'supabase') {
    const { data, error } = await supabase
      .from('answers')
      .select('question_id, is_correct, answered_at')
      .eq('user_email', user.email)
      .order('answered_at', { ascending: true })
    if (error) {
      console.warn('loadAnswerHistory:', error.message)
      return []
    }
    return data ?? []
  }
  try {
    const { answers } = await api(`/api/history?email=${encodeURIComponent(user.email)}`)
    return answers ?? []
  } catch (e) {
    console.warn('loadAnswerHistory:', e.message)
    return []
  }
}

export async function loadAttemptCount(user) {
  if (MODE === 'none' || !user) return 0
  if (MODE === 'supabase') {
    const { count, error } = await supabase
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', user.email)
    return error ? 0 : count ?? 0
  }
  try {
    const { count } = await api(`/api/attempts/count?email=${encodeURIComponent(user.email)}`)
    return count ?? 0
  } catch {
    return 0
  }
}
