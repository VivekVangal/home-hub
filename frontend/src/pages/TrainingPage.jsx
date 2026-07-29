import { useMemo, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useAuth } from '../context/AuthContext.jsx'
import { useLiveData } from '../hooks/useLiveData.js'
import { getEvents, addTrainingPlan, deleteUpcomingTrainingPlan } from '../db.js'
import { todayISO, formatDisplayDate } from '../utils/dates.js'
import { buildTrainingPlan, trainingPlanToEvents, nextMondayISO, RACE_DATE_ISO, RACE_NAME } from '../lib/trainingPlan.js'

const PHASE_LABEL = { base: 'Base building', build: 'Build', taper: 'Taper' }

function SessionRow({ session }) {
  return (
    <div className="list-item">
      <div className="list-item-main">
        <div className="list-item-title">{session.title}</div>
        <div className="list-item-sub">
          {formatDisplayDate(session.date)}
          {session.notes && <> · {session.notes.replace(/^\[.*?\]\s*/, '')}</>}
        </div>
      </div>
    </div>
  )
}

export default function TrainingPage() {
  const { user } = useAuth()
  const { data: events, loading } = useLiveData(getEvents, [])
  const [generating, setGenerating] = useState(false)

  const trainingEvents = useMemo(
    () => (events || []).filter((e) => e.trainingPlan && e.owner === user?.uid).sort((a, b) => a.date.localeCompare(b.date)),
    [events, user]
  )

  const today = todayISO()
  const daysUntilRace = differenceInCalendarDays(parseISO(RACE_DATE_ISO), parseISO(today))
  const hasPlan = trainingEvents.length > 0
  const upcoming = trainingEvents.filter((e) => e.date >= today).slice(0, 6)
  const currentPhase = upcoming[0]?.notes?.match(/,\s*(\w+)\]/)?.[1]

  const generate = async () => {
    setGenerating(true)
    try {
      if (hasPlan) await deleteUpcomingTrainingPlan(today)
      const plan = buildTrainingPlan(nextMondayISO(today), RACE_DATE_ISO)
      const toAdd = trainingPlanToEvents(plan, user.uid).filter((e) => e.date >= today)
      await addTrainingPlan(toAdd)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Training</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">{RACE_NAME}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: -6, marginBottom: 14 }}>
          {daysUntilRace >= 0
            ? `${daysUntilRace} day${daysUntilRace === 1 ? '' : 's'} to go — ${formatDisplayDate(RACE_DATE_ISO)}.`
            : 'Race day has passed.'}
          {currentPhase && ` Currently in the ${PHASE_LABEL[currentPhase] || currentPhase} phase.`}
        </p>
        <button className="btn btn-primary" onClick={generate} disabled={generating}>
          {generating ? 'Generating…' : hasPlan ? 'Regenerate remaining plan' : 'Generate my training plan'}
        </button>
        {hasPlan && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
            Regenerating replaces upcoming sessions only — anything before today stays as your log.
          </p>
        )}
      </div>

      <div className="card">
        <div className="section-title">Upcoming sessions</div>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state">
            No training sessions scheduled yet. Generate a plan above to add it to your personal calendar.
          </div>
        ) : (
          upcoming.map((s) => <SessionRow key={s.id} session={s} />)
        )}
      </div>
    </div>
  )
}
