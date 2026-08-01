import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeekCalendar from '../../components/WeekCalendar.jsx'
import { getWeekDays } from '../../utils/dates.js'

const ownerById = {
  'person-1': { id: 'person-1', name: 'Person 1', color: '#3b82f6' },
  all: { id: 'all', name: 'Everyone', color: '#10b981' },
}

const weekDays = getWeekDays('2026-01-05')

describe('WeekCalendar', () => {
  test('renders all 7 days of the week', () => {
    render(<WeekCalendar days={weekDays} events={[]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    // 7 date labels (e.g. "Jan 5") should be present.
    expect(screen.getAllByText(/^[A-Za-z]{3} \d{1,2}$/)).toHaveLength(7)
  })

  test('renders a single day when given a one-element days array', () => {
    render(<WeekCalendar days={['2026-01-05']} events={[]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    expect(screen.getAllByText(/^[A-Za-z]{3} \d{1,2}$/)).toHaveLength(1)
  })

  test('shows an empty-day placeholder for days with no events', () => {
    render(<WeekCalendar days={weekDays} events={[]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    expect(screen.getAllByText('—')).toHaveLength(7)
  })

  test('places an event on the correct day and shows its title/time', () => {
    const events = [{ id: 'e1', title: 'Dentist', date: '2026-01-07', startTime: '09:30', owner: 'person-1' }]
    render(<WeekCalendar days={weekDays} events={events} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.getByText('09:30')).toBeInTheDocument()
  })

  test('falls back to the "Everyone" color for an unknown owner id', () => {
    const events = [{ id: 'e1', title: 'Mystery event', date: '2026-01-07', owner: 'someone-deleted' }]
    render(<WeekCalendar days={weekDays} events={events} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    const chip = screen.getByText('Mystery event').closest('button')
    expect(chip.style.borderLeftColor).toBeTruthy()
  })

  test('shows the synced Strava summary on a matched training session', () => {
    const events = [{
      id: 'e1', title: 'Long run', date: '2026-01-07', owner: 'person-1',
      stravaActivityId: '123', actualDistanceMiles: 6, actualDurationMinutes: 50, actualPaceMinPerMile: 8.33,
    }]
    render(<WeekCalendar days={weekDays} events={events} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    expect(screen.getByText('6 mi in 50:00 (8:20/mi)')).toBeInTheDocument()
  })

  test('clicking + on a day calls onDayAdd with that day', async () => {
    const user = userEvent.setup()
    const onDayAdd = vi.fn()
    render(<WeekCalendar days={weekDays} events={[]} ownerById={ownerById} onDayAdd={onDayAdd} onEventClick={vi.fn()} />)
    const addButtons = screen.getAllByRole('button', { name: '+' })
    await user.click(addButtons[0])
    expect(onDayAdd).toHaveBeenCalledWith('2026-01-05')
  })

  test('clicking an event chip calls onEventClick with that event', async () => {
    const user = userEvent.setup()
    const onEventClick = vi.fn()
    const event = { id: 'e1', title: 'Dentist', date: '2026-01-07', owner: 'person-1' }
    render(<WeekCalendar days={weekDays} events={[event]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={onEventClick} />)
    await user.click(screen.getByText('Dentist'))
    expect(onEventClick).toHaveBeenCalledWith(event)
  })

  test('hideAddButton suppresses the per-day "+" button (used by TrainingPage\'s mini calendar)', () => {
    render(<WeekCalendar days={weekDays} events={[]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} hideAddButton />)
    expect(screen.queryAllByRole('button', { name: '+' })).toHaveLength(0)
  })

  test('clicking a day header calls onDayLabelClick with that day, when provided', async () => {
    const user = userEvent.setup()
    const onDayLabelClick = vi.fn()
    render(
      <WeekCalendar
        days={weekDays}
        events={[]}
        ownerById={ownerById}
        onDayAdd={vi.fn()}
        onEventClick={vi.fn()}
        onDayLabelClick={onDayLabelClick}
      />
    )
    await user.click(screen.getAllByText(/^[A-Za-z]{3} \d{1,2}$/)[0])
    expect(onDayLabelClick).toHaveBeenCalledWith('2026-01-05')
  })

  describe('agendaMode', () => {
    beforeEach(() => {
      // Fixes "today" to a date outside weekDays (2026-01-05..11), so these
      // tests aren't accidentally affected by the "today always shows" rule
      // unless a test deliberately mocks today to fall inside that range.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    test('skips days with no events', () => {
      const events = [
        { id: 'e1', title: 'Dentist', date: '2026-01-07', owner: 'person-1' },
        { id: 'e2', title: 'Haircut', date: '2026-01-09', owner: 'person-1' },
      ]
      render(<WeekCalendar days={weekDays} events={events} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} agendaMode />)
      expect(screen.getByText('Dentist')).toBeInTheDocument()
      expect(screen.getByText('Haircut')).toBeInTheDocument()
      expect(screen.queryAllByText(/^[A-Za-z]{3} \d{1,2}$/)).toHaveLength(2)
    })

    test('still shows today even with no events, as an anchor', () => {
      vi.setSystemTime(new Date('2026-01-07T12:00:00Z')) // falls inside weekDays
      render(<WeekCalendar days={weekDays} events={[]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} agendaMode />)
      expect(screen.getAllByText(/^[A-Za-z]{3} \d{1,2}$/)).toHaveLength(1)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    test('shows every day when every day has events (nothing to skip)', () => {
      const events = weekDays.map((day, i) => ({ id: `e${i}`, title: `Event ${i}`, date: day, owner: 'person-1' }))
      render(<WeekCalendar days={weekDays} events={events} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} agendaMode />)
      expect(screen.getAllByText(/^[A-Za-z]{3} \d{1,2}$/)).toHaveLength(7)
    })
  })
})
