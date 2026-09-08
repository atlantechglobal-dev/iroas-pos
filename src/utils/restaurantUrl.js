/**
 * Build the public hostname / URL for a restaurant from API fields.
 * Prefers custom_domain; otherwise subdomain + domain_suffix (default iroas.com).
 */
export function restaurantHostname(restaurant) {
  if (!restaurant) return ''
  if (restaurant.custom_domain) {
    return String(restaurant.custom_domain).replace(/^https?:\/\//i, '').replace(/\/$/, '')
  }
  const slug = restaurant.subdomain?.trim()
  if (!slug) return ''
  const suffix = (restaurant.domain_suffix || 'iroas.com').replace(/^\./, '')
  return `${slug}.${suffix}`
}

export function restaurantLiveUrl(restaurant) {
  const host = restaurantHostname(restaurant)
  return host ? `https://${host}` : ''
}
