import { useMemo, useState } from 'react'
import { useLiveData } from '../hooks/useLiveData.js'
import { getIdeas, addIdea, updateIdea, deleteIdea } from '../db.js'
import { IDEA_STATUSES } from '../consts.js'
import IdeaModal from '../components/IdeaModal.jsx'

function IdeaRow({ idea, onClick }) {
  return (
    <div className="list-item" onClick={() => onClick(idea)} style={{ cursor: 'pointer' }}>
      <div className="list-item-main">
        <div className="list-item-title">{idea.title}</div>
        <div className="list-item-sub">
          {idea.type}
          {idea.notes && <> · {idea.notes}</>}
        </div>
      </div>
    </div>
  )
}

export default function IdeasPage() {
  const { data: ideas } = useLiveData(getIdeas, [])
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalState, setModalState] = useState(null)

  const filtered = useMemo(
    () => (ideas || []).filter((i) => statusFilter === 'all' || i.status === statusFilter),
    [ideas, statusFilter]
  )

  const counts = useMemo(() => {
    const c = { all: (ideas || []).length }
    IDEA_STATUSES.forEach((s) => { c[s.value] = (ideas || []).filter((i) => i.status === s.value).length })
    return c
  }, [ideas])

  const handleSave = async (data) => {
    if (modalState.idea) {
      await updateIdea(modalState.idea.id, data)
    } else {
      await addIdea(data)
    }
    setModalState(null)
  }

  const handleDelete = async (id) => {
    await deleteIdea(id)
    setModalState(null)
  }

  return (
    <div>
      <h1 className="page-title">Ideas</h1>

      <div className="view-toggle">
        <button className={'view-chip' + (statusFilter === 'all' ? ' selected' : '')} onClick={() => setStatusFilter('all')}>
          All ({counts.all})
        </button>
        {IDEA_STATUSES.map((s) => (
          <button key={s.value} className={'view-chip' + (statusFilter === s.value ? ' selected' : '')} onClick={() => setStatusFilter(s.value)}>
            {s.label} ({counts[s.value] || 0})
          </button>
        ))}
      </div>

      <div className="week-nav">
        <div className="week-nav-controls" />
        <button className="btn btn-primary" onClick={() => setModalState({ idea: null })}>+ Add idea</button>
      </div>

      <div className="card">
        {!ideas ? (
          <div className="empty-state">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {statusFilter === 'all'
              ? 'No ideas yet. Add product ideas or home automations you want to get to eventually.'
              : `Nothing in "${IDEA_STATUSES.find((s) => s.value === statusFilter)?.label}" yet.`}
          </div>
        ) : (
          filtered.map((idea) => <IdeaRow key={idea.id} idea={idea} onClick={(i) => setModalState({ idea: i })} />)
        )}
      </div>

      {modalState && (
        <IdeaModal
          initial={modalState.idea}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}
