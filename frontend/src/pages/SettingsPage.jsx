import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { usePeople } from '../hooks/usePeople.js'
import { useLiveData } from '../hooks/useLiveData.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useFamily } from '../context/FamilyContext.jsx'
import { updatePerson, deletePerson, getGoogleSyncState } from '../db.js'
import { functions } from '../firebase.js'
import { buildGoogleAuthorizeUrl } from '../lib/google.js'
import { COLOR_PALETTE } from '../consts.js'

function PersonRow({ person, isSelf }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(person.name)
  const [color, setColor] = useState(person.color)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    await updatePerson(person.id, { name: name.trim(), color })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="list-item">
        <div className="list-item-main">
          <div className="field" style={{ marginBottom: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="swatch-row">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={'swatch' + (color === c ? ' selected' : '')}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    )
  }

  return (
    <div className="list-item">
      <span className="swatch" style={{ background: person.color }} />
      <div className="list-item-main">
        <div className="list-item-title">{person.name}{isSelf ? ' (you)' : ''}</div>
        {person.role === 'owner' && <div className="list-item-sub">Family owner</div>}
      </div>
      <button className="btn" onClick={() => setEditing(true)}>Edit</button>
      {!isSelf && (
        confirmDelete ? (
          <>
            <button className="btn btn-danger" onClick={() => deletePerson(person.id)}>Confirm</button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn btn-icon" onClick={() => setConfirmDelete(true)}>✕</button>
        )
      )}
    </div>
  )
}

function inviteMessage(familyName, inviteCode) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `Join ${familyName || 'our family'} on Home Hub! Go to ${origin}, sign up, and enter this invite code: ${inviteCode}`
}

function InviteCard() {
  const { familyName, inviteCode } = useFamily()
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may be unavailable (e.g. non-HTTPS) — the code is still visible to copy by hand.
    }
  }

  const sendEmail = () => {
    const subject = encodeURIComponent(`Join ${familyName || 'our family'} on Home Hub`)
    const body = encodeURIComponent(inviteMessage(familyName, inviteCode))
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const share = async () => {
    try {
      await navigator.share({
        title: `Join ${familyName || 'our family'} on Home Hub`,
        text: inviteMessage(familyName, inviteCode),
      })
    } catch {
      // User cancelled the share sheet, or the browser blocked it — nothing to do.
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title">Invite someone to {familyName || 'your family'}</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -6, marginBottom: 14 }}>
        New members create their own account, then enter this code to join. There's no "add a person" form
        anymore — everyone gets their own login.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="invite-code">{inviteCode || '—'}</div>
        <button className="btn" onClick={copy} disabled={!inviteCode}>{copied ? 'Copied!' : 'Copy code'}</button>
        <button className="btn" onClick={sendEmail} disabled={!inviteCode}>Send by email</button>
        {canShare && (
          <button className="btn" onClick={share} disabled={!inviteCode}>Share…</button>
        )}
      </div>
    </div>
  )
}

// General household import, not training-specific — unlike Strava/Apple
// Health/Garmin (which live on the Training page and match against
// scheduled sessions), there's nothing to match here, just a straight pull
// of whatever's on the connecting user's Google account. Imported events/
// tasks are marked `googleImported: true` and kept private to whoever
// connected, same treatment as trainingPlan events (see CalendarPage.jsx/
// HomePage.jsx/TasksPage.jsx filtering).
function GoogleSyncCard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: googleSync } = useLiveData(() => getGoogleSyncState(user?.uid), [user?.uid])
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState(null)

  // Google redirects back to this exact page with ?code=... after the user
  // approves access — exchange it for tokens server-side (the client secret
  // can never reach the browser, see functions/index.js), then drop the
  // code from the URL so a page refresh doesn't try to reuse it. Same
  // pattern as TrainingPage.jsx's Strava handling.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    setConnecting(true)
    httpsCallable(functions, 'googleExchangeCode')({ code, redirectUri: `${window.location.origin}/settings` })
      .catch((err) => setStatus(`Couldn't connect Google: ${err.message}`))
      .finally(() => {
        setConnecting(false)
        navigate('/settings', { replace: true })
      })
  }, [navigate])

  const handleSync = async () => {
    setSyncing(true)
    setStatus(null)
    try {
      const { data } = await httpsCallable(functions, 'googleSync')()
      setStatus(
        `Imported ${data.eventsImported} event${data.eventsImported === 1 ? '' : 's'}, ` +
        `${data.tasksImported} task${data.tasksImported === 1 ? '' : 's'}.`
      )
    } catch (err) {
      setStatus(`Sync failed: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title">Connected accounts</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -6, marginBottom: 14 }}>
        Import your Google Calendar events and Google Tasks into Home Hub. Imported items are private to
        you — hidden from everyone else's Combined view, same as your training plan.
      </p>
      {connecting ? (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Connecting Google…</span>
      ) : googleSync?.connected ? (
        <button className="btn" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync Google'}
        </button>
      ) : (
        <a className="btn" href={buildGoogleAuthorizeUrl(`${window.location.origin}/settings`)}>
          Connect Google
        </a>
      )}
      {status && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
          {status}
        </p>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { people, loading } = usePeople()
  const { user } = useAuth()

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      <InviteCard />
      <GoogleSyncCard />

      <div className="card">
        <div className="section-title">Family members</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -6, marginBottom: 14 }}>
          Rename or recolor anyone here. These names and colors show up everywhere — the calendar, tasks, and
          the Combined/individual view filters.
        </p>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : people.length === 0 ? (
          <div className="empty-state">No family members yet.</div>
        ) : (
          people.map((p) => <PersonRow key={p.id} person={p} isSelf={p.id === user?.uid} />)
        )}
      </div>
    </div>
  )
}
