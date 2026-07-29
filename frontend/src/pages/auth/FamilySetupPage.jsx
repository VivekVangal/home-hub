import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useFamily } from '../../context/FamilyContext.jsx'

export default function FamilySetupPage() {
  const { user, signOut } = useAuth()
  const { createFamily, joinFamily } = useFamily()
  const [mode, setMode] = useState('create') // 'create' | 'join'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setSubmitting(true)
    try {
      await createFamily(name)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitJoin = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setError('')
    setSubmitting(true)
    try {
      await joinFamily(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1 className="page-title">Welcome{user?.displayName ? `, ${user.displayName}` : ''}</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: -10, marginBottom: 18 }}>
          Create a new household, or join one someone already started.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <div className="owner-toggle" style={{ marginBottom: 18 }}>
          <button type="button" className={mode === 'create' ? 'selected' : ''} style={mode === 'create' ? { background: '#3b6e5e' } : {}} onClick={() => setMode('create')}>
            Create a family
          </button>
          <button type="button" className={mode === 'join' ? 'selected' : ''} style={mode === 'join' ? { background: '#3b6e5e' } : {}} onClick={() => setMode('join')}>
            Join a family
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={submitCreate}>
            <div className="field">
              <label htmlFor="family-name">Family name</label>
              <input id="family-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Vangals" required autoFocus />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create family'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitJoin}>
            <div className="field">
              <label htmlFor="invite-code">Invite code</label>
              <input
                id="invite-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7HQK4M"
                required
                autoFocus
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Joining…' : 'Join family'}
            </button>
          </form>
        )}

        <button type="button" className="btn" style={{ width: '100%', marginTop: 18 }} onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
