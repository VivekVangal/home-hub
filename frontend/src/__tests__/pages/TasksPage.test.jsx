import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TasksPage from '../../pages/TasksPage.jsx'
import { seedTestFamily } from '../../test/helpers.js'

describe('TasksPage', () => {
  beforeEach(async () => {
    await seedTestFamily()
  })

  test('adding a to-do shows it under the To-dos tab', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await user.click(screen.getByRole('button', { name: 'To-dos' }))

    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByPlaceholderText('Call the plumber'), 'Return library books')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Return library books')).toBeInTheDocument()
  })

  test('completing a task hides it unless "Show completed" is checked', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await user.click(screen.getByRole('button', { name: 'To-dos' }))
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByPlaceholderText('Call the plumber'), 'Water the plants')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Water the plants')

    await user.click(screen.getByRole('checkbox', { name: 'Mark "Water the plants" done' }))
    expect(screen.queryByText('Water the plants')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Show completed'))
    expect(await screen.findByText('Water the plants')).toBeInTheDocument()
  })

  test('completing a recurring maintenance task spawns the next occurrence', async () => {
    const user = userEvent.setup()
    render(<TasksPage />) // defaults to the Maintenance tab
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByPlaceholderText('Replace HVAC filter'), 'Change HVAC filter')
    await user.type(screen.getByLabelText(/Due date/), '2026-01-01')
    await user.selectOptions(screen.getByDisplayValue('One-time'), 'monthly')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await screen.findByText('Change HVAC filter')
    await user.click(screen.getByRole('checkbox', { name: 'Mark "Change HVAC filter" done' }))

    // The completed one is hidden by default; the freshly spawned one (due a
    // month later, not done) should still be visible under the same title.
    expect(await screen.findByText('Change HVAC filter')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Show completed'))
    // Now both the completed original and the new occurrence are visible.
    expect(screen.getAllByText('Change HVAC filter')).toHaveLength(2)
  })

  test('the Combined / individual filter chips scope which tasks are shown', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    await user.click(screen.getByRole('button', { name: 'To-dos' }))
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByPlaceholderText('Call the plumber'), 'Person 1 task')
    const ownerButtons = await screen.findAllByRole('button', { name: 'Person 1' })
    await user.click(ownerButtons[ownerButtons.length - 1])
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Person 1 task')

    await user.click(screen.getAllByRole('button', { name: 'Person 2' })[0])
    expect(screen.queryByText('Person 1 task')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Combined' }))
    expect(await screen.findByText('Person 1 task')).toBeInTheDocument()
  })
})
