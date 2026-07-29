import { useState } from 'react'
import { usePeople } from '../hooks/usePeople.js'

export default function EventModal({ initial, onSave, onDelete, onClose }) {
  const { owners } = usePeople()
  const [title, setTitle] = useState(initial?.title || '')
  const [date, setDate] = useState(initial?.date || '')
  const [startTime, setStartTime] = useState(initial?.startTime || '')
  const [endTime, setEndTime] = useState(initial?.endTime || '')
  const [owner, setOwner] = useState(initial?.owner || 'all')
  const [notes, setNotes] = useState(initial?.notes || '')

  const isEdit = Boolean(initial?.id)

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    onSave({ title: title.trim(), date, startTime, endTime, owner, notes: notes.trim() })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{isEdit ? 'Edit event' : 'New event'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="event-title">Title</label>
            <input id="event-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dentist appointment" required />
          </div>
          <div className="field">
            <label htmlFor="event-date">Date</label>
            <input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="event-start">Start time</label>
              <input id="event-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="event-end">End time</label>
              <input id="event-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Who</label>
            <div className="owner-toggle">
              {owners.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  className={owner === o.id ? 'selected' : ''}
                  style={owner === o.id ? { background: o.color } : {}}
                  onClick={() => setOwner(o.id)}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="event-notes">Notes (optional)</label>
            <textarea id="event-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bring insurance card, etc." />
          </div>
          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn btn-danger" onClick={() => onDelete(initial.id)}>
                Delete
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save' : 'Add event'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
