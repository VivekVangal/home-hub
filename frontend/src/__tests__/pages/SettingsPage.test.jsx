import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { doc, setDoc } from 'firebase/firestore'
import SettingsPage from '../../pages/SettingsPage.jsx'
import { db } from '../../firebase.js'
import { setCallableHandler } from '../../test/mocks/functionsMock.js'
import { AllProviders, setupSignedInFamily, seedMember } from '../../test/helpers.js'

// SettingsPage reads useAuth()/useFamily(), so it needs to render inside a
// signed-in, family-having context — setupSignedInFamily() seeds that state
// directly (same shape FamilyContext.createFamily produces) before each
// render. It also uses useNavigate() (to clean up the ?code=... query param
// after a Google OAuth redirect), which needs a Router context.

function renderSettings() {
  return render(<MemoryRouter><SettingsPage /></MemoryRouter>, { wrapper: AllProviders })
}

describe('SettingsPage', () => {
  test('shows the family invite code', async () => {
    await setupSignedInFamily({ inviteCode: 'ABC123' })
    renderSettings()
    expect(await screen.findByText('ABC123')).toBeInTheDocument()
  })

  test('"Send by email" opens a mailto link containing the invite code', async () => {
    await setupSignedInFamily({ inviteCode: 'ABC123' })
    renderSettings()
    await screen.findByText('ABC123')

    // jsdom's window.location.href is a non-configurable accessor, so
    // redefining just the `href` property throws "Cannot redefine
    // property". Swapping out window.location itself (a plain, writable
    // property on window) for a plain object is the standard workaround.
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: '' },
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Send by email' }))

    expect(window.location.href).toMatch(/^mailto:\?subject=/)
    expect(decodeURIComponent(window.location.href)).toContain('ABC123')

    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation })
  })

  test('shows family members, marking the signed-in user as "you"', async () => {
    const { user, familyId } = await setupSignedInFamily({
      members: [{ id: 'other-person', name: 'Partner', color: '#ec4899' }],
    })
    // The signed-in user's own member doc must use their real uid to be
    // recognized as "self" — setupSignedInFamily's `members` option can't
    // know that uid ahead of time, so add it separately.
    await seedMember(familyId, user.uid, { name: 'Vivek', color: '#3b82f6', role: 'owner' })

    renderSettings()
    expect(await screen.findByText('Partner')).toBeInTheDocument()
    expect(await screen.findByText('Vivek (you)')).toBeInTheDocument()
  })

  test('renaming a family member updates the list', async () => {
    await setupSignedInFamily()
    renderSettings()
    await screen.findByText('Person 1')

    const user = userEvent.setup()
    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    const input = screen.getByDisplayValue('Person 1')
    await user.clear(input)
    await user.type(input, 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Renamed')).toBeInTheDocument()
    expect(screen.queryByText('Person 1')).not.toBeInTheDocument()
  })

  test('cannot remove yourself, but can remove another member', async () => {
    const { user, familyId } = await setupSignedInFamily({
      members: [{ id: 'someone-else-uid', name: 'Person 1', color: '#3b82f6' }],
    })
    await seedMember(familyId, user.uid, { name: 'You', color: '#ec4899', role: 'owner' })

    renderSettings()
    await screen.findByText('You (you)')
    await screen.findByText('Person 1')

    // Only one remove (✕) button should exist — for "Person 1", not for self.
    const removeButtons = screen.getAllByRole('button', { name: '✕' })
    expect(removeButtons).toHaveLength(1)

    const clicker = userEvent.setup()
    await clicker.click(removeButtons[0])
    await clicker.click(await screen.findByRole('button', { name: 'Confirm' }))

    expect(screen.queryByText('Person 1')).not.toBeInTheDocument()
    expect(screen.getByText('You (you)')).toBeInTheDocument()
  })

  test('shows "Connect Google" before connecting, and "Sync Google" once connected', async () => {
    const { user: authUser, familyId } = await setupSignedInFamily()
    renderSettings()

    const connectLink = await screen.findByRole('link', { name: 'Connect Google' })
    expect(connectLink.getAttribute('href')).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/)

    await setDoc(doc(db, 'families', familyId, 'googleSync', authUser.uid), { connected: true })
    expect(await screen.findByRole('button', { name: 'Sync Google' })).toBeInTheDocument()
  })

  test('"Sync Google" calls the sync function and shows a status message', async () => {
    const { user: authUser, familyId } = await setupSignedInFamily()
    await setDoc(doc(db, 'families', familyId, 'googleSync', authUser.uid), { connected: true })
    renderSettings()
    await screen.findByRole('button', { name: 'Sync Google' })

    setCallableHandler('googleSync', () => ({ eventsImported: 3, tasksImported: 1 }))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sync Google' }))

    expect(await screen.findByText('Imported 3 events, 1 task.')).toBeInTheDocument()
  })
})
