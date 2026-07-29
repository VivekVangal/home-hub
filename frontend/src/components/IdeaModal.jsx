import { useState } from 'react'
import { IDEA_TYPES, IDEA_STATUSES } from '../consts.js'

export default function IdeaModal({ initial, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [type, setType] = useState(initial?.type || IDEA_TYPES[0])
  const [status, setStatus] = useState(initial?.status || 'idea')
  const [notes, setNotes] = useState(initial?.notes || '')

  const isEdit = Boolean(initial?.id)

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), type, status, notes: notes.trim() })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{isEdit ? 'Edit idea' : 'New idea'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="idea-title">Idea</label>
            <input id="idea-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Smart lock on the front door" required />
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="idea-type">Type</label>
              <select id="idea-type" value={type} onChange={(e) => setType(e.target.value)}>
                {IDEA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="idea-status">Status</label>
              <select id="idea-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {IDEA_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="idea-notes">Notes (optional)</label>
            <textarea id="idea-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn btn-danger" onClick={() => onDelete(initial.id)}>Delete</button>
            )}
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
