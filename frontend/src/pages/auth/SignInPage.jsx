import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function SignInPage() {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
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
        <p style={{ color: 'var(--text-muted)', marginTop: -10, marginBottom: 18 }}>Sign in to your family's Home Hub.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="signin-email">Email</label>
            <input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="signin-password">Password</label>
            <input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button type="button" className="btn" style={{ width: '100%' }} onClick={google}>
          Continue with Google
        </button>

        <p style={{ marginTop: 18, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  )
}

export function friendlyAuthError(err) {
  const code = err?.code || ''
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Incorrect email or password.'
  }
  if (code.includes('email-already-in-use')) return 'An account with that email already exists.'
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.'
  if (code.includes('invalid-email')) return 'That email address doesn\'t look right.'
  if (code.includes('popup-closed-by-user')) return 'Google sign-in was closed before finishing.'
  return err?.message || 'Something went wrong. Try again.'
}
