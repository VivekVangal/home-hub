import { useMemo, useState } from 'react'
import { useLiveData } from '../hooks/useLiveData.js'
import { usePeople } from '../hooks/usePeople.js'
import { getTasks, addTask, updateTask, deleteTask, completeTask } from '../db.js'
import { formatDisplayDate, isPastDue } from '../utils/dates.js'
import { ALL } from '../consts.js'
import TaskModal from '../components/TaskModal.jsx'

function TaskRow({ task, ownerById, onToggle, onClick }) {
  const overdue = task.dueDate && !task.done && isPastDue(task.dueDate)
  const owner = ownerById[task.owner] || ALL
  return (
    <div className="list-item">
      <input
        type="checkbox"
        className="checkbox"
        checked={task.done}
        onChange={() => onToggle(task)}
        aria-label={`Mark "${task.title}" done`}
      />
      <div className="list-item-main" onClick={() => onClick(task)} style={{ cursor: 'pointer' }}>
        <div className={'list-item-title' + (task.done ? ' strike' : '')}>{task.title}</div>
        <div className="list-item-sub">
          {task.category && <>{task.category} · </>}
          <span style={{ color: overdue ? 'var(--danger)' : undefined, fontWeight: overdue ? 700 : undefined }}>
            {task.dueDate ? formatDisplayDate(task.dueDate) : 'No due date'}
          </span>
          {task.recurrence && task.recurrence !== 'none' && ' · repeats'}
          {' · '}
          <span className="pill" style={{ background: owner.color }}>{owner.name}</span>
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { data: tasks } = useLiveData(getTasks, [])
  const { people, ownerById } = usePeople()
  const [tab, setTab] = useState('maintenance') // 'maintenance' | 'todo'
  const [viewAs, setViewAs] = useState('all')
  const [modalState, setModalState] = useState(null)
  const [showDone, setShowDone] = useState(false)

  const filtered = useMemo(() => {
    return (tasks || [])
      .filter((t) => t.type === tab)
      .filter((t) => showDone || !t.done)
      .filter((t) => viewAs === 'all' || t.owner === viewAs || t.owner === 'all')
  }, [tasks, tab, showDone, viewAs])

  const handleSave = async (data) => {
    if (modalState.task) {
      await updateTask(modalState.task.id, data)
    } else {
      await addTask(data)
    }
    setModalState(null)
  }

  const handleDelete = async (id) => {
    await deleteTask(id)
    setModalState(null)
  }

  const handleToggle = (task) => {
    if (!task.done) {
      completeTask(task.id)
    } else {
      updateTask(task.id, { done: false })
    }
  }

  return (
    <div>
      <h1 className="page-title">Tasks</h1>

      <div className="view-toggle">
        <button
          className={'view-chip' + (viewAs === 'all' ? ' selected' : '')}
          style={viewAs === 'all' ? { background: ALL.color } : {}}
          onClick={() => setViewAs('all')}
        >
          Combined
        </button>
        {people.map((p) => (
          <button
            key={p.id}
            className={'view-chip' + (viewAs === p.id ? ' selected' : '')}
            style={viewAs === p.id ? { background: p.color } : {}}
            onClick={() => setViewAs(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="week-nav">
        <div className="week-nav-controls">
          <button className={'btn' + (tab === 'maintenance' ? ' btn-primary' : '')} onClick={() => setTab('maintenance')}>Maintenance</button>
          <button className={'btn' + (tab === 'todo' ? ' btn-primary' : '')} onClick={() => setTab('todo')}>To-dos</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show completed
          </label>
          <button className="btn btn-primary" onClick={() => setModalState({ task: null, defaultType: tab })}>+ Add</button>
        </div>
      </div>

      <div className="card">
        {!tasks ? (
          <div className="empty-state">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {tab === 'maintenance' ? 'No maintenance items. Add recurring upkeep like HVAC filters or gutter cleaning.' : 'No to-dos. Add anything that needs doing around the house.'}
          </div>
        ) : (
          filtered.map((task) => (
            <TaskRow key={task.id} task={task} ownerById={ownerById} onToggle={handleToggle} onClick={(t) => setModalState({ task: t })} />
          ))
        )}
      </div>

      {modalState && (
        <TaskModal
          initial={modalState.task}
          defaultType={modalState.defaultType}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}
