/** Canonical restaurant category label (signup / settings). */
export const RESTAURANT_CATEGORY = 'Restaurant'

export function normalizeBusinessCategory(category) {
  return String(category || '').trim()
}

/** Only Restaurant tenants get the POS / operations dashboard. */
export function isRestaurantCategory(category) {
  return normalizeBusinessCategory(category).toLowerCase() === 'restaurant'
}

export function businessCategoryFromSettings(settings = {}) {
  return normalizeBusinessCategory(settings.businessCategory || settings.category)
}

export function businessCategoryFromRestaurant(restaurant) {
  return businessCategoryFromSettings(restaurant?.settings || {})
}
