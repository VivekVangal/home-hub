import { useMemo, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useAuth } from '../context/AuthContext.jsx'
import { useLiveData } from '../hooks/useLiveData.js'
import { getEvents, getTrainingProfile, saveTrainingProfile, addTrainingPlan, deleteUpcomingTrainingPlan } from '../db.js'
import { todayISO, formatDisplayDate } from '../utils/dates.js'
import { buildTrainingPlan, trainingPlanToEvents, nextMondayISO } from '../lib/trainingPlan.js'
import TrainingPlanForm from '../components/TrainingPlanForm.jsx'

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
  const { data: events, loading: eventsLoading } = useLiveData(getEvents, [])
  const { data: profile, loading: profileLoading } = useLiveData(() => getTrainingProfile(user?.uid), [user?.uid])
  const [editing, setEditing] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Private by design: only this user's own training sessions, even in the
  // Combined family view elsewhere (see CalendarPage.jsx/HomePage.jsx) — a
  // deliberate exception to this app's normally shared-by-default calendar.
  const trainingEvents = useMemo(
    () => (events || []).filter((e) => e.trainingPlan && e.owner === user?.uid).sort((a, b) => a.date.localeCompare(b.date)),
    [events, user]
  )

  const today = todayISO()
  const hasPlan = trainingEvents.length > 0
  const upcoming = trainingEvents.filter((e) => e.date >= today).slice(0, 6)
  const currentPhase = upcoming[0]?.notes?.match(/,\s*(\w+)\]/)?.[1]
  const daysUntilRace = profile ? differenceInCalendarDays(parseISO(profile.raceDateISO), parseISO(today)) : null

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

      <div className="card">
        <div className="section-title">Upcoming sessions</div>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state">
            No training sessions scheduled yet. Fill out the form above to add your plan to your personal calendar.
          </div>
        ) : (
          upcoming.map((s) => <SessionRow key={s.id} session={s} />)
        )}
      </div>
    </div>
  )
}
