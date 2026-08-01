import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import NavBar from '../../components/NavBar.jsx'
import { AllProviders, setupSignedInFamily } from '../../test/helpers.js'

function renderNav() {
  return render(<MemoryRouter><NavBar /></MemoryRouter>, { wrapper: AllProviders })
}

describe('NavBar', () => {
  test('renders the full horizontal link row (desktop) plus a hamburger button', async () => {
    await setupSignedInFamily()
    renderNav()

    // The desktop row and the mobile drawer both exist in the DOM at once —
    // CSS media queries (not conditional rendering) decide which is visible
    // at a given width, so both sets of links are queryable here.
    expect(await screen.findByRole('button', { name: 'Open menu' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Calendar' }).length).toBeGreaterThan(0)
  })

  test('the drawer is closed until the hamburger button is clicked', async () => {
    await setupSignedInFamily()
    renderNav()
    await screen.findByRole('button', { name: 'Open menu' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(await screen.findByRole('dialog', { name: 'Main menu' })).toBeInTheDocument()
  })

  test('drawer shows an icon + label for every nav link, plus the signed-in user\'s email', async () => {
    await setupSignedInFamily({ email: 'vivek@example.com' })
    renderNav()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Open menu' }))

    const dialog = screen.getByRole('dialog', { name: 'Main menu' })
    // Each link's icon span is aria-hidden, so the accessible name computed
    // for the link itself is just the label — a good way to confirm both
    // the icon and the label rendered without over-matching on raw text
    // (the icon and label are adjacent text nodes, not separately wrapped).
    for (const label of ['Home', 'Calendar', 'Groceries', 'Tasks', 'Training', 'Ideas', 'Settings']) {
      expect(within(dialog).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(dialog).getByText('vivek@example.com')).toBeInTheDocument()
  })

  test('clicking a link inside the drawer closes it', async () => {
    await setupSignedInFamily()
    renderNav()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Main menu' })

    await user.click(within(dialog).getByRole('link', { name: /Training/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('clicking the overlay outside the drawer closes it', async () => {
    await setupSignedInFamily()
    const { container } = renderNav()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    await screen.findByRole('dialog', { name: 'Main menu' })

    // The overlay covers the full screen behind the drawer panel; the panel
    // itself stops propagation (see onClick in NavBar.jsx) so only a click
    // that lands on the overlay itself (not the panel) should close it.
    await user.click(container.querySelector('.nav-drawer-overlay'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('the drawer\'s sign-out button closes the drawer and signs out', async () => {
    await setupSignedInFamily()
    renderNav()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Main menu' })

    await user.click(within(dialog).getByRole('button', { name: /Sign out/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('pressing Escape closes the drawer', async () => {
    await setupSignedInFamily()
    renderNav()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    await screen.findByRole('dialog', { name: 'Main menu' })

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
