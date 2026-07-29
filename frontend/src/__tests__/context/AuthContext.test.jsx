import { describe, test, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../../context/AuthContext.jsx'

// AuthContext wraps the (mocked) Firebase Auth SDK. This "probe" component
// exercises the hook's public surface exactly the way SignInPage/SignUpPage
// do, so we're testing the real integration rather than the mock in isolation.
function Probe() {
  const { user, loading, signUp, signIn, signInWithGoogle, signOut } = useAuth()
  const [error, setError] = useState('')

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
      <div data-testid="status">{loading ? 'loading' : user ? `signed-in:${user.email}` : 'signed-out'}</div>
      <div data-testid="error">{error}</div>
      <button onClick={tryIt(() => signUp('vivek@example.com', 'password123', 'Vivek'))}>sign up</button>
      <button onClick={tryIt(() => signIn('vivek@example.com', 'password123'))}>sign in</button>
      <button onClick={tryIt(() => signIn('vivek@example.com', 'wrong-password'))}>sign in wrong</button>
      <button onClick={tryIt(() => signInWithGoogle())}>google</button>
      <button onClick={tryIt(() => signOut())}>sign out</button>
    </div>
  )
}

function renderProbe() {
  return render(<AuthProvider><Probe /></AuthProvider>)
}

describe('AuthContext', () => {
  test('resolves to signed-out after the initial check', async () => {
    renderProbe()
    expect(await screen.findByTestId('status')).toHaveTextContent('signed-out')
  })

  test('sign up creates an account and immediately signs the user in', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('status')
    await user.click(screen.getByText('sign up'))
    expect(await screen.findByTestId('status')).toHaveTextContent('signed-in:vivek@example.com')
  })

  test('signing in with the wrong password surfaces an error and stays signed out', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('status')
    await user.click(screen.getByText('sign up'))
    await screen.findByText(/signed-in/)
    await user.click(screen.getByText('sign out'))
    await screen.findByTestId('status')

    await user.click(screen.getByText('sign in wrong'))
    expect(await screen.findByTestId('error')).toHaveTextContent('Incorrect email or password')
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
  })

  test('sign out clears the current user', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('status')
    await user.click(screen.getByText('sign up'))
    await screen.findByText(/signed-in/)

    await user.click(screen.getByText('sign out'))
    expect(await screen.findByTestId('status')).toHaveTextContent('signed-out')
  })

  test('Google sign-in signs the user in', async () => {
    const user = userEvent.setup()
    renderProbe()
    await screen.findByTestId('status')
    await user.click(screen.getByText('google'))
    expect(await screen.findByTestId('status')).toHaveTextContent('signed-in:google-user@example.com')
  })
})
