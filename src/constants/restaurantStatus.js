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

export function canUseDashboard(status) {
  return status === RESTAURANT_STATUS.LIVE || status === RESTAURANT_STATUS.PENDING_APPROVAL
}
