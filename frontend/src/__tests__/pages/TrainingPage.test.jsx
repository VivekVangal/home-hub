import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrainingPage from '../../pages/TrainingPage.jsx'
import { AllProviders, setupSignedInFamily } from '../../test/helpers.js'

function renderTraining() {
  return render(<TrainingPage />, { wrapper: AllProviders })
}

describe('TrainingPage', () => {
  test('shows an empty state and a generate button before any plan exists', async () => {
    await setupSignedInFamily()
    renderTraining()

    expect(await screen.findByText(/No training sessions scheduled yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate my training plan' })).toBeInTheDocument()
  })

  test('shows a countdown to race day', async () => {
    await setupSignedInFamily()
    renderTraining()
    expect(await screen.findByText(/day.*to go/i)).toBeInTheDocument()
  })

  test('generating a plan populates upcoming sessions and flips the button to "Regenerate"', async () => {
    await setupSignedInFamily()
    renderTraining()
    await screen.findByText(/No training sessions scheduled yet/)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate my training plan' }))

    expect(await screen.findByText('Rest / mobility')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Regenerate remaining plan' })).toBeInTheDocument()
  })
})
