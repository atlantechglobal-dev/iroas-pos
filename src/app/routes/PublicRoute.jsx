import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import { isAdmin } from '../../constants/roles.js'

export function PublicRoute({ children }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (isAuthenticated) {
    if (isAdmin(user)) {
      return <Navigate to={ROUTES.PLATFORM_ADMIN} replace />
    }
    // After signup, CreateAccount sets the session while still on this route —
    // send new owners into the restaurant setup wizard.
    if (location.pathname === ROUTES.CREATE_ACCOUNT) {
      return <Navigate to={ROUTES.RESTAURANT_SETUP} replace />
    }
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return children
}
