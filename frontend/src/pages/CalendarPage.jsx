import { useMemo, useState } from 'react'
import { useLiveData } from '../hooks/useLiveData.js'
import { usePeople } from '../hooks/usePeople.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { getEvents, addEvent, updateEvent, deleteEvent } from '../db.js'
import { getWeekStart, getWeekDays, addDaysISO, formatShortDate, formatDisplayDate, todayISO } from '../utils/dates.js'
import { ALL } from '../consts.js'
import WeekCalendar from '../components/WeekCalendar.jsx'
import EventModal from '../components/EventModal.jsx'

const AGENDA_DAYS = 14

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState('week') // 'week' | 'day'
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [selectedDay, setSelectedDay] = useState(todayISO())
  const { data: events } = useLiveData(getEvents, [])
  const { people, ownerById } = usePeople()
  const { user } = useAuth()
  const [viewAs, setViewAs] = useState('all') // 'all' (combined) or a person id (individual)
  const [modalState, setModalState] = useState(null) // { mode: 'add'|'edit', event? }
  const isMobile = useIsMobile()

  // On phones, the Week/Day toggle gives way to a Google-Calendar-style
  // agenda: a rolling window starting today, sparse days skipped entirely
  // (see WeekCalendar.jsx's agendaMode) rather than a hard 7-day boundary.
  const today = todayISO()
  const agendaDays = useMemo(
    () => Array.from({ length: AGENDA_DAYS }, (_, i) => addDaysISO(today, i)),
    [today]
  )
  const days = isMobile ? agendaDays : viewMode === 'week' ? getWeekDays(weekStart) : [selectedDay]
  const rangeEvents = useMemo(
    () => (events || [])
      // Training-plan sessions and imported Google Calendar events are both
      // private to whoever they belong to — a deliberate exception to this
      // app's normally shared-by-default calendar (see TrainingPage.jsx /
      // SettingsPage.jsx / docs/ARCHITECTURE.md).
      .filter((e) => !e.trainingPlan || e.owner === user?.uid)
      .filter((e) => !e.googleImported || e.owner === user?.uid)
      .filter((e) => days.includes(e.date)),
    [events, days, user]
  )

  // Individual view shows that person's own items plus anything shared with
  // "Everyone"; combined view shows every event regardless of owner.
  const visibleEvents = useMemo(
    () => (viewAs === 'all' ? rangeEvents : rangeEvents.filter((e) => e.owner === viewAs || e.owner === 'all')),
    [rangeEvents, viewAs]
  )

  const label = isMobile
    ? 'Agenda'
    : viewMode === 'week'
      ? `${formatShortDate(days[0])} – ${formatShortDate(days[6])}`
      : formatDisplayDate(selectedDay)

  const handleSave = async (data) => {
    if (modalState.event) {
      await updateEvent(modalState.event.id, data)
    } else {
      await addEvent(data)
    }
    setModalState(null)
  }

  const handleDelete = async (id) => {
    await deleteEvent(id)
    setModalState(null)
  }

  const goPrev = () => {
    if (viewMode === 'week') setWeekStart(addDaysISO(weekStart, -7))
    else setSelectedDay(addDaysISO(selectedDay, -1))
  }

  const goNext = () => {
    if (viewMode === 'week') setWeekStart(addDaysISO(weekStart, 7))
    else setSelectedDay(addDaysISO(selectedDay, 1))
  }

  const goToToday = () => {
    if (viewMode === 'week') setWeekStart(getWeekStart())
    else setSelectedDay(todayISO())
  }

  // Clicking a day's header in week mode jumps straight into day mode for
  // that date, so "see this one day in more detail" is always one click away.
  const jumpToDay = (day) => {
    setSelectedDay(day)
    setViewMode('day')
  }

  return (
    <div>
      <h1 className="page-title">Calendar</h1>

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
          {!isMobile && <button className="btn" onClick={goPrev}>← Prev</button>}
          <div className="week-nav-label">{label}</div>
          {!isMobile && <button className="btn" onClick={goNext}>Next →</button>}
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={'btn' + (viewMode === 'week' ? ' btn-primary' : '')} onClick={() => setViewMode('week')}>
              Week
            </button>
            <button className={'btn' + (viewMode === 'day' ? ' btn-primary' : '')} onClick={() => setViewMode('day')}>
              Day
            </button>
            <button className="btn" onClick={goToToday}>{viewMode === 'week' ? 'This week' : 'Today'}</button>
            <button className="btn btn-primary" onClick={() => setModalState({ event: null, defaultDate: days[0] })}>
              + Add event
            </button>
          </div>
        )}
      </div>

      {!events ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <WeekCalendar
          days={days}
          events={visibleEvents}
          ownerById={ownerById}
          onDayAdd={(day) => setModalState({ event: null, defaultDate: day })}
          onEventClick={(ev) => setModalState({ event: ev })}
          onDayLabelClick={!isMobile && viewMode === 'week' ? jumpToDay : undefined}
          agendaMode={isMobile}
        />
      )}

      {isMobile && (
        <button
          className="btn btn-primary calendar-fab"
          onClick={() => setModalState({ event: null, defaultDate: today })}
          aria-label="New event"
        >
          +
        </button>
      )}

      {modalState && (
        <EventModal
          initial={modalState.event || { date: modalState.defaultDate }}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}
