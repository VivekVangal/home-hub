import { formatDayLabel, formatShortDate, todayISO } from '../utils/dates.js'
import { ALL } from '../consts.js'
import { formatStravaSummary } from '../lib/strava.js'

// Renders one column per entry in `days` — a 7-element array for the week
// view, or a single-element array for the day view (CalendarPage.jsx picks
// which). Same day-cell markup either way; the CSS grid just ends up with
// fewer columns.
//
// `hideAddButton` (default false, only used by TrainingPage.jsx's compact
// mini-calendar) suppresses the "+" add-event button per day — that widget
// is a read-mostly at-a-glance view of someone's own training sessions, not
// a place to create arbitrary new calendar events.
export default function WeekCalendar({ days, events, ownerById, onDayAdd, onEventClick, onDayLabelClick, hideAddButton = false }) {
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
            <div
              onClick={onDayLabelClick ? () => onDayLabelClick(day) : undefined}
              style={onDayLabelClick ? { cursor: 'pointer' } : undefined}
            >
              <div className="week-day-name">{formatDayLabel(day)}</div>
              <div className="week-day-date">{formatShortDate(day)}</div>
            </div>
            {!hideAddButton && <button className="btn btn-icon" onClick={() => onDayAdd(day)}>+</button>}
          </div>
          <div className="week-day-events">
            {eventsByDay[day].length === 0 && <div className="week-day-empty">—</div>}
            {eventsByDay[day].map((ev) => {
              const owner = ownerById[ev.owner] || ALL
              const stravaSummary = formatStravaSummary(ev)
              return (
                <button
                  key={ev.id}
                  className="event-chip"
                  style={{ borderLeftColor: owner.color }}
                  onClick={() => onEventClick(ev)}
                >
                  {ev.startTime && <span className="event-time">{ev.startTime}</span>}
                  <span className="event-title">{ev.title}</span>
                  {stravaSummary && <span className="event-time">{stravaSummary}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
