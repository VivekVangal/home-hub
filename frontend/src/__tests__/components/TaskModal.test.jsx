import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskModal from '../../components/TaskModal.jsx'
import { seedTestFamily } from '../../test/helpers.js'

describe('TaskModal', () => {
  beforeEach(async () => {
    await seedTestFamily()
  })

  test('defaults to the To-do type and hides maintenance-only fields', async () => {
    render(<TaskModal defaultType="todo" onSave={vi.fn()} onClose={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: 'Person 1' }) // wait for owners to load
    expect(screen.queryByText('Category')).not.toBeInTheDocument()
    expect(screen.queryByText('Repeats')).not.toBeInTheDocument()
  })

  test('switching to Maintenance reveals category and recurrence fields', async () => {
    const user = userEvent.setup()
    render(<TaskModal defaultType="todo" onSave={vi.fn()} onClose={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: 'Person 1' })

    await user.click(screen.getByRole('button', { name: 'Maintenance' }))

    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Repeats')).toBeInTheDocument()
  })

  test('submits a maintenance task with category and recurrence', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TaskModal defaultType="maintenance" onSave={onSave} onClose={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: 'Person 1' })

    await user.type(screen.getByPlaceholderText('Replace HVAC filter'), 'Clean gutters')
    await user.click(screen.getByRole('button', { name: 'Person 1' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'maintenance',
        title: 'Clean gutters',
        owner: 'person-1',
        category: 'HVAC',
        recurrence: 'none',
      })
    )
  })

  test('submitting a to-do clears category and recurrence regardless of prior state', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TaskModal defaultType="todo" onSave={onSave} onClose={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: 'Person 1' })

    await user.type(screen.getByPlaceholderText('Call the plumber'), 'Return library books')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'todo', category: '', recurrence: 'none' })
    )
  })

  test('edit mode shows Delete and calls onDelete with the id', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <TaskModal
        initial={{ id: 'task-1', title: 'Existing', type: 'todo', owner: 'all' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDelete={onDelete}
      />
    )
    await screen.findByRole('button', { name: 'Person 1' })
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('task-1')
  })
})
