// Local backend for `make server` — same functionality as the Supabase
// Postgres backend, but stored in a local SQLite file (gitignored).
//
// Run: node server/local-server.mjs   (port 8787, override with PORT)
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(join(DATA_DIR, 'exam.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    scaled_score INTEGER,
    passed INTEGER,
    raw_correct INTEGER,
    raw_total INTEGER,
    auto_submitted INTEGER,
    config TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    question_id TEXT NOT NULL,
    scenario_id TEXT,
    domain_id TEXT,
    chosen TEXT,
    correct_key TEXT,
    is_correct INTEGER,
    answered_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_email, answered_at);
  CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_email);
`)

const ALLOWED_DOMAIN = 'beesbridge.us'
const allowed = (e) => typeof e === 'string' && e.toLowerCase().endsWith('@' + ALLOWED_DOMAIN)

const PORT = process.env.PORT || 8787

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(JSON.stringify(body))
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
  })
}

const insertAttempt = db.prepare(`
  INSERT INTO attempts (user_email, scaled_score, passed, raw_correct, raw_total, auto_submitted, config)
  VALUES (@user_email, @scaled_score, @passed, @raw_correct, @raw_total, @auto_submitted, @config)
`)
const insertAnswer = db.prepare(`
  INSERT INTO answers (attempt_id, user_email, question_id, scenario_id, domain_id, chosen, correct_key, is_correct)
  VALUES (@attempt_id, @user_email, @question_id, @scenario_id, @domain_id, @chosen, @correct_key, @is_correct)
`)

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  try {
    if (req.method === 'POST' && path === '/api/login') {
      const { email } = await readJson(req)
      const clean = (email || '').trim().toLowerCase()
      if (!allowed(clean)) return send(res, 403, { error: `Only @${ALLOWED_DOMAIN} emails allowed.` })
      db.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)').run(clean)
      return send(res, 200, { user: { id: clean, email: clean } })
    }

    if (req.method === 'POST' && path === '/api/attempts') {
      const { email, attempt, answers } = await readJson(req)
      const clean = (email || '').trim().toLowerCase()
      if (!allowed(clean)) return send(res, 403, { error: 'Forbidden' })
      const tx = db.transaction(() => {
        const info = insertAttempt.run({
          user_email: clean,
          scaled_score: attempt.scaled_score,
          passed: attempt.passed ? 1 : 0,
          raw_correct: attempt.raw_correct,
          raw_total: attempt.raw_total,
          auto_submitted: attempt.auto_submitted ? 1 : 0,
          config: JSON.stringify(attempt.config ?? {})
        })
        const attemptId = info.lastInsertRowid
        for (const a of answers || []) {
          insertAnswer.run({
            attempt_id: attemptId,
            user_email: clean,
            question_id: a.question_id,
            scenario_id: a.scenario_id ?? null,
            domain_id: a.domain_id ?? null,
            chosen: a.chosen ?? null,
            correct_key: a.correct_key ?? null,
            is_correct: a.is_correct ? 1 : 0
          })
        }
        return attemptId
      })
      const attemptId = tx()
      return send(res, 200, { attemptId })
    }

    if (req.method === 'GET' && path === '/api/history') {
      const clean = (url.searchParams.get('email') || '').trim().toLowerCase()
      if (!allowed(clean)) return send(res, 403, { error: 'Forbidden' })
      const rows = db
        .prepare(
          'SELECT question_id, is_correct, answered_at FROM answers WHERE user_email = ? ORDER BY answered_at ASC, id ASC'
        )
        .all(clean)
        .map((r) => ({ ...r, is_correct: !!r.is_correct }))
      return send(res, 200, { answers: rows })
    }

    if (req.method === 'GET' && path === '/api/attempts/count') {
      const clean = (url.searchParams.get('email') || '').trim().toLowerCase()
      if (!allowed(clean)) return send(res, 403, { error: 'Forbidden' })
      const { c } = db.prepare('SELECT COUNT(*) AS c FROM attempts WHERE user_email = ?').get(clean)
      return send(res, 200, { count: c })
    }

    return send(res, 404, { error: 'Not found' })
  } catch (e) {
    return send(res, 500, { error: e.message })
  }
})

server.listen(PORT, () => {
  console.log(`Local exam API + SQLite running on http://localhost:${PORT}`)
  console.log(`DB file: ${join(DATA_DIR, 'exam.db')} (gitignored)`)
})
