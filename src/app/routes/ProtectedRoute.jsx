import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'

export function ProtectedRoute({ adminOnly = false, requireLive = false, children }) {
  const { isAuthenticated, isAdmin, restaurantStatus } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />
  }

  // Dashboard-tier pages assume a fully launched restaurant (subdomain, brand,
  // etc). Resume the onboarding wizard instead of showing a half-configured
  // dashboard. `restaurantStatus` is null only while it hasn't loaded yet —
  // don't bounce on that transient state.
  if (requireLive && !adminOnly && restaurantStatus && restaurantStatus !== 'live') {
    return <Navigate to={ROUTES.RESTAURANT_SETUP} replace />
  }

  return children
}
