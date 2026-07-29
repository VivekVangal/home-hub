import { getWeekDays, formatDayLabel, formatShortDate, todayISO } from '../utils/dates.js'
import { ALL } from '../consts.js'

export default function WeekCalendar({ weekStart, events, ownerById, onDayAdd, onEventClick }) {
  const days = getWeekDays(weekStart)
  const today = todayISO()

  const eventsByDay = days.reduce((acc, d) => {
    acc[d] = events.filter((e) => e.date === d)
    return acc
  }, {})

  return (
    <div className="week-grid">
      {days.map((day) => (
        <div key={day} className={'week-day' + (day === today ? ' is-today' : '')}>
          <div className="week-day-header">
            <div>
              <div className="week-day-name">{formatDayLabel(day)}</div>
              <div className="week-day-date">{formatShortDate(day)}</div>
            </div>
            <button className="btn btn-icon" onClick={() => onDayAdd(day)}>+</button>
          </div>
          <div className="week-day-events">
            {eventsByDay[day].length === 0 && <div className="week-day-empty">—</div>}
            {eventsByDay[day].map((ev) => {
              const owner = ownerById[ev.owner] || ALL
              return (
                <button
                  key={ev.id}
                  className="event-chip"
                  style={{ borderLeftColor: owner.color }}
                  onClick={() => onEventClick(ev)}
                >
                  {ev.startTime && <span className="event-time">{ev.startTime}</span>}
                  <span className="event-title">{ev.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
