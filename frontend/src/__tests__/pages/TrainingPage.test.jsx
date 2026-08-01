import { describe, test, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import TrainingPage, { describeAdjustment } from '../../pages/TrainingPage.jsx'
import { saveTrainingProfile } from '../../db.js'
import { nextMondayISO } from '../../lib/trainingPlan.js'
import { todayISO } from '../../utils/dates.js'
import { setCallableHandler } from '../../test/mocks/functionsMock.js'
import { AllProviders, setupSignedInFamily } from '../../test/helpers.js'

// TrainingPage uses useNavigate() (to clean up the ?code=... query param
// after a Strava OAuth redirect), which needs a Router context.
function renderTraining() {
  return render(<MemoryRouter><TrainingPage /></MemoryRouter>, { wrapper: AllProviders })
}

describe('describeAdjustment', () => {
  test('returns null when nothing has been logged yet', () => {
    expect(describeAdjustment({ mileageMultiplier: 1, paceAdjustmentPct: 0, sessionsConsidered: 0 })).toBeNull()
  })

  test('returns null when sessions were logged but neither adjustment triggered', () => {
    expect(describeAdjustment({ mileageMultiplier: 1, paceAdjustmentPct: 0, sessionsConsidered: 3 })).toBeNull()
  })

  test('mentions a slowed ramp when the mileage multiplier is below 1', () => {
    const note = describeAdjustment({ mileageMultiplier: 0.75, paceAdjustmentPct: 0, sessionsConsidered: 4 })
    expect(note).toMatch(/slowed the mileage ramp 25%/)
  })

  test('mentions a faster stretch goal when the pace adjustment is negative', () => {
    const note = describeAdjustment({ mileageMultiplier: 1, paceAdjustmentPct: -0.03, sessionsConsidered: 4 })
    expect(note).toMatch(/nudged your stretch goal a little faster/)
  })

  test('mentions a slower stretch goal when the pace adjustment is positive', () => {
    const note = describeAdjustment({ mileageMultiplier: 1, paceAdjustmentPct: 0.03, sessionsConsidered: 4 })
    expect(note).toMatch(/nudged your stretch goal a little slower/)
  })

  test('mentions both when the ramp slowed and the pace adjusted in the same regeneration', () => {
    const note = describeAdjustment({ mileageMultiplier: 0.9, paceAdjustmentPct: 0.03, sessionsConsidered: 6 })
    expect(note).toMatch(/slowed the mileage ramp/)
    expect(note).toMatch(/nudged your stretch goal a little slower/)
  })
})

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

  test('"Generate Apple Health webhook URL" shows the returned URL', async () => {
    await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })

    const webhookUrl = 'https://us-central1-home-hub-family-dev.cloudfunctions.net/appleHealthWebhook?token=abc123'
    setCallableHandler('generateAppleHealthWebhookUrl', () => ({ url: webhookUrl }))
    await user.click(screen.getByRole('button', { name: 'Generate Apple Health webhook URL' }))

    expect(await screen.findByLabelText('Apple Health webhook URL')).toHaveValue(webhookUrl)
  })

  test('importing a Garmin CSV previews matches and applies them to the scheduled session', async () => {
    await setupSignedInFamily()
    renderTraining()
    await screen.findByText('Build your training plan')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))
    await screen.findByRole('button', { name: 'Regenerate remaining plan' })

    // A freshly generated plan always has a session on the first Monday it
    // covers, regardless of what type of session it is — Garmin import
    // matching (like Strava) is by date only, not by session title.
    const sessionDate = nextMondayISO(todayISO())
    const csv = [
      'Activity Type,Date,Title,Distance,Time',
      `Running,${sessionDate},Morning Run,3.10,28:30`,
    ].join('\n')
    const file = new File([csv], 'activities.csv', { type: 'text/csv' })
    // jsdom's File/Blob in this environment doesn't implement .text() —
    // TrainingPage.jsx relies on the standard File API, so patch it here
    // rather than work around a real browser capability in app code.
    file.text = async () => csv
    await user.upload(screen.getByLabelText('Import Garmin CSV'), file)

    expect(await screen.findByText('Found 1 running activity in the file, 1 matched to a scheduled session.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Apply import' }))

    expect(await screen.findByText('Imported — 1 run matched.')).toBeInTheDocument()
    expect(await screen.findByText('Imported from Garmin: 3.1 mi in 28:30 (9:11/mi)')).toBeInTheDocument()
  })
})
