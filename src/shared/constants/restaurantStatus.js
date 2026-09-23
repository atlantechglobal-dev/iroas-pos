import { ROUTES } from '@/shared/constants/routes'
import { isRestaurantCategory, normalizeBusinessCategory } from '@/shared/constants/businessCategory'

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

/**
 * POS dashboard page — Restaurant category only, after going live.
 * Legacy accounts with no category are treated as Restaurant.
 */
export function canUseDashboard(status, { businessCategory } = {}) {
  if (status !== RESTAURANT_STATUS.LIVE) return false
  const cat = normalizeBusinessCategory(businessCategory)
  if (!cat) return true
  return isRestaurantCategory(cat)
}

/** Post-onboarding home: Restaurant → Dashboard; others → Digital Business Card. */
export function ownerLiveHomePath(businessCategory) {
  const cat = normalizeBusinessCategory(businessCategory)
  if (cat && !isRestaurantCategory(cat)) return ROUTES.DIGITAL_BUSINESS_CARD
  return ROUTES.DASHBOARD
}

/**
 * Setup wizard + payment — same for every business category.
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
  { awaitingAccountApproval = false, onboardingPaid = false, businessCategory } = {},
) {
  if (awaitingAccountApproval) return ROUTES.ACCOUNT_THANKS

  if (status === RESTAURANT_STATUS.LIVE || onboardingPaid) {
    return ownerLiveHomePath(businessCategory)
  }
  if (status === RESTAURANT_STATUS.PENDING_APPROVAL) return ROUTES.ONBOARDING_PAYMENT
  return ROUTES.RESTAURANT_SETUP
}
