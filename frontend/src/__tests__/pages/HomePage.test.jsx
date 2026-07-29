import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../../pages/HomePage.jsx'
import { addEvent, addTask, addGroceryItem } from '../../db.js'
import { todayISO, getWeekStart, addDaysISO } from '../../utils/dates.js'
import { seedTestFamily } from '../../test/helpers.js'

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  )
}

describe('HomePage dashboard', () => {
  beforeEach(async () => {
    await seedTestFamily()
  })

  test('shows empty states when there is no data yet', async () => {
    renderHome()
    expect(await screen.findByText('Nothing on the calendar today.')).toBeInTheDocument()
    expect(screen.getByText('No grocery list started for this week yet.')).toBeInTheDocument()
    expect(screen.getByText('Nothing overdue or upcoming. Nice.')).toBeInTheDocument()
  })

  test('surfaces today\'s event, this week\'s remaining groceries, and overdue tasks', async () => {
    await addEvent({ title: 'Vet appointment', date: todayISO(), owner: 'all' })
    await addGroceryItem({ name: 'Milk', weekStart: getWeekStart(), checked: false })
    await addGroceryItem({ name: 'Already got it', weekStart: getWeekStart(), checked: true })
    await addTask({ title: 'Overdue filter change', dueDate: addDaysISO(todayISO(), -3), owner: 'all' })

    renderHome()

    expect(await screen.findByText('Vet appointment')).toBeInTheDocument()
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.queryByText('Already got it')).not.toBeInTheDocument()
    expect(await screen.findByText('Overdue filter change')).toBeInTheDocument()
    expect(screen.getByText(/Overdue ·/)).toBeInTheDocument()
  })

  test('links out to the calendar, groceries, and tasks pages', async () => {
    renderHome()
    await screen.findByText('Nothing on the calendar today.')
    expect(screen.getByRole('link', { name: 'Open calendar' })).toHaveAttribute('href', '/calendar')
    expect(screen.getByRole('link', { name: 'Open grocery plan' })).toHaveAttribute('href', '/groceries')
    expect(screen.getByRole('link', { name: 'Open tasks' })).toHaveAttribute('href', '/tasks')
  })
})
