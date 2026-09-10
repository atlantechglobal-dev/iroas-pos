import { getBusinessCopy } from '../constants/businessCopy.js'
import { ROUTES } from '../constants/routes.js'

export const WIZARD_PITCH_KEYS = [
  ROUTES.CREATE_ACCOUNT,
  ROUTES.RESTAURANT_SETUP,
  ROUTES.DOMAIN,
  ROUTES.BRAND,
  ROUTES.LAUNCH,
]

/** How many pitch items are complete for this onboarding route (0–4). */
export function pitchDoneCountForPath(pathname) {
  if (pathname === ROUTES.RESTAURANT_SETUP) return 1
  if (pathname === ROUTES.DOMAIN) return 2
  if (pathname === ROUTES.BRAND) return 3
  if (pathname === ROUTES.LAUNCH || pathname === ROUTES.SETUP_REVIEW) return 4
  return 0
}

export function pitchItemsForRestaurant() {
  return getBusinessCopy('Restaurant').signupDeliverables
}

export function pitchDoneFlags(count, length = 4) {
  return Array.from({ length }, (_, index) => index < count)
}
