import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TasksPage from '../../pages/TasksPage.jsx'
import { addTask } from '../../db.js'
import { AllProviders, setupSignedInFamily } from '../../test/helpers.js'

// TasksPage reads useAuth() to scope imported Google Tasks to their owner —
// see TasksPage.jsx — so it needs a signed-in, family-having context, same
// as CalendarPage/TrainingPage/SettingsPage's tests.
function renderTasks() {
  return render(<TasksPage />, { wrapper: AllProviders })
}

describe('TasksPage', () => {
  test('adding a to-do shows it under the To-dos tab', async () => {
    await setupSignedInFamily()
    const user = userEvent.setup()
    renderTasks()
    await user.click(screen.getByRole('button', { name: 'To-dos' }))

    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByPlaceholderText('Call the plumber'), 'Return library books')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Return library books')).toBeInTheDocument()
  })

  test('completing a task hides it unless "Show completed" is checked', async () => {
    await setupSignedInFamily()
    const user = userEvent.setup()
    renderTasks()
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
    await setupSignedInFamily()
    const user = userEvent.setup()
    renderTasks() // defaults to the Maintenance tab
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
    await setupSignedInFamily()
    const user = userEvent.setup()
    renderTasks()
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

  test('training prep to-dos stay off the household Tasks page, even with "Show completed" checked', async () => {
    await setupSignedInFamily()
    await addTask({ title: 'Register for race', owner: 'person-1', trainingTask: true })
    const user = userEvent.setup()
    renderTasks()
    await user.click(screen.getByRole('button', { name: 'To-dos' }))

    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByPlaceholderText('Call the plumber'), 'Household to-do')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Household to-do')

    await user.click(screen.getByLabelText('Show completed'))
    expect(screen.queryByText('Register for race')).not.toBeInTheDocument()
  })

  test('an imported Google Task is visible in Combined view for its owner but hidden for everyone else', async () => {
    const { user: authUser } = await setupSignedInFamily()
    await addTask({ title: "Someone else's Google task", owner: 'person-1', type: 'todo', googleImported: true, googleTaskId: 'g1' })
    await addTask({ title: 'My Google task', owner: authUser.uid, type: 'todo', googleImported: true, googleTaskId: 'g2' })
    renderTasks()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'To-dos' }))

    expect(await screen.findByText('My Google task')).toBeInTheDocument()
    expect(screen.queryByText("Someone else's Google task")).not.toBeInTheDocument()
  })
})
