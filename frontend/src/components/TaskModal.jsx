import { useState } from 'react'
import { MAINTENANCE_CATEGORIES } from '../consts.js'
import { usePeople } from '../hooks/usePeople.js'

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'yearly', label: 'Every year' },
]

export default function TaskModal({ initial, defaultType, onSave, onDelete, onClose }) {
  const { owners } = usePeople()
  const [type, setType] = useState(initial?.type || defaultType || 'todo')
  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || MAINTENANCE_CATEGORIES[0])
  const [dueDate, setDueDate] = useState(initial?.dueDate || '')
  const [owner, setOwner] = useState(initial?.owner || 'all')
  const [recurrence, setRecurrence] = useState(initial?.recurrence || 'none')
  const [notes, setNotes] = useState(initial?.notes || '')

  const isEdit = Boolean(initial?.id)

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      type,
      title: title.trim(),
      category: type === 'maintenance' ? category : '',
      dueDate,
      owner,
      recurrence: type === 'maintenance' ? recurrence : 'none',
      notes: notes.trim(),
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{isEdit ? 'Edit item' : 'New item'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Type</label>
            <div className="owner-toggle">
              <button type="button" className={type === 'todo' ? 'selected' : ''} style={type === 'todo' ? { background: '#3b6e5e' } : {}} onClick={() => setType('todo')}>To-do</button>
              <button type="button" className={type === 'maintenance' ? 'selected' : ''} style={type === 'maintenance' ? { background: '#3b6e5e' } : {}} onClick={() => setType('maintenance')}>Maintenance</button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="task-title">{type === 'maintenance' ? 'Task' : 'Item'}</label>
            <input id="task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'maintenance' ? 'Replace HVAC filter' : 'Call the plumber'} required />
          </div>

          {type === 'maintenance' && (
            <div className="field">
              <label htmlFor="task-category">Category</label>
              <select id="task-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {MAINTENANCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="grid-2">
            <div className="field">
              <label htmlFor="task-due-date">Due date {type === 'todo' && '(optional)'}</label>
              <input id="task-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            {type === 'maintenance' && (
              <div className="field">
                <label htmlFor="task-recurrence">Repeats</label>
                <select id="task-recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                  {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            )}
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
            <label htmlFor="task-notes">Notes (optional)</label>
            <textarea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
