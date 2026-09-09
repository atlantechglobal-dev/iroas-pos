import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import { canUseDashboard, isPendingApproval } from '../../constants/restaurantStatus.js'

export function ProtectedRoute({
  adminOnly = false,
  requireLive = false,
  onboardingOnly = false,
  allowPending = false,
  children,
}) {
  const { isAuthenticated, isAdmin, restaurantStatus } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />
  }

  if (requireLive && !adminOnly && restaurantStatus && !canUseDashboard(restaurantStatus)) {
    return <Navigate to={ROUTES.RESTAURANT_SETUP} replace />
  }

  if (onboardingOnly && !adminOnly && restaurantStatus && canUseDashboard(restaurantStatus)) {
    if (!(allowPending && isPendingApproval(restaurantStatus))) {
      return <Navigate to={ROUTES.DASHBOARD} replace />
    }
  }

  return children
}
