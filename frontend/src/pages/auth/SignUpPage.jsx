import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { friendlyAuthError } from './SignInPage.jsx'

export default function SignUpPage() {
  const { signUp, signInWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signUp(email, password, name.trim())
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const google = async () => {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(friendlyAuthError(err))
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1 className="page-title">🏠 Home Hub</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: -10, marginBottom: 18 }}>Create your account, then create or join a family.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="signup-name">Your name</label>
            <input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Vivek" />
          </div>
          <div className="field">
            <label htmlFor="signup-email">Email</label>
            <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="signup-password">Password</label>
            <input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button type="button" className="btn" style={{ width: '100%' }} onClick={google}>
          Continue with Google
        </button>

        <p style={{ marginTop: 18, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
