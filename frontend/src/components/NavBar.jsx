import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/groceries', label: 'Groceries' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/training', label: 'Training' },
  { to: '/settings', label: 'Settings' },
]

export default function NavBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="navbar">
      <NavLink to="/" className="navbar-brand">🏠 Home Hub</NavLink>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user?.displayName && (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user.displayName}</span>
        )}
        <button className="btn btn-icon" onClick={signOut} title="Sign out">⏻</button>
      </div>
    </header>
  )
}
