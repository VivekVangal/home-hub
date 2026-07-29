import { Link } from 'react-router-dom'
import { useLiveData } from '../hooks/useLiveData.js'
import { usePeople } from '../hooks/usePeople.js'
import { getEvents, getGroceryItems, getTasks } from '../db.js'
import { todayISO, getWeekStart, formatDisplayDate, formatDayLabel, isPastDue } from '../utils/dates.js'
import { ALL } from '../consts.js'

const today = todayISO()
const weekStart = getWeekStart()

export default function HomePage() {
  const { data: events } = useLiveData(getEvents, [])
  const { data: groceries } = useLiveData(() => getGroceryItems(weekStart), [])
  const { data: tasks } = useLiveData(getTasks, [])
  const { ownerById } = usePeople()

  const todayEvents = (events || []).filter((e) => e.date === today)
  const groceriesRemaining = (groceries || []).filter((g) => !g.checked)
  const overdueTasks = (tasks || []).filter((t) => !t.done && t.dueDate && isPastDue(t.dueDate))
  const upcomingTasks = (tasks || [])
    .filter((t) => !t.done && t.dueDate && !isPastDue(t.dueDate))
    .slice(0, 5)

  return (
    <div>
      <h1 className="page-title">Good {timeOfDay()}. Here's the household today ({formatDayLabel(today)}).</h1>

      <div className="grid-3">
        <div className="card">
          <div className="section-title">Today's schedule</div>
          {!events ? (
            <div className="empty-state">Loading…</div>
          ) : todayEvents.length === 0 ? (
            <div className="empty-state">Nothing on the calendar today.</div>
          ) : (
            todayEvents.map((ev) => {
              const owner = ownerById[ev.owner] || ALL
              return (
                <div className="list-item" key={ev.id}>
                  <div className="list-item-main">
                    <div className="list-item-title">{ev.title}</div>
                    <div className="list-item-sub">
                      {ev.startTime || 'All day'}{' · '}
                      <span className="pill" style={{ background: owner.color }}>{owner.name}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <Link to="/calendar" className="btn" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
            Open calendar
          </Link>
        </div>

        <div className="card">
          <div className="section-title">This week's groceries</div>
          {!groceries ? (
            <div className="empty-state">Loading…</div>
          ) : groceries.length === 0 ? (
            <div className="empty-state">No grocery list started for this week yet.</div>
          ) : (
            <>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                {groceriesRemaining.length} item{groceriesRemaining.length === 1 ? '' : 's'} left to pick up
                {' '}({groceries.length - groceriesRemaining.length}/{groceries.length} done)
              </div>
              {groceriesRemaining.slice(0, 6).map((g) => (
                <div className="list-item" key={g.id}>
                  <div className="list-item-main">
                    <div className="list-item-title">{g.name}{g.quantity ? ` — ${g.quantity}` : ''}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          <Link to="/groceries" className="btn" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
            Open grocery plan
          </Link>
        </div>

        <div className="card">
          <div className="section-title">Tasks needing attention</div>
          {!tasks ? (
            <div className="empty-state">Loading…</div>
          ) : overdueTasks.length === 0 && upcomingTasks.length === 0 ? (
            <div className="empty-state">Nothing overdue or upcoming. Nice.</div>
          ) : (
            <>
              {overdueTasks.map((t) => (
                <div className="list-item" key={t.id}>
                  <div className="list-item-main">
                    <div className="list-item-title">{t.title}</div>
                    <div className="list-item-sub" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                      Overdue · {formatDisplayDate(t.dueDate)}
                    </div>
                  </div>
                </div>
              ))}
              {upcomingTasks.map((t) => (
                <div className="list-item" key={t.id}>
                  <div className="list-item-main">
                    <div className="list-item-title">{t.title}</div>
                    <div className="list-item-sub">Due {formatDisplayDate(t.dueDate)}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          <Link to="/tasks" className="btn" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
            Open tasks
          </Link>
        </div>
      </div>
    </div>
  )
}

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
