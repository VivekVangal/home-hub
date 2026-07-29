import { useMemo, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useAuth } from '../context/AuthContext.jsx'
import { useLiveData } from '../hooks/useLiveData.js'
import {
  getEvents, getTrainingProfile, saveTrainingProfile, addTrainingPlan, deleteUpcomingTrainingPlan, updateEvent,
  getTasks, addTask, updateTask, deleteTask, completeTask,
} from '../db.js'
import { todayISO, addDaysISO, formatDisplayDate } from '../utils/dates.js'
import { buildTrainingPlan, trainingPlanToEvents, nextMondayISO } from '../lib/trainingPlan.js'
import TrainingPlanForm from '../components/TrainingPlanForm.jsx'

const PHASE_LABEL = { base: 'Base building', build: 'Build', taper: 'Taper' }

function SessionRow({ session, onSetStatus }) {
  const status = session.sessionStatus
  return (
    <div className="list-item">
      <div className="list-item-main">
        <div className={'list-item-title' + (status === 'done' ? ' strike' : '')}>{session.title}</div>
        <div className="list-item-sub">
          {formatDisplayDate(session.date)}
          {session.notes && <> · {session.notes.replace(/^\[.*?\]\s*/, '')}</>}
          {status === 'skipped' && <> · <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Skipped</span></>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-icon"
          style={status === 'done' ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : {}}
          onClick={() => onSetStatus(session, 'done')}
          aria-label={`Mark "${session.title}" done`}
        >
          ✓
        </button>
        <button
          type="button"
          className="btn btn-icon"
          style={status === 'skipped' ? { background: 'var(--danger)', color: '#fff', borderColor: 'transparent' } : {}}
          onClick={() => onSetStatus(session, 'skipped')}
          aria-label={`Mark "${session.title}" skipped`}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function PrepTaskRow({ task, onToggle, onDelete }) {
  return (
    <div className="list-item">
      <input
        type="checkbox"
        className="checkbox"
        checked={task.done}
        onChange={() => onToggle(task)}
        aria-label={`Mark "${task.title}" done`}
      />
      <div className="list-item-main">
        <div className={'list-item-title' + (task.done ? ' strike' : '')}>{task.title}</div>
        {task.dueDate && <div className="list-item-sub">{formatDisplayDate(task.dueDate)}</div>}
      </div>
      <button type="button" className="btn btn-icon" onClick={() => onDelete(task.id)} aria-label={`Delete "${task.title}"`}>
        ✕
      </button>
    </div>
  )
}

function PrepTaskAddForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), dueDate })
    setTitle('')
    setDueDate('')
  }

  return (
    <form onSubmit={submit} className="grocery-add-form" style={{ marginBottom: 12 }}>
      <input
        placeholder="Register for race, buy shoes…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ flex: 2 }}
      />
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ flex: 1 }} />
      <button type="submit" className="btn btn-primary">Add</button>
    </form>
  )
}

export default function TrainingPage() {
  const { user } = useAuth()
  const { data: events, loading: eventsLoading } = useLiveData(getEvents, [])
  const { data: profile, loading: profileLoading } = useLiveData(() => getTrainingProfile(user?.uid), [user?.uid])
  const { data: allTasks, loading: tasksLoading } = useLiveData(getTasks, [])
  const [editing, setEditing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showDoneTasks, setShowDoneTasks] = useState(false)

  // Private by design: only this user's own training sessions, even in the
  // Combined family view elsewhere (see CalendarPage.jsx/HomePage.jsx) — a
  // deliberate exception to this app's normally shared-by-default calendar.
  const trainingEvents = useMemo(
    () => (events || []).filter((e) => e.trainingPlan && e.owner === user?.uid).sort((a, b) => a.date.localeCompare(b.date)),
    [events, user]
  )

  // Same privacy rule as sessions above — prep to-dos are marked
  // `trainingTask: true` and excluded from the household Tasks page/dashboard
  // (see TasksPage.jsx/HomePage.jsx), so they only ever show up here.
  const prepTasks = useMemo(
    () => (allTasks || []).filter((t) => t.trainingTask && t.owner === user?.uid),
    [allTasks, user]
  )
  const visiblePrepTasks = prepTasks.filter((t) => showDoneTasks || !t.done)

  const today = todayISO()
  const hasPlan = trainingEvents.length > 0
  const futureSessions = trainingEvents.filter((e) => e.date >= today)
  const currentPhase = futureSessions[0]?.notes?.match(/,\s*(\w+)\]/)?.[1]
  const daysUntilRace = profile ? differenceInCalendarDays(parseISO(profile.raceDateISO), parseISO(today)) : null

  // Shows the past week alongside what's ahead so recent runs can still be
  // logged as done/skipped, not just future ones.
  const sessionWindowStart = addDaysISO(today, -6)
  const sessions = trainingEvents.filter((e) => e.date >= sessionWindowStart).slice(0, 12)

  const generateFromProfile = async (submittedProfile) => {
    setGenerating(true)
    try {
      await saveTrainingProfile(user.uid, submittedProfile)
      if (hasPlan) await deleteUpcomingTrainingPlan(today)
      const plan = buildTrainingPlan({ ...submittedProfile, startISO: nextMondayISO(today) })
      const toAdd = trainingPlanToEvents(plan, user.uid).filter((e) => e.date >= today)
      await addTrainingPlan(toAdd)
      setEditing(false)
    } finally {
      setGenerating(false)
    }
  }

  const handleSetStatus = async (session, status) => {
    await updateEvent(session.id, { sessionStatus: session.sessionStatus === status ? null : status })
  }

  const handleAddPrepTask = async ({ title, dueDate }) => {
    await addTask({ title, dueDate, type: 'todo', owner: user.uid, trainingTask: true })
  }

  const handleTogglePrepTask = (task) => {
    if (!task.done) {
      completeTask(task.id)
    } else {
      updateTask(task.id, { done: false })
    }
  }

  const loading = eventsLoading || profileLoading

  return (
    <div>
      <h1 className="page-title">Training</h1>

      {!loading && (editing || !profile) ? (
        <TrainingPlanForm initial={profile} onSubmit={generateFromProfile} submitting={generating} />
      ) : (
        !loading && profile && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">{profile.raceName}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -6, marginBottom: 14 }}>
              {daysUntilRace >= 0
                ? `${daysUntilRace} day${daysUntilRace === 1 ? '' : 's'} to go — ${formatDisplayDate(profile.raceDateISO)}.`
                : 'Race day has passed.'}
              {currentPhase && ` Currently in the ${PHASE_LABEL[currentPhase] || currentPhase} phase.`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => generateFromProfile(profile)} disabled={generating}>
                {generating ? 'Regenerating…' : 'Regenerate remaining plan'}
              </button>
              <button className="btn" onClick={() => setEditing(true)}>Edit plan</button>
            </div>
            {hasPlan && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
                Regenerating replaces upcoming sessions only — anything before today stays as your log. Only you can see these sessions.
              </p>
            )}
          </div>
        )
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Sessions</div>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            No training sessions scheduled yet. Fill out the form above to add your plan to your personal calendar.
          </div>
        ) : (
          sessions.map((s) => <SessionRow key={s.id} session={s} onSetStatus={handleSetStatus} />)
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Prep to-dos</div>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showDoneTasks} onChange={(e) => setShowDoneTasks(e.target.checked)} />
            Show completed
          </label>
        </div>
        <PrepTaskAddForm onAdd={handleAddPrepTask} />
        {tasksLoading ? (
          <div className="empty-state">Loading…</div>
        ) : visiblePrepTasks.length === 0 ? (
          <div className="empty-state">
            No prep to-dos yet — things like registering for the race or replacing worn-out shoes.
          </div>
        ) : (
          visiblePrepTasks.map((t) => (
            <PrepTaskRow key={t.id} task={t} onToggle={handleTogglePrepTask} onDelete={deleteTask} />
          ))
        )}
      </div>
    </div>
  )
}
