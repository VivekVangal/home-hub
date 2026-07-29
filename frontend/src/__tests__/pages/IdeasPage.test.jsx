import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IdeasPage from '../../pages/IdeasPage.jsx'
import { seedTestFamily } from '../../test/helpers.js'

describe('IdeasPage', () => {
  beforeEach(async () => {
    await seedTestFamily()
  })

  test('adding an idea shows it in the list, defaulting to the Idea status', async () => {
    const user = userEvent.setup()
    render(<IdeasPage />)

    await user.click(screen.getByRole('button', { name: '+ Add idea' }))
    await user.type(screen.getByPlaceholderText('Smart lock on the front door'), 'Automate porch lights at dusk')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Automate porch lights at dusk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Idea (1)' })).toBeInTheDocument()
  })

  test('editing an idea to "Planned" moves it out of the Idea filter', async () => {
    const user = userEvent.setup()
    render(<IdeasPage />)

    await user.click(screen.getByRole('button', { name: '+ Add idea' }))
    await user.type(screen.getByPlaceholderText('Smart lock on the front door'), 'Add a robot vacuum')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Add a robot vacuum')

    await user.click(screen.getByText('Add a robot vacuum'))
    await user.selectOptions(screen.getByDisplayValue('Idea'), 'planned')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(await screen.findByRole('button', { name: 'Idea (0)' }))
    expect(screen.queryByText('Add a robot vacuum')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Planned (1)' }))
    expect(await screen.findByText('Add a robot vacuum')).toBeInTheDocument()
  })

  test('deleting an idea removes it', async () => {
    const user = userEvent.setup()
    render(<IdeasPage />)

    await user.click(screen.getByRole('button', { name: '+ Add idea' }))
    await user.type(screen.getByPlaceholderText('Smart lock on the front door'), 'Try a Home Hub chat assistant')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Try a Home Hub chat assistant')

    await user.click(screen.getByText('Try a Home Hub chat assistant'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.queryByText('Try a Home Hub chat assistant')).not.toBeInTheDocument()
  })
})
