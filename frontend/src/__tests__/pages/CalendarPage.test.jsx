import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarPage from '../../pages/CalendarPage.jsx'
import { addEvent } from '../../db.js'
import { todayISO, addDaysISO } from '../../utils/dates.js'
import { AllProviders, setupSignedInFamily } from '../../test/helpers.js'

// Simulates a phone-width viewport for useIsMobile() (see hooks/useIsMobile.js)
// — jsdom's window.matchMedia is itself only a stub (see test/setup.js), so
// this overrides it to report "matches" for any max-width query.
function mockMobileViewport() {
  const original = window.matchMedia
  window.matchMedia = (query) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })
  return () => { window.matchMedia = original }
}

// These exercise the "combined vs. individual" calendar requirement end to
// end: an event owned by one person should be hidden from the other
// person's individual view but visible in Combined, while an event owned by
// "Everyone" should show up in every view.
//
// CalendarPage reads useAuth() to keep training-plan events private to
// whoever created them — see CalendarPage.jsx — so it needs a signed-in,
// family-having context, same as SettingsPage/TrainingPage's tests.

function renderCalendar() {
  return render(<CalendarPage />, { wrapper: AllProviders })
}

describe('CalendarPage — individual vs combined views', () => {
  beforeEach(async () => {
    await setupSignedInFamily()
  })

  test('renders a Combined chip plus one chip per family member', async () => {
    renderCalendar()
    expect(await screen.findByRole('button', { name: 'Combined' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Person 1' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Person 2' })).toBeInTheDocument()
  })

  test('a personal event is visible in Combined and that person\'s view, hidden from the other person', async () => {
    const user = userEvent.setup()
    renderCalendar()
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
    renderCalendar()
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

  test('Day view (reached by clicking a day header) shows only that day\'s events', async () => {
    const user = userEvent.setup()
    const { container } = renderCalendar()
    await screen.findByRole('button', { name: 'Combined' })

    // Add one event on each of the week's first two days via each day
    // column's own "+" button.
    const dayAddButtons = await screen.findAllByRole('button', { name: '+' })
    await user.click(dayAddButtons[0])
    await user.type(screen.getByPlaceholderText('Dentist appointment'), 'Monday event')
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await screen.findByText('Monday event')

    await user.click(screen.getAllByRole('button', { name: '+' })[1])
    await user.type(screen.getByPlaceholderText('Dentist appointment'), 'Tuesday event')
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await screen.findByText('Tuesday event')

    // Clicking the first day's header jumps into Day view for that date.
    const firstDayHeader = container.querySelectorAll('.week-day-header > div')[0]
    await user.click(firstDayHeader)

    expect(screen.getByRole('button', { name: 'Day' })).toHaveClass('btn-primary')
    expect(await screen.findByText('Monday event')).toBeInTheDocument()
    expect(screen.queryByText('Tuesday event')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(await screen.findByText('Tuesday event')).toBeInTheDocument()
  })
})

describe('CalendarPage — Google Calendar import privacy', () => {
  test('a googleImported event is visible in Combined view for its owner but hidden for everyone else', async () => {
    const { user: authUser } = await setupSignedInFamily()
    await addEvent({
      title: "Someone else's Google event", date: todayISO(), owner: 'person-1',
      googleImported: true, googleEventId: 'g1',
    })
    await addEvent({
      title: 'My Google event', date: todayISO(), owner: authUser.uid,
      googleImported: true, googleEventId: 'g2',
    })
    renderCalendar()
    await screen.findByRole('button', { name: 'Combined' })

    expect(await screen.findByText('My Google event')).toBeInTheDocument()
    expect(screen.queryByText("Someone else's Google event")).not.toBeInTheDocument()
  })
})

describe('CalendarPage — mobile agenda view', () => {
  let restoreViewport

  beforeEach(async () => {
    restoreViewport = mockMobileViewport()
    await setupSignedInFamily()
  })

  afterEach(() => {
    restoreViewport()
  })

  test('hides the Week/Day toggle and Prev/Next controls, shown otherwise', async () => {
    renderCalendar()
    await screen.findByText('Agenda')
    expect(screen.queryByRole('button', { name: 'Week' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Day' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '← Prev' })).not.toBeInTheDocument()
  })

  test('an event today shows up in the agenda, and the floating "+" button opens the modal on today\'s date', async () => {
    const user = userEvent.setup()
    await addEvent({ title: 'Vet appointment', date: todayISO(), owner: 'all' })
    renderCalendar()

    expect(await screen.findByText('Vet appointment')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New event' }))
    await user.type(screen.getByPlaceholderText('Dentist appointment'), 'New agenda item')
    expect(screen.getByLabelText(/Date/)).toHaveValue(todayISO())
    await user.click(screen.getByRole('button', { name: 'Add event' }))

    expect(await screen.findByText('New agenda item')).toBeInTheDocument()
  })

  test('skips empty days beyond today, showing only days with something scheduled', async () => {
    await addEvent({ title: 'Far-out plan', date: addDaysISO(todayISO(), 5), owner: 'all' })
    renderCalendar()
    await screen.findByText('Agenda')

    // Today always renders as an anchor even though it's empty (exactly one
    // "—" placeholder, for today); every other visible day has an event.
    expect(await screen.findByText('Far-out plan')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(1)
  })
})
