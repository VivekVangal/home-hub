import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EventModal from '../../components/EventModal.jsx'
import { seedTestFamily } from '../../test/helpers.js'

// EventModal loads the family member list itself (via usePeople -> db.js,
// which reads from the current family's Firestore "members" collection).
// Every test seeds "Person 1" / "Person 2" as members first, then waits for
// that async load with findBy*.

describe('EventModal', () => {
  beforeEach(async () => {
    await seedTestFamily()
  })


  test('add mode: fills the form and calls onSave with the right shape', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<EventModal initial={{ date: '2026-03-01' }} onSave={onSave} onClose={onClose} onDelete={vi.fn()} />)

    expect(screen.getByText('New event')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Dentist appointment'), 'Soccer game')
    await user.click(await screen.findByRole('button', { name: 'Person 2' }))
    await user.click(screen.getByRole('button', { name: 'Add event' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Soccer game', date: '2026-03-01', owner: 'person-2' })
    )
  })

  test('does not submit without a title', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EventModal initial={{ date: '2026-03-01' }} onSave={onSave} onClose={vi.fn()} onDelete={vi.fn()} />)

    const form = screen.getByRole('button', { name: 'Add event' }).closest('form')
    // Title is a required field, so a native submit without it should not fire onSave.
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    expect(form.checkValidity()).toBe(false)
    expect(onSave).not.toHaveBeenCalled()
  })

  test('edit mode: shows Delete and calls onDelete with the event id', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <EventModal
        initial={{ id: 'evt-1', title: 'Existing', date: '2026-03-01', owner: 'all' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDelete={onDelete}
      />
    )

    expect(screen.getByText('Edit event')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('evt-1')
  })

  test('clicking the close (✕) button calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<EventModal initial={{ date: '2026-03-01' }} onSave={vi.fn()} onClose={onClose} onDelete={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(onClose).toHaveBeenCalled()
  })
})
