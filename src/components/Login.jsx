import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { sendCode, verifyCode, needsCode, allowedDomain, mode } = useAuth()
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('email') // email | code
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const email = `${username}@${allowedDomain}`

  // Keep only the local part: strip spaces and anything from an '@' onward.
  function onUsernameChange(e) {
    const v = e.target.value.split('@')[0].replace(/\s/g, '')
    setUsername(v)
  }

  async function handleEmail(e) {
    e.preventDefault()
    setError(null)
    if (!username) return setError('Enter your username.')
    setBusy(true)
    const res = await sendCode(email)
    setBusy(false)
    if (res.error) return setError(res.error)
    if (needsCode) setStage('code') // supabase: wait for emailed code
    // local mode: sendCode already established the session
  }

  async function handleCode(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await verifyCode(email, code)
    setBusy(false)
    if (res.error) return setError(res.error)
  }

  return (
    <div className="card login">
      <div className="badge">Sign in</div>
      <h1>Claude Architect · Practice Exam</h1>
      <p className="muted">
        Enter your <strong>@{allowedDomain}</strong> username to continue. Your email is your profile
        — results and progress are saved under it. No password required.
      </p>

      {stage === 'email' && (
        <form onSubmit={handleEmail} className="login-form">
          <label>
            Work email
            <div className="email-field">
              <input
                type="text"
                autoFocus
                placeholder="you"
                value={username}
                onChange={onUsernameChange}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
              />
              <span className="email-suffix" aria-hidden="true">
                @{allowedDomain}
              </span>
            </div>
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="btn primary big" disabled={busy}>
            {busy ? 'Please wait…' : needsCode ? 'Email me a login code' : 'Continue'}
          </button>
          {needsCode && (
            <p className="muted small">We'll send a 6-digit code to confirm it's you.</p>
          )}
        </form>
      )}

      {stage === 'code' && (
        <form onSubmit={handleCode} className="login-form">
          <p className="muted small">
            Enter the 6-digit code sent to <strong>{email}</strong>.
          </p>
          <label>
            Login code
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="btn primary big" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify & sign in'}
          </button>
          <button
            type="button"
            className="btn link"
            onClick={() => {
              setStage('email')
              setCode('')
              setError(null)
            }}
          >
            ← Use a different email
          </button>
        </form>
      )}

      <p className="disclaimer">
        {mode === 'local'
          ? 'Local mode: results are stored in a local SQLite database on your machine.'
          : mode === 'supabase'
          ? 'Results are saved to a shared database, keyed by your email.'
          : 'Local-only session — results are not saved (no backend configured).'}
      </p>
    </div>
  )
}
