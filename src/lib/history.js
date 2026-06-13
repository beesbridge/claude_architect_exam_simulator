// Persistence is delegated to the backend store (supabase or local SQLite).
// The stats + weighting functions below are pure and backend-agnostic.
export { saveAttempt, loadAnswerHistory, loadAttemptCount } from './store'

// Build a per-question summary from ordered answer rows.
// Returns: { [questionId]: { seen, lastCorrect, correctStreak } }
export function buildStats(answerRows) {
  const stats = {}
  for (const row of answerRows) {
    const s = stats[row.question_id] || { seen: 0, lastCorrect: null, correctStreak: 0 }
    s.seen += 1
    s.lastCorrect = row.is_correct
    s.correctStreak = row.is_correct ? s.correctStreak + 1 : 0
    stats[row.question_id] = s
  }
  return stats
}

// Strong spaced-repetition emphasis:
//   - never seen ............. 5x   (prioritize coverage of new material)
//   - last answer wrong ...... 8x   (drill the misses hard)
//   - correct once ........... 1x
//   - correct twice .......... 0.35x
//   - correct 3+ times ....... 0.12x (mastered — rarely repeat)
export function weightForStats(s) {
  if (!s || s.seen === 0) return 5
  if (s.lastCorrect === false) return 8
  if (s.correctStreak >= 3) return 0.12
  if (s.correctStreak === 2) return 0.35
  return 1
}

export function makeWeightFn(stats) {
  return (questionId) => weightForStats(stats[questionId])
}

// Per-domain performance based on the latest answer to each seen question.
// Returns { [domainId]: { seen, total, correct, pct } }
export function domainPerformance(stats, allQuestions) {
  const perf = {}
  for (const q of allQuestions) {
    const p = perf[q.domainId] || { seen: 0, total: 0, correct: 0, pct: 0 }
    p.total += 1
    const s = stats[q.id]
    if (s && s.seen > 0) {
      p.seen += 1
      if (s.lastCorrect) p.correct += 1
    }
    perf[q.domainId] = p
  }
  for (const d of Object.keys(perf)) {
    const p = perf[d]
    p.pct = p.seen > 0 ? Math.round((p.correct / p.seen) * 100) : 0
  }
  return perf
}

// Counts for the start-screen progress summary.
export function summarize(stats, allQuestions) {
  let toReview = 0
  let mastered = 0
  for (const q of allQuestions) {
    const s = stats[q.id]
    if (!s || s.seen === 0) continue
    if (s.lastCorrect === false) toReview += 1
    else if (s.correctStreak >= 3) mastered += 1
  }
  const seen = Object.values(stats).filter((s) => s.seen > 0).length
  return { toReview, mastered, seen, total: allQuestions.length }
}
