import { ROUTES } from './routes.js'

export const RESTAURANT_STATUS = {
  ONBOARDING: 'onboarding',
  PENDING_APPROVAL: 'pending_approval',
  LIVE: 'live',
  REJECTED: 'rejected',
  DELETED: 'deleted',
}

export function isRestaurantLive(status) {
  return status === RESTAURANT_STATUS.LIVE
}

export function isPendingApproval(status) {
  return status === RESTAURANT_STATUS.PENDING_APPROVAL
}

export function isRejected(status) {
  return status === RESTAURANT_STATUS.REJECTED
}

export function isOnboarding(status) {
  return status === RESTAURANT_STATUS.ONBOARDING
}

/** Dashboard — after payment completes (status live). */
export function canUseDashboard(status) {
  return status === RESTAURANT_STATUS.LIVE
}

/**
 * Setup wizard + payment pages.
 * New signups still awaiting admin approval cannot enter onboarding.
 */
export function canAccessOnboarding(status, { awaitingAccountApproval = false } = {}) {
  if (awaitingAccountApproval) return false
  if (!status || status === RESTAURANT_STATUS.DELETED) return false
  if (status === RESTAURANT_STATUS.LIVE) return false
  return (
    status === RESTAURANT_STATUS.ONBOARDING ||
    status === RESTAURANT_STATUS.PENDING_APPROVAL ||
    status === RESTAURANT_STATUS.REJECTED
  )
}

/** Where to send an owner after login / when blocked from a route. */
export function ownerHomePath(
  status,
  { awaitingAccountApproval = false, onboardingPaid = false } = {},
) {
  if (awaitingAccountApproval) return ROUTES.ACCOUNT_THANKS
  if (status === RESTAURANT_STATUS.LIVE || onboardingPaid) return ROUTES.DASHBOARD
  if (status === RESTAURANT_STATUS.PENDING_APPROVAL) return ROUTES.ONBOARDING_PAYMENT
  return ROUTES.RESTAURANT_SETUP
}
