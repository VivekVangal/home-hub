import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarPage from '../../pages/CalendarPage.jsx'
import { seedTestFamily } from '../../test/helpers.js'

// These exercise the "combined vs. individual" calendar requirement end to
// end: an event owned by one person should be hidden from the other
// person's individual view but visible in Combined, while an event owned by
// "Everyone" should show up in every view.

describe('CalendarPage — individual vs combined views', () => {
  beforeEach(async () => {
    await seedTestFamily()
  })

  test('renders a Combined chip plus one chip per family member', async () => {
    render(<CalendarPage />)
    expect(await screen.findByRole('button', { name: 'Combined' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Person 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Person 2' })).toBeInTheDocument()
  })

  test('a personal event is visible in Combined and that person\'s view, hidden from the other person', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />)
    await screen.findByRole('button', { name: 'Combined' })

    await user.click(screen.getByRole('button', { name: '+ Add event' }))
    await user.type(screen.getByPlaceholderText('Dentist appointment'), 'Person 1 only event')
    // "Person 1" now exists twice on screen (filter chip + owner toggle
    // inside the modal) — the modal's copy is the last one rendered.
    const ownerButtons = await screen.findAllByRole('button', { name: 'Person 1' })
    await user.click(ownerButtons[ownerButtons.length - 1])
    await user.click(screen.getByRole('button', { name: 'Add event' }))

    // Combined view: visible.
    expect(await screen.findByText('Person 1 only event')).toBeInTheDocument()

    // Switch to Person 2's individual view: hidden.
    const filterChips = screen.getAllByRole('button', { name: 'Person 2' })
    await user.click(filterChips[0])
    expect(screen.queryByText('Person 1 only event')).not.toBeInTheDocument()

    // Switch to Person 1's individual view: visible again.
    await user.click(screen.getAllByRole('button', { name: 'Person 1' })[0])
    expect(await screen.findByText('Person 1 only event')).toBeInTheDocument()
  })

  test('an "Everyone" event shows up in every individual view', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />)
    await screen.findByRole('button', { name: 'Combined' })

    await user.click(screen.getByRole('button', { name: '+ Add event' }))
    await user.type(screen.getByPlaceholderText('Dentist appointment'), 'Family dinner')
    // "Everyone" is the default owner — no need to change it.
    await user.click(screen.getByRole('button', { name: 'Add event' }))

    await screen.findByText('Family dinner')

    await user.click(screen.getAllByRole('button', { name: 'Person 1' })[0])
    expect(await screen.findByText('Family dinner')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Person 2' })[0])
    expect(await screen.findByText('Family dinner')).toBeInTheDocument()
  })
})
