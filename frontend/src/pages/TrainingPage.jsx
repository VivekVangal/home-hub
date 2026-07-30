import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useAuth } from '../context/AuthContext.jsx'
import { useLiveData } from '../hooks/useLiveData.js'
import {
  getEvents, getTrainingProfile, saveTrainingProfile, addTrainingPlan, deleteUpcomingTrainingPlan, updateEvent,
  getTasks, addTask, updateTask, deleteTask, completeTask, applyImportedSessions,
} from '../db.js'
import { functions } from '../firebase.js'
import { todayISO, addDaysISO, formatDisplayDate } from '../utils/dates.js'
import { buildTrainingPlan, trainingPlanToEvents, nextMondayISO } from '../lib/trainingPlan.js'
import { buildStravaAuthorizeUrl, formatStravaSummary } from '../lib/strava.js'
import { formatTerraSummary } from '../lib/terra.js'
import { formatAppleHealthSummary } from '../lib/appleHealth.js'
import { formatGarminSummary } from '../lib/garmin.js'
import { parseGarminActivitiesCsv, matchGarminActivitiesToSessions, garminActivityToSessionFields } from '../lib/garminImport.js'
import TrainingPlanForm from '../components/TrainingPlanForm.jsx'

const PHASE_LABEL = { base: 'Base building', build: 'Build', taper: 'Taper' }

function SessionRow({ session, onSetStatus }) {
  const status = session.sessionStatus
  const stravaSummary = formatStravaSummary(session)
  const terraSummary = formatTerraSummary(session)
  const appleHealthSummary = formatAppleHealthSummary(session)
  const garminSummary = formatGarminSummary(session)
  return (
    <div className="list-item">
      <div className="list-item-main">
        <div className={'list-item-title' + (status === 'done' ? ' strike' : '')}>{session.title}</div>
        <div className="list-item-sub">
          {formatDisplayDate(session.date)}
          {session.notes && <> · {session.notes.replace(/^\[.*?\]\s*/, '')}</>}
          {status === 'skipped' && <> · <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Skipped</span></>}
        </div>
        {stravaSummary && (
          <div className="list-item-sub" style={{ color: 'var(--accent)' }}>Synced via Strava: {stravaSummary}</div>
        )}
        {terraSummary && (
          <div className="list-item-sub" style={{ color: 'var(--accent)' }}>Synced via Terra: {terraSummary}</div>
        )}
        {appleHealthSummary && (
          <div className="list-item-sub" style={{ color: 'var(--accent)' }}>Synced via Apple Health: {appleHealthSummary}</div>
        )}
        {garminSummary && (
          <div className="list-item-sub" style={{ color: 'var(--accent)' }}>Imported from Garmin: {garminSummary}</div>
        )}
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
  const navigate = useNavigate()
  const { data: events, loading: eventsLoading } = useLiveData(getEvents, [])
  const { data: profile, loading: profileLoading } = useLiveData(() => getTrainingProfile(user?.uid), [user?.uid])
  const { data: allTasks, loading: tasksLoading } = useLiveData(getTasks, [])
  const [editing, setEditing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showDoneTasks, setShowDoneTasks] = useState(false)
  const [connectingStrava, setConnectingStrava] = useState(false)
  const [syncingStrava, setSyncingStrava] = useState(false)
  const [stravaStatus, setStravaStatus] = useState(null)
  const [connectingTerra, setConnectingTerra] = useState(false)
  const [syncingTerra, setSyncingTerra] = useState(false)
  const [terraStatus, setTerraStatus] = useState(null)
  const [generatingAppleHealthUrl, setGeneratingAppleHealthUrl] = useState(false)
  const [appleHealthUrl, setAppleHealthUrl] = useState(null)
  const [appleHealthStatus, setAppleHealthStatus] = useState(null)
  const [garminPreview, setGarminPreview] = useState(null)
  const [applyingGarminImport, setApplyingGarminImport] = useState(false)
  const [garminStatus, setGarminStatus] = useState(null)

  // Strava redirects back to this exact page with ?code=... after the user
  // approves access — exchange it for tokens server-side (the client secret
  // can never reach the browser, see functions/index.js), then drop the
  // code from the URL so a page refresh doesn't try to reuse it.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    setConnectingStrava(true)
    httpsCallable(functions, 'stravaExchangeCode')({ code })
      .catch((err) => setStravaStatus(`Couldn't connect Strava: ${err.message}`))
      .finally(() => {
        setConnectingStrava(false)
        navigate('/training', { replace: true })
      })
  }, [navigate])

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

  const handleSyncStrava = async () => {
    setSyncingStrava(true)
    setStravaStatus(null)
    try {
      const { data } = await httpsCallable(functions, 'stravaSync')()
      setStravaStatus(
        data.matchedCount === 0
          ? 'Synced — no new activities matched a scheduled session.'
          : `Synced — ${data.matchedCount} run${data.matchedCount === 1 ? '' : 's'} matched.`
      )
    } catch (err) {
      setStravaStatus(`Sync failed: ${err.message}`)
    } finally {
      setSyncingStrava(false)
    }
  }

  // Terra's connect flow is entirely hosted (see lib/terra.js's header
  // comment): fetch a one-time widget URL from the Cloud Function, then
  // redirect the browser there. Terra itself handles the provider picker
  // and auth; the result reaches us later via terraWebhook, not a URL
  // parameter here, so there's no equivalent to Strava's ?code= handling.
  const handleConnectTerra = async () => {
    setConnectingTerra(true)
    setTerraStatus(null)
    try {
      const { data } = await httpsCallable(functions, 'terraGenerateWidgetSession')({
        redirectUrl: `${window.location.origin}/training`,
      })
      window.location.href = data.url
    } catch (err) {
      setTerraStatus(`Couldn't start Terra connection: ${err.message}`)
      setConnectingTerra(false)
    }
  }

  const handleSyncTerra = async () => {
    setSyncingTerra(true)
    setTerraStatus(null)
    try {
      const { data } = await httpsCallable(functions, 'terraSync')()
      if (data.processing) {
        setTerraStatus("Terra is still fetching your data — try syncing again in a moment.")
      } else {
        setTerraStatus(
          data.matchedCount === 0
            ? 'Synced — no new activities matched a scheduled session.'
            : `Synced — ${data.matchedCount} run${data.matchedCount === 1 ? '' : 's'} matched.`
        )
      }
    } catch (err) {
      setTerraStatus(`Sync failed: ${err.message}`)
    } finally {
      setSyncingTerra(false)
    }
  }

  // Apple Health has no cloud login to redirect to — this just asks the
  // Cloud Function to mint a fresh token and returns a ready-to-paste
  // webhook URL for a personal Shortcuts automation (see README.md for the
  // exact steps). The URL is only ever shown here, once, since it's never
  // persisted anywhere client-readable (see functions/index.js).
  const handleGenerateAppleHealthUrl = async () => {
    setGeneratingAppleHealthUrl(true)
    setAppleHealthStatus(null)
    try {
      const { data } = await httpsCallable(functions, 'generateAppleHealthWebhookUrl')()
      setAppleHealthUrl(data.url)
    } catch (err) {
      setAppleHealthStatus(`Couldn't generate a webhook URL: ${err.message}`)
    } finally {
      setGeneratingAppleHealthUrl(false)
    }
  }

  // Garmin has no API to call at all — this just parses a CSV the user
  // already exported from Garmin Connect and previews which rows match a
  // scheduled session, entirely client-side (see lib/garminImport.js).
  const handleGarminFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same file be re-selected later if needed
    if (!file) return
    setGarminStatus(null)
    const text = await file.text()
    const activities = parseGarminActivitiesCsv(text)
    const matches = matchGarminActivitiesToSessions(activities, trainingEvents)
    setGarminPreview({ activityCount: activities.length, matches })
  }

  const handleApplyGarminImport = async () => {
    if (!garminPreview) return
    setApplyingGarminImport(true)
    try {
      await applyImportedSessions(
        garminPreview.matches.map(({ session, activity }) => ({
          id: session.id,
          fields: garminActivityToSessionFields(activity),
        }))
      )
      setGarminStatus(`Imported — ${garminPreview.matches.length} run${garminPreview.matches.length === 1 ? '' : 's'} matched.`)
      setGarminPreview(null)
    } catch (err) {
      setGarminStatus(`Import failed: ${err.message}`)
    } finally {
      setApplyingGarminImport(false)
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
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              {connectingStrava ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Connecting Strava…</span>
              ) : profile.stravaConnected ? (
                <button className="btn" onClick={handleSyncStrava} disabled={syncingStrava}>
                  {syncingStrava ? 'Syncing…' : 'Sync with Strava'}
                </button>
              ) : (
                <a className="btn" href={buildStravaAuthorizeUrl(`${window.location.origin}/training`)}>
                  Connect Strava
                </a>
              )}
              {stravaStatus && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
                  {stravaStatus}
                </p>
              )}
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              {connectingTerra ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Connecting to Terra…</span>
              ) : profile.terraConnected ? (
                <button className="btn" onClick={handleSyncTerra} disabled={syncingTerra}>
                  {syncingTerra ? 'Syncing…' : 'Sync with Terra'}
                </button>
              ) : (
                <button className="btn" onClick={handleConnectTerra}>
                  Connect via Terra (Garmin, Apple Health, Fitbit, Oura…)
                </button>
              )}
              {terraStatus && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
                  {terraStatus}
                </p>
              )}
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Apple Health</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 8 }}>
                No cloud login for Apple Health — instead, generate a private URL below and point a personal Shortcuts
                automation at it so it POSTs each run automatically. See README.md for the exact Shortcuts steps.
              </p>
              <button className="btn" onClick={handleGenerateAppleHealthUrl} disabled={generatingAppleHealthUrl}>
                {generatingAppleHealthUrl
                  ? 'Generating…'
                  : profile.appleHealthConnected
                    ? 'Regenerate webhook URL'
                    : 'Generate Apple Health webhook URL'}
              </button>
              {appleHealthUrl && (
                <div style={{ marginTop: 8 }}>
                  <input
                    readOnly
                    value={appleHealthUrl}
                    onFocus={(e) => e.target.select()}
                    style={{ width: '100%', fontSize: '0.78rem' }}
                    aria-label="Apple Health webhook URL"
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 6, marginBottom: 0 }}>
                    Copy this now — it won't be shown again after you leave this page (regenerating replaces it, which
                    breaks any Shortcut already using the old one).
                  </p>
                </div>
              )}
              {appleHealthStatus && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
                  {appleHealthStatus}
                </p>
              )}
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Garmin (manual import)</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 8 }}>
                No live Garmin connection — Garmin's API requires business approval. Instead: Garmin Connect →
                Activities → export as CSV, then import it here. Set your Garmin account's display units to miles
                first, or distances will be off.
              </p>
              <input type="file" accept=".csv" onChange={handleGarminFileSelected} aria-label="Import Garmin CSV" />
              {garminPreview && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 8 }}>
                    Found {garminPreview.activityCount} running activit{garminPreview.activityCount === 1 ? 'y' : 'ies'} in
                    the file, {garminPreview.matches.length} matched to a scheduled session.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={handleApplyGarminImport}
                    disabled={applyingGarminImport || garminPreview.matches.length === 0}
                  >
                    {applyingGarminImport ? 'Importing…' : 'Apply import'}
                  </button>
                </div>
              )}
              {garminStatus && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
                  {garminStatus}
                </p>
              )}
            </div>
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
