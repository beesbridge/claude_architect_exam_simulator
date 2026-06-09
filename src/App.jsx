import { useState, useEffect, useMemo, useRef } from 'react'
import examData from './resources/questions.json'

const { examMeta, scenarios, questions } = examData

const SCALE = examMeta.scaledScore // { min, max, pass }
const DOMAINS = examMeta.domains
const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d]))
const SCENARIO_BY_ID = Object.fromEntries(scenarios.map((s) => [s.id, s]))

// ----- helpers -----------------------------------------------------------

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Scenarios that actually have at least one question
function scenariosWithQuestions() {
  const ids = new Set(questions.map((q) => q.scenarioId))
  return scenarios.filter((s) => ids.has(s.id))
}

// Total questions available across the scenarios that have any.
function totalAvailable() {
  return scenariosWithQuestions().reduce(
    (acc, s) => acc + questions.filter((q) => q.scenarioId === s.id).length,
    0
  )
}

// Build one exam form: pick up to N scenarios at random, then sample `limit`
// questions spread evenly across them (round-robin). limit == null => all.
function buildExam(scenarioCount, limit) {
  const eligible = scenariosWithQuestions()
  const picked = shuffle(eligible).slice(0, Math.min(scenarioCount, eligible.length))
  // Shuffled question pool per scenario.
  const pools = picked.map((s) => shuffle(questions.filter((q) => q.scenarioId === s.id)))
  const selected = pools.map(() => [])

  const totalInPicked = pools.reduce((acc, p) => acc + p.length, 0)
  const target = limit == null ? totalInPicked : Math.min(limit, totalInPicked)

  // Round-robin draw so every chosen scenario is represented.
  let count = 0
  let progress = true
  while (count < target && progress) {
    progress = false
    for (let i = 0; i < pools.length && count < target; i++) {
      if (selected[i].length < pools[i].length) {
        selected[i].push(pools[i][selected[i].length])
        count++
        progress = true
      }
    }
  }

  // Keep questions grouped by scenario block.
  const flat = []
  selected.forEach((arr) => arr.forEach((q) => flat.push(q)))
  return { scenarios: picked, questions: flat }
}

// Domain-weighted scaled score (approximation of the real exam's SME-set standard).
function scoreExam(examQuestions, answers) {
  const perDomain = {}
  examQuestions.forEach((q) => {
    const d = q.domainId
    if (!perDomain[d]) perDomain[d] = { correct: 0, total: 0 }
    perDomain[d].total += 1
    if (answers[q.id] === q.correct) perDomain[d].correct += 1
  })

  const presentDomains = Object.keys(perDomain)
  const weightSum = presentDomains.reduce((acc, d) => acc + DOMAIN_BY_ID[d].weight, 0)

  let weighted = 0
  const domainBreakdown = presentDomains.map((d) => {
    const frac = perDomain[d].correct / perDomain[d].total
    const normWeight = DOMAIN_BY_ID[d].weight / weightSum
    weighted += normWeight * frac
    return {
      id: d,
      name: DOMAIN_BY_ID[d].name,
      correct: perDomain[d].correct,
      total: perDomain[d].total,
      weight: DOMAIN_BY_ID[d].weight,
      pct: Math.round(frac * 100)
    }
  })

  const rawCorrect = examQuestions.filter((q) => answers[q.id] === q.correct).length
  const scaled = Math.round(SCALE.min + weighted * (SCALE.max - SCALE.min))

  return {
    scaled,
    passed: scaled >= SCALE.pass,
    rawCorrect,
    rawTotal: examQuestions.length,
    domainBreakdown: domainBreakdown.sort((a, b) => a.id.localeCompare(b.id))
  }
}

function fmtTime(secs) {
  const s = Math.max(0, secs)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

// ----- screens -----------------------------------------------------------

function StartScreen({ onStart }) {
  const eligible = scenariosWithQuestions()
  const maxQuestions = totalAvailable()
  const presets = [10, 20, 30, 50].filter((n) => n < maxQuestions)
  const [count, setCount] = useState(Math.min(20, maxQuestions)) // null === all
  const [minutes, setMinutes] = useState(90)
  const [timed, setTimed] = useState(true)

  const examSize = count == null ? maxQuestions : Math.min(count, maxQuestions)

  return (
    <div className="card start">
      <div className="badge">Practice Exam Simulator</div>
      <h1>{examMeta.title}</h1>
      <p className="muted">{examMeta.subtitle} · Guide v{examMeta.version}</p>

      <div className="info-grid">
        <div>
          <span className="info-num">{Math.min(examMeta.scenariosPerExam, eligible.length)}</span>
          <span className="info-label">Scenarios (random)</span>
        </div>
        <div>
          <span className="info-num">{examSize}</span>
          <span className="info-label">Questions</span>
        </div>
        <div>
          <span className="info-num">{SCALE.pass}</span>
          <span className="info-label">Pass score (of {SCALE.max})</span>
        </div>
      </div>

      <p className="format">{examMeta.format}</p>

      <div className="domains">
        <h3>Scored domains</h3>
        {DOMAINS.map((d) => (
          <div className="domain-row" key={d.id}>
            <span className="domain-name">{d.name}</span>
            <span className="domain-weight">{Math.round(d.weight * 100)}%</span>
          </div>
        ))}
      </div>

      <div className="count-config">
        <h3>Number of questions</h3>
        <div className="count-presets">
          {presets.map((n) => (
            <button
              key={n}
              className={`chip ${count === n ? 'active' : ''}`}
              onClick={() => setCount(n)}
            >
              {n}
            </button>
          ))}
          <button
            className={`chip ${count == null ? 'active' : ''}`}
            onClick={() => setCount(null)}
          >
            All ({maxQuestions})
          </button>
          <label className="custom-count">
            Custom:
            <input
              type="number"
              min="1"
              max={maxQuestions}
              value={count == null ? '' : count}
              placeholder="#"
              onChange={(e) => {
                const v = Number(e.target.value)
                setCount(e.target.value === '' ? null : Math.max(1, Math.min(maxQuestions, v)))
              }}
            />
          </label>
        </div>
      </div>

      <div className="timer-config">
        <label className="checkbox">
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
          Timed exam
        </label>
        {timed && (
          <label className="minutes">
            Minutes:
            <input
              type="number"
              min="1"
              max="240"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        )}
      </div>

      <button className="btn primary big" onClick={() => onStart({ timed, minutes, count })}>
        Start {examSize}-question exam
      </button>
      <p className="disclaimer">
        Unofficial study tool. The official questions are the sample questions from the exam guide;
        additional practice questions come from a community study guide and have heuristically
        inferred domains. Scaled scoring here is an approximation; the real exam is scored against a
        standard set by subject-matter experts.
      </p>
    </div>
  )
}

function ExamScreen({ exam, config, onSubmit }) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flagged, setFlagged] = useState({})
  const [remaining, setRemaining] = useState(config.timed ? config.minutes * 60 : null)
  const submitRef = useRef(onSubmit)
  submitRef.current = onSubmit

  const answersRef = useRef(answers)
  answersRef.current = answers

  useEffect(() => {
    if (!config.timed) return
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t)
          submitRef.current(answersRef.current, true)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [config.timed])

  const q = exam.questions[idx]
  const scenario = SCENARIO_BY_ID[q.scenarioId]
  const answeredCount = Object.keys(answers).length

  function choose(key) {
    setAnswers((a) => ({ ...a, [q.id]: key }))
  }
  function toggleFlag() {
    setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))
  }

  return (
    <div className="exam-layout">
      <main className="card exam-main">
        <div className="exam-header">
          <span className="qcount">
            Question {idx + 1} of {exam.questions.length}
          </span>
          {config.timed && (
            <span className={`timer ${remaining <= 60 ? 'warn' : ''}`}>⏱ {fmtTime(remaining)}</span>
          )}
        </div>

        <div className="scenario-box">
          <span className="scenario-tag">Scenario · {scenario.name}</span>
          <p>{scenario.description}</p>
        </div>

        <div className="domain-tag">
          {DOMAIN_BY_ID[q.domainId].name}
          {q.taskStatement ? ` · Task ${q.taskStatement}` : ''}
        </div>

        <p className="question-prompt">{q.prompt}</p>

        <div className="options">
          {q.options.map((opt) => {
            const selected = answers[q.id] === opt.key
            return (
              <button
                key={opt.key}
                className={`option ${selected ? 'selected' : ''}`}
                onClick={() => choose(opt.key)}
              >
                <span className="opt-key">{opt.key}</span>
                <span className="opt-text">{opt.text}</span>
              </button>
            )
          })}
        </div>

        <div className="exam-controls">
          <button className="btn" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
            ← Previous
          </button>
          <button className={`btn flag ${flagged[q.id] ? 'active' : ''}`} onClick={toggleFlag}>
            {flagged[q.id] ? '★ Flagged' : '☆ Flag for review'}
          </button>
          {idx < exam.questions.length - 1 ? (
            <button className="btn primary" onClick={() => setIdx((i) => i + 1)}>
              Next →
            </button>
          ) : (
            <button className="btn primary" onClick={() => onSubmit(answers, false)}>
              Finish & submit
            </button>
          )}
        </div>
      </main>

      <aside className="card nav-panel">
        <h3>Progress</h3>
        <p className="muted small">
          {answeredCount} / {exam.questions.length} answered
        </p>
        <div className="nav-grid">
          {exam.questions.map((eq, i) => {
            const isAnswered = answers[eq.id] != null
            const isFlagged = flagged[eq.id]
            return (
              <button
                key={eq.id}
                className={`nav-cell ${i === idx ? 'current' : ''} ${
                  isAnswered ? 'answered' : ''
                } ${isFlagged ? 'flagged' : ''}`}
                onClick={() => setIdx(i)}
                title={isFlagged ? 'Flagged' : ''}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <button
          className="btn primary full"
          onClick={() => onSubmit(answers, false)}
        >
          Submit exam
        </button>
        <p className="muted small">Unanswered questions are scored as incorrect.</p>
      </aside>
    </div>
  )
}

function ResultsScreen({ exam, answers, autoSubmitted, onRestart }) {
  const result = useMemo(() => scoreExam(exam.questions, answers), [exam, answers])

  return (
    <div className="results">
      <div className={`card score-card ${result.passed ? 'pass' : 'fail'}`}>
        {autoSubmitted && <div className="auto-note">⏱ Time expired — exam auto-submitted.</div>}
        <div className="score-num">{result.scaled}</div>
        <div className="score-scale">scaled score ({SCALE.min}–{SCALE.max})</div>
        <div className={`verdict ${result.passed ? 'pass' : 'fail'}`}>
          {result.passed ? 'PASS' : 'DID NOT PASS'}
        </div>
        <div className="muted">
          Passing score is {SCALE.pass}. You answered {result.rawCorrect} of {result.rawTotal}{' '}
          correctly.
        </div>
      </div>

      <div className="card">
        <h3>Performance by domain</h3>
        {result.domainBreakdown.map((d) => (
          <div className="domain-bar-row" key={d.id}>
            <div className="domain-bar-label">
              <span>{d.name}</span>
              <span className="muted">
                {d.correct}/{d.total} · weight {Math.round(d.weight * 100)}%
              </span>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${d.pct >= 70 ? 'good' : d.pct >= 40 ? 'mid' : 'low'}`}
                style={{ width: `${d.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Answer review</h3>
        {exam.questions.map((q, i) => {
          const picked = answers[q.id]
          const isCorrect = picked === q.correct
          return (
            <div className={`review-item ${isCorrect ? 'correct' : 'incorrect'}`} key={q.id}>
              <div className="review-head">
                <span className="review-q">Q{i + 1}</span>
                <span className={`review-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                  {isCorrect ? '✓ Correct' : picked ? '✗ Incorrect' : '— Unanswered'}
                </span>
                <span className="muted small">
                  {SCENARIO_BY_ID[q.scenarioId].name} · {DOMAIN_BY_ID[q.domainId].name}
                  {q.domainInferred ? ' (inferred)' : ''}
                </span>
              </div>
              <p className="review-prompt">{q.prompt}</p>
              <div className="review-options">
                {q.options.map((opt) => {
                  const mark =
                    opt.key === q.correct
                      ? 'is-correct'
                      : opt.key === picked
                      ? 'is-wrong'
                      : ''
                  return (
                    <div className={`review-opt ${mark}`} key={opt.key}>
                      <span className="opt-key">{opt.key}</span>
                      <span>{opt.text}</span>
                      {opt.key === q.correct && <span className="tag-correct">correct</span>}
                      {opt.key === picked && opt.key !== q.correct && (
                        <span className="tag-wrong">your answer</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="explanation">
                <strong>Explanation.</strong> {q.explanation}
                {q.source && <div className="source-note">Source: {q.source}</div>}
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn primary big" onClick={onRestart}>
        Take another exam
      </button>
    </div>
  )
}

// ----- root --------------------------------------------------------------

export default function App() {
  const [phase, setPhase] = useState('start') // start | exam | results
  const [exam, setExam] = useState(null)
  const [config, setConfig] = useState({ timed: true, minutes: 90, count: 20 })
  const [answers, setAnswers] = useState({})
  const [autoSubmitted, setAutoSubmitted] = useState(false)

  function start(cfg) {
    setConfig(cfg)
    setExam(buildExam(examMeta.scenariosPerExam, cfg.count))
    setAnswers({})
    setAutoSubmitted(false)
    setPhase('exam')
  }

  function submit(finalAnswers, auto) {
    setAnswers(finalAnswers)
    setAutoSubmitted(auto)
    setPhase('results')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function restart() {
    setPhase('start')
    setExam(null)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">ANTHROP\C</span>
        <span className="topbar-title">Architect · Foundations — Practice Exam</span>
      </header>
      <div className="container">
        {phase === 'start' && <StartScreen onStart={start} />}
        {phase === 'exam' && exam && (
          <ExamScreen exam={exam} config={config} onSubmit={submit} />
        )}
        {phase === 'results' && exam && (
          <ResultsScreen
            exam={exam}
            answers={answers}
            autoSubmitted={autoSubmitted}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  )
}
