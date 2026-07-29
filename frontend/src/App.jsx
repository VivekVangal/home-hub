import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { useFamily } from './context/FamilyContext.jsx'
import NavBar from './components/NavBar.jsx'
import SignInPage from './pages/auth/SignInPage.jsx'
import SignUpPage from './pages/auth/SignUpPage.jsx'
import FamilySetupPage from './pages/auth/FamilySetupPage.jsx'
import HomePage from './pages/HomePage.jsx'
import CalendarPage from './pages/CalendarPage.jsx'
import GroceryPage from './pages/GroceryPage.jsx'
import TasksPage from './pages/TasksPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

// Three gates, in order: are we signed in? do we have a family? only then
// does the real app render. Each gate owns its own routes so the URL bar
// stays meaningful (e.g. /signup, /signin) without needing route guards
// sprinkled through every page.
export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { hasFamily, loading: familyLoading } = useFamily()

  if (authLoading) {
    return <div className="app-loading">Loading Home Hub…</div>
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    )
  }

  if (familyLoading) {
    return <div className="app-loading">Loading your family…</div>
  }

  if (!hasFamily) {
    return <FamilySetupPage />
  }

  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/groceries" element={<GroceryPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  )
}
