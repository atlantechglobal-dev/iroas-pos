// Public-website view of a restaurant's URY data, gated by the per-restaurant
// demo switches in restaurant_integrations (feature_hours / feature_contact /
// feature_menu / feature_guest_ordering). When a switch is on, that feature
// comes only from URY: failures are reported, never replaced with local data.

import { UryError } from './uryClient.js'
import { getUryIntegration, IntegrationError, resolveUryTenant } from './uryTenant.js'
import { getUryHours } from './uryHours.js'
import { getUryContact } from './uryContact.js'
import { getUryMenu } from './uryMenu.js'

const BUDGET_MS = 8_000

export function getUryFeatures(restaurantId) {
  const row = getUryIntegration(restaurantId)
  if (!row || row.status !== 'active') return null
  const features = {
    hours: row.feature_hours === 1,
    contact: row.feature_contact === 1,
    menu: row.feature_menu === 1,
    guestOrdering: row.feature_guest_ordering === 1,
  }
  return Object.values(features).some(Boolean) ? features : null
}

function withBudget(promise) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new UryError('timeout', 'URY did not answer in time.')), BUDGET_MS)
    }),
  ])
}

const UNAVAILABLE = { status: 'unavailable', message: 'Live information from the restaurant’s POS is temporarily unavailable.' }

async function section(label, restaurantId, fn) {
  try {
    return await withBudget(fn())
  } catch (err) {
    if (err instanceof UryError || err instanceof IntegrationError) {
      console.warn(`[public-ury] restaurant=${restaurantId} ${label}=${err.code}${err.reason ? ` reason=${err.reason}` : ''}`)
      return UNAVAILABLE
    }
    throw err
  }
}

function menuSection(data) {
  if (data.reason) {
    return {
      status: 'not_configured',
      message: data.reason === 'menu_disabled' ? 'The menu is switched off in the POS.' : 'No active menu is set in the POS.',
      currency: null,
      categories: [],
    }
  }
  return {
    status: 'ok',
    currency: data.currency,
    categories: data.categories,
    fetchedAt: data.fetchedAt,
    message: data.currency ? null : 'The POS price list has no currency set.',
  }
}

/** Returns null when the restaurant has no active URY mapping or no switch is on. */
export async function getUryPublicSite(restaurantId) {
  const features = getUryFeatures(restaurantId)
  if (!features) return null

  let tenant
  try {
    tenant = await withBudget(resolveUryTenant(restaurantId))
  } catch (err) {
    if (!(err instanceof UryError || err instanceof IntegrationError)) throw err
    console.warn(`[public-ury] restaurant=${restaurantId} tenant=${err.code}${err.reason ? ` reason=${err.reason}` : ''}`)
    return {
      features,
      hours: features.hours ? UNAVAILABLE : null,
      contact: features.contact ? UNAVAILABLE : null,
      menu: features.menu ? { ...UNAVAILABLE, currency: null, categories: [] } : null,
      guestOrdering: { enabled: false },
    }
  }

  const [hours, contact, menu] = await Promise.all([
    features.hours ? section('hours', restaurantId, () => getUryHours(tenant)) : null,
    features.contact ? section('contact', restaurantId, () => getUryContact(tenant)) : null,
    features.menu
      ? section('menu', restaurantId, async () => menuSection(await getUryMenu(tenant))).then((m) =>
          m.status === 'unavailable' ? { ...m, currency: null, categories: [] } : m,
        )
      : null,
  ])

  return {
    features,
    hours,
    contact,
    menu,
    guestOrdering: {
      enabled: features.guestOrdering && Boolean(tenant.selfOrderingProfile) && menu?.status === 'ok',
    },
  }
}
