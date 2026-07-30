import { describe, test, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import TrainingPage from '../../pages/TrainingPage.jsx'
import { saveTrainingProfile } from '../../db.js'
import { setCallableHandler } from '../../test/mocks/functionsMock.js'
import { AllProviders, setupSignedInFamily } from '../../test/helpers.js'

// TrainingPage uses useNavigate() (to clean up the ?code=... query param
// after a Strava OAuth redirect), which needs a Router context.
function renderTraining() {
  return render(<MemoryRouter><TrainingPage /></MemoryRouter>, { wrapper: AllProviders })
}

describe('TrainingPage', () => {
  test('shows the training-plan form, prefilled with sensible defaults, before any plan exists', async () => {
    await setupSignedInFamily()
    renderTraining()

    expect(await screen.findByText('Build your training plan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Baystate Half Marathon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate my training plan' })).toBeInTheDocument()
  })

  test('submitting the form (even unchanged) generates and shows upcoming sessions', async () => {
    await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))

    expect(await screen.findByRole('button', { name: 'Regenerate remaining plan' })).toBeInTheDocument()
    expect(await screen.findByText('Edit plan')).toBeInTheDocument()
    // Whichever session lands on the very next scheduled day should show up.
    expect(screen.queryByText(/No training sessions scheduled yet/)).not.toBeInTheDocument()
  })

  test('"Edit plan" brings the form back, prefilled from the saved profile', async () => {
    await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await user.click(await screen.findByText('Edit plan'))

    expect(await screen.findByText('Build your training plan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Baystate Half Marathon')).toBeInTheDocument()
  })

  test('marking a session done strikes through its title', async () => {
    await setupSignedInFamily()
    const { container } = renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })

    const doneButtons = await screen.findAllByRole('button', { name: /^Mark ".*" done$/ })
    expect(container.querySelector('.list-item-title.strike')).not.toBeInTheDocument()
    await user.click(doneButtons[0])

    await waitFor(() => expect(container.querySelector('.list-item-title.strike')).toBeInTheDocument())
  })

  test('prep to-dos can be added and marked done, hidden by default once done', async () => {
    await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Register for race, buy shoes…'), 'Buy new shoes')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Buy new shoes')

    await user.click(screen.getByRole('checkbox', { name: 'Mark "Buy new shoes" done' }))
    expect(screen.queryByText('Buy new shoes')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Show completed'))
    expect(await screen.findByText('Buy new shoes')).toBeInTheDocument()
  })

  test('shows "Connect Strava" before connecting, and "Sync with Strava" once connected', async () => {
    const { user: authUser } = await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })

    const connectLink = screen.getByRole('link', { name: 'Connect Strava' })
    expect(connectLink.getAttribute('href')).toMatch(/^https:\/\/www\.strava\.com\/oauth\/authorize\?/)

    await saveTrainingProfile(authUser.uid, { stravaConnected: true })
    expect(await screen.findByRole('button', { name: 'Sync with Strava' })).toBeInTheDocument()
  })

  test('"Sync with Strava" calls the sync function and shows a status message', async () => {
    const { user: authUser } = await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })
    await saveTrainingProfile(authUser.uid, { stravaConnected: true })
    await screen.findByRole('button', { name: 'Sync with Strava' })

    setCallableHandler('stravaSync', () => ({ matchedCount: 2, activityCount: 3 }))
    await user.click(screen.getByRole('button', { name: 'Sync with Strava' }))

    expect(await screen.findByText('Synced — 2 runs matched.')).toBeInTheDocument()
  })

  test('shows "Connect via Terra" before connecting, and "Sync with Terra" once connected', async () => {
    const { user: authUser } = await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })

    expect(screen.getByRole('button', { name: /Connect via Terra/ })).toBeInTheDocument()

    await saveTrainingProfile(authUser.uid, { terraConnected: true })
    expect(await screen.findByRole('button', { name: 'Sync with Terra' })).toBeInTheDocument()
  })

  test('"Sync with Terra" calls the sync function and shows a status message', async () => {
    const { user: authUser } = await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })
    await saveTrainingProfile(authUser.uid, { terraConnected: true })
    await screen.findByRole('button', { name: 'Sync with Terra' })

    setCallableHandler('terraSync', () => ({ matchedCount: 1, activityCount: 1 }))
    await user.click(screen.getByRole('button', { name: 'Sync with Terra' }))

    expect(await screen.findByText('Synced — 1 run matched.')).toBeInTheDocument()
  })

  test('"Sync with Terra" surfaces a still-processing status without claiming zero activities', async () => {
    const { user: authUser } = await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })
    await saveTrainingProfile(authUser.uid, { terraConnected: true })
    await screen.findByRole('button', { name: 'Sync with Terra' })

    setCallableHandler('terraSync', () => ({ processing: true, retryAfterSeconds: 30, matchedCount: 0, activityCount: 0 }))
    await user.click(screen.getByRole('button', { name: 'Sync with Terra' }))

    expect(await screen.findByText(/still fetching your data/)).toBeInTheDocument()
  })

  test('"Connect via Terra" redirects the browser to the generated widget URL', async () => {
    await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })

    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: '' },
    })

    setCallableHandler('terraGenerateWidgetSession', () => ({ url: 'https://widget.tryterra.co/session/abc123' }))
    await user.click(screen.getByRole('button', { name: /Connect via Terra/ }))

    expect(window.location.href).toBe('https://widget.tryterra.co/session/abc123')

    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation })
  })
})
