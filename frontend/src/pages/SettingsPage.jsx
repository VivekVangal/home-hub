import { useState } from 'react'
import { usePeople } from '../hooks/usePeople.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useFamily } from '../context/FamilyContext.jsx'
import { updatePerson, deletePerson } from '../db.js'
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

function InviteCard() {
  const { familyName, inviteCode } = useFamily()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may be unavailable (e.g. non-HTTPS) — the code is still visible to copy by hand.
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title">Invite someone to {familyName || 'your family'}</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -6, marginBottom: 14 }}>
        New members create their own account, then enter this code to join. There's no "add a person" form
        anymore — everyone gets their own login.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="invite-code">{inviteCode || '—'}</div>
        <button className="btn" onClick={copy} disabled={!inviteCode}>{copied ? 'Copied!' : 'Copy code'}</button>
      </div>
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
