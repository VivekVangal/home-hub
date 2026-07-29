import { useMemo, useState } from 'react'
import { useLiveData } from '../hooks/useLiveData.js'
import { usePeople } from '../hooks/usePeople.js'
import { getEvents, addEvent, updateEvent, deleteEvent } from '../db.js'
import { getWeekStart, getWeekDays, addDaysISO, formatShortDate } from '../utils/dates.js'
import { ALL } from '../consts.js'
import WeekCalendar from '../components/WeekCalendar.jsx'
import EventModal from '../components/EventModal.jsx'

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const { data: events } = useLiveData(getEvents, [])
  const { people, ownerById } = usePeople()
  const [viewAs, setViewAs] = useState('all') // 'all' (combined) or a person id (individual)
  const [modalState, setModalState] = useState(null) // { mode: 'add'|'edit', event? }

  const weekDays = getWeekDays(weekStart)
  const weekEvents = useMemo(
    () => (events || []).filter((e) => weekDays.includes(e.date)),
    [events, weekStart]
  )

  // Individual view shows that person's own items plus anything shared with
  // "Everyone"; combined view shows every event regardless of owner.
  const visibleEvents = useMemo(
    () => (viewAs === 'all' ? weekEvents : weekEvents.filter((e) => e.owner === viewAs || e.owner === 'all')),
    [weekEvents, viewAs]
  )

  const label = `${formatShortDate(weekDays[0])} – ${formatShortDate(weekDays[6])}`

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
          <button className="btn" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>← Prev</button>
          <div className="week-nav-label">{label}</div>
          <button className="btn" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>Next →</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setWeekStart(getWeekStart())}>This week</button>
          <button className="btn btn-primary" onClick={() => setModalState({ event: null, defaultDate: weekDays[0] })}>
            + Add event
          </button>
        </div>
      </div>

      {!events ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <WeekCalendar
          weekStart={weekStart}
          events={visibleEvents}
          ownerById={ownerById}
          onDayAdd={(day) => setModalState({ event: null, defaultDate: day })}
          onEventClick={(ev) => setModalState({ event: ev })}
        />
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
