import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const links = [
  { to: '/', label: 'Home', end: true, icon: '🏠' },
  { to: '/calendar', label: 'Calendar', icon: '📅' },
  { to: '/groceries', label: 'Groceries', icon: '🛒' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/training', label: 'Training', icon: '🏃' },
  { to: '/ideas', label: 'Ideas', icon: '💡' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

// Desktop keeps the original horizontal link row. Below the existing 720px
// breakpoint (see index.css), that row and the inline user info/sign-out
// hide in favor of a hamburger button that opens a left slide-in drawer —
// the same links plus icons, the signed-in user's name/email, and sign out,
// all with room to breathe instead of being squeezed into a top bar.
export default function NavBar() {
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  return (
    <>
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-icon navbar-hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <NavLink to="/" className="navbar-brand">🏠 Home Hub</NavLink>
        </div>
        <nav className="navbar-links">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.displayName && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user.displayName}</span>
          )}
          <button className="btn btn-icon" onClick={signOut} title="Sign out">⏻</button>
        </div>
      </header>

      {drawerOpen && (
        <div className="nav-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <nav
            className="nav-drawer"
            aria-label="Main menu"
            aria-modal="true"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nav-drawer-header">
              <span className="navbar-brand">🏠 Home Hub</span>
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {user && (
              <div className="nav-drawer-user">
                <div className="nav-drawer-user-name">{user.displayName || 'Signed in'}</div>
                {user.email && <div className="nav-drawer-user-email">{user.email}</div>}
              </div>
            )}

            <div className="nav-drawer-links">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => 'nav-drawer-link' + (isActive ? ' active' : '')}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="nav-drawer-link-icon" aria-hidden="true">{l.icon}</span>
                  {l.label}
                </NavLink>
              ))}
            </div>

            <button
              type="button"
              className="btn nav-drawer-signout"
              onClick={() => {
                setDrawerOpen(false)
                signOut()
              }}
            >
              <span aria-hidden="true">⏻</span> Sign out
            </button>
          </nav>
        </div>
      )}
    </>
  )
}
