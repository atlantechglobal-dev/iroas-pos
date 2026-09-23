import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/shared/hooks/useAuth'
import { ROUTES } from '@/shared/constants/routes'
import { isRestaurantCategory, normalizeBusinessCategory } from '@/shared/constants/businessCategory'
import {
  canAccessOnboarding,
  canUseDashboard,
  isPendingApproval,
  ownerHomePath,
  ownerLiveHomePath,
} from '@/shared/constants/restaurantStatus'

export function ProtectedRoute({
  adminOnly = false,
  requireLive = false,
  onboardingOnly = false,
  allowPending = false,
  restaurantOnly = false,
  children,
}) {
  const {
    isAuthenticated,
    isAdmin,
    restaurantStatus,
    awaitingAccountApproval,
    onboardingPaid,
    businessCategory,
    initializing,
  } = useAuth()
  const location = useLocation()
  const awaiting = Boolean(awaitingAccountApproval)
  const paid = Boolean(onboardingPaid)
  const categoryOpts = { businessCategory }
  const home = ownerHomePath(restaurantStatus, {
    awaitingAccountApproval: awaiting,
    onboardingPaid: paid,
    ...categoryOpts,
  })
  const liveHome = ownerLiveHomePath(businessCategory)
  const cat = normalizeBusinessCategory(businessCategory)
  const isRestaurant = !cat || isRestaurantCategory(cat)

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

  if (awaiting) {
    return <Navigate to={ROUTES.ACCOUNT_THANKS} replace />
  }

  if (restaurantStatus == null && (requireLive || onboardingOnly || restaurantOnly)) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="app-loading-spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    )
  }

  // Only the Dashboard page is Restaurant-exclusive.
  if (restaurantOnly && !isRestaurant) {
    return <Navigate to={liveHome} replace />
  }

  if (requireLive) {
    const allowed =
      restaurantStatus === 'live' ||
      paid ||
      canUseDashboard(restaurantStatus, categoryOpts)
    if (restaurantStatus && !allowed) {
      return <Navigate to={home} replace />
    }
    return children
  }

  if (onboardingOnly) {
    if (restaurantStatus && (restaurantStatus === 'live' || paid)) {
      return <Navigate to={liveHome} replace />
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
