import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrainingPage from '../../pages/TrainingPage.jsx'
import { AllProviders, setupSignedInFamily } from '../../test/helpers.js'

function renderTraining() {
  return render(<TrainingPage />, { wrapper: AllProviders })
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
})
