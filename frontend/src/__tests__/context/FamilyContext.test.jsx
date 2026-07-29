import { describe, test, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../../context/AuthContext.jsx'
import { FamilyProvider, useFamily } from '../../context/FamilyContext.jsx'

// Exercises the real create-family / join-family flow end to end against
// the mocked Firebase SDK: two different signed-in users, one creates a
// family and gets an invite code, the other joins using that code.
function Probe() {
  const { user, signUp, signOut } = useAuth()
  const { familyName, inviteCode, hasFamily, loading, createFamily, joinFamily } = useFamily()
  const [error, setError] = useState('')
  const [joinCodeInput, setJoinCodeInput] = useState('')

  const tryIt = (fn) => async () => {
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div data-testid="auth-status">{user ? `signed-in:${user.email}` : 'signed-out'}</div>
      <div data-testid="family-status">{loading ? 'loading' : hasFamily ? `has-family:${familyName}` : 'no-family'}</div>
      <div data-testid="invite-code">{inviteCode}</div>
      <div data-testid="error">{error}</div>
      <button onClick={tryIt(() => signUp('vivek@example.com', 'password123', 'Vivek'))}>sign up as vivek</button>
      <button onClick={tryIt(() => signUp('partner@example.com', 'password123', 'Partner'))}>sign up as partner</button>
      <button onClick={tryIt(() => signOut())}>sign out</button>
      <button onClick={tryIt(() => createFamily('The Testers'))}>create family</button>
      <input aria-label="join code" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} />
      <button onClick={tryIt(() => joinFamily(joinCodeInput))}>join family</button>
    </div>
  )
}

function renderProbe() {
  return render(<AuthProvider><FamilyProvider><Probe /></FamilyProvider></AuthProvider>)
}

describe('FamilyContext', () => {
  test('a signed-out user has no family', async () => {
    renderProbe()
    expect(await screen.findByTestId('family-status')).toHaveTextContent('no-family')
  })

  test('a freshly signed-up user has no family until they create or join one', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('family-status')
    await user.click(screen.getByText('sign up as vivek'))
    expect(await screen.findByTestId('family-status')).toHaveTextContent('no-family')
  })

  test('createFamily generates a 6-character invite code and marks hasFamily true', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('family-status')
    await user.click(screen.getByText('sign up as vivek'))
    await user.click(screen.getByText('create family'))

    expect(await screen.findByTestId('family-status')).toHaveTextContent('has-family:The Testers')
    expect(screen.getByTestId('invite-code').textContent).toHaveLength(6)
  })

  test('a second user can join the family using the invite code', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('family-status')

    await user.click(screen.getByText('sign up as vivek'))
    await user.click(screen.getByText('create family'))
    await screen.findByText('has-family:The Testers')
    const code = screen.getByTestId('invite-code').textContent

    await user.click(screen.getByText('sign out'))
    await screen.findByText('no-family')

    await user.click(screen.getByText('sign up as partner'))
    await screen.findByText('no-family')
    await user.type(screen.getByLabelText('join code'), code)
    await user.click(screen.getByText('join family'))

    expect(await screen.findByTestId('family-status')).toHaveTextContent('has-family:The Testers')
  })

  test('joining with an invalid code shows an error and does not create a family', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('family-status')
    await user.click(screen.getByText('sign up as vivek'))
    await screen.findByText('no-family')

    await user.type(screen.getByLabelText('join code'), 'ZZZZZZ')
    await user.click(screen.getByText('join family'))

    expect(await screen.findByTestId('error')).toHaveTextContent("doesn't match any family")
    expect(screen.getByTestId('family-status')).toHaveTextContent('no-family')
  })
})
