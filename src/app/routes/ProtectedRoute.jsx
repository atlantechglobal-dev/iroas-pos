import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import {
  canAccessOnboarding,
  canUseDashboard,
  isPendingApproval,
  ownerHomePath,
} from '../../constants/restaurantStatus.js'

export function ProtectedRoute({
  adminOnly = false,
  requireLive = false,
  onboardingOnly = false,
  allowPending = false,
  children,
}) {
  const {
    isAuthenticated,
    isAdmin,
    restaurantStatus,
    awaitingAccountApproval,
    onboardingPaid,
    initializing,
  } = useAuth()
  const location = useLocation()
  const awaiting = Boolean(awaitingAccountApproval)
  const paid = Boolean(onboardingPaid)
  const home = ownerHomePath(restaurantStatus, {
    awaitingAccountApproval: awaiting,
    onboardingPaid: paid,
  })

  if (initializing) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="app-loading-spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />
  }

  if (isAdmin) {
    return children
  }

  // Signup still waiting for first admin approval
  if (awaiting) {
    return <Navigate to={ROUTES.ACCOUNT_THANKS} replace />
  }

  // Avoid a wrong-page flash while owner status is still unknown
  if (restaurantStatus == null && (requireLive || onboardingOnly)) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="app-loading-spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    )
  }

  if (requireLive) {
    if (restaurantStatus && !canUseDashboard(restaurantStatus) && !paid) {
      return <Navigate to={home} replace />
    }
    return children
  }

  if (onboardingOnly) {
    if (restaurantStatus && (canUseDashboard(restaurantStatus) || paid)) {
      return <Navigate to={ROUTES.DASHBOARD} replace />
    }
    if (
      restaurantStatus &&
      !canAccessOnboarding(restaurantStatus, { awaitingAccountApproval: awaiting })
    ) {
      return <Navigate to={home} replace />
    }
    if (restaurantStatus && isPendingApproval(restaurantStatus) && !allowPending) {
      return <Navigate to={ROUTES.ONBOARDING_PAYMENT} replace />
    }
    return children
  }

  return children
}
