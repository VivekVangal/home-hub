import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeekCalendar from '../../components/WeekCalendar.jsx'

const ownerById = {
  'person-1': { id: 'person-1', name: 'Person 1', color: '#3b82f6' },
  all: { id: 'all', name: 'Everyone', color: '#10b981' },
}

describe('WeekCalendar', () => {
  test('renders all 7 days of the week', () => {
    render(<WeekCalendar weekStart="2026-01-05" events={[]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    // 7 date labels (e.g. "Jan 5") should be present.
    expect(screen.getAllByText(/^[A-Za-z]{3} \d{1,2}$/)).toHaveLength(7)
  })

  test('shows an empty-day placeholder for days with no events', () => {
    render(<WeekCalendar weekStart="2026-01-05" events={[]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    expect(screen.getAllByText('—')).toHaveLength(7)
  })

  test('places an event on the correct day and shows its title/time', () => {
    const events = [{ id: 'e1', title: 'Dentist', date: '2026-01-07', startTime: '09:30', owner: 'person-1' }]
    render(<WeekCalendar weekStart="2026-01-05" events={events} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.getByText('09:30')).toBeInTheDocument()
  })

  test('falls back to the "Everyone" color for an unknown owner id', () => {
    const events = [{ id: 'e1', title: 'Mystery event', date: '2026-01-07', owner: 'someone-deleted' }]
    render(<WeekCalendar weekStart="2026-01-05" events={events} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={vi.fn()} />)
    const chip = screen.getByText('Mystery event').closest('button')
    expect(chip.style.borderLeftColor).toBeTruthy()
  })

  test('clicking + on a day calls onDayAdd with that day', async () => {
    const user = userEvent.setup()
    const onDayAdd = vi.fn()
    render(<WeekCalendar weekStart="2026-01-05" events={[]} ownerById={ownerById} onDayAdd={onDayAdd} onEventClick={vi.fn()} />)
    const addButtons = screen.getAllByRole('button', { name: '+' })
    await user.click(addButtons[0])
    expect(onDayAdd).toHaveBeenCalledWith('2026-01-05')
  })

  test('clicking an event chip calls onEventClick with that event', async () => {
    const user = userEvent.setup()
    const onEventClick = vi.fn()
    const event = { id: 'e1', title: 'Dentist', date: '2026-01-07', owner: 'person-1' }
    render(<WeekCalendar weekStart="2026-01-05" events={[event]} ownerById={ownerById} onDayAdd={vi.fn()} onEventClick={onEventClick} />)
    await user.click(screen.getByText('Dentist'))
    expect(onEventClick).toHaveBeenCalledWith(event)
  })
})
