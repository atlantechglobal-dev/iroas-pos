import { db } from '../infra/db.js'
import { parseHoursJson } from './reservationAvailability.js'
import { resolveUryTenant } from '../integrations/ury/uryTenant.js'
import { getUryMenu } from '../integrations/ury/uryMenu.js'

function parseSettings(row) {
  try {
    return row?.settings_json ? JSON.parse(row.settings_json) : {}
  } catch {
    return {}
  }
}

function hasOpenDay(raw) {
  const hours = parseHoursJson(raw)
  return Boolean(hours?.some((d) => d && !d.closed && String(d.open || '').trim() && String(d.close || '').trim()))
}

/**
 * Setup steps for one restaurant, derived from its own data (never stored, so it cannot go stale).
 * `posMenuCount` is optional: pass the POS menu size when it is known; without it a POS-linked
 * restaurant with the menu feature on counts as having a menu.
 */
export function getOnboardingProgress(restaurantId, { posMenuCount = null } = {}) {
  const r = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(restaurantId)
  if (!r) return null
  const settings = parseSettings(r)
  const integration = db
    .prepare(`SELECT status, verified_at, feature_menu FROM restaurant_integrations WHERE restaurant_id = ? AND provider = 'ury'`)
    .get(restaurantId)
  const posLinked = Boolean(integration && integration.status === 'active' && integration.verified_at)
  const localMenu = db.prepare('SELECT COUNT(*) AS n FROM menu_items WHERE restaurant_id = ?').get(restaurantId).n
  const tables = db.prepare('SELECT COUNT(*) AS n FROM dining_tables WHERE restaurant_id = ? AND active = 1').get(restaurantId).n

  const missingProfile = [
    !r.name && 'name',
    !r.phone && 'phone',
    !r.address && 'address',
    !r.city && 'city',
    !hasOpenDay(r.operating_hours) && 'opening hours',
  ].filter(Boolean)

  const menuCount = posLinked && posMenuCount != null ? posMenuCount : localMenu
  const menuDone = menuCount > 0 || (posLinked && posMenuCount == null && integration.feature_menu === 1)

  const steps = [
    {
      key: 'profile',
      label: 'Restaurant profile',
      done: missingProfile.length === 0,
      detail: missingProfile.length ? `Add ${missingProfile.join(', ')}.` : 'Name, contact, address and opening hours are set.',
      path: '/restaurant-profile',
    },
    {
      key: 'brand',
      label: 'Logo and brand',
      done: Boolean(r.logo_data_url),
      detail: r.logo_data_url ? 'Logo uploaded.' : 'Upload your logo.',
      path: '/brand',
    },
    {
      key: 'menu',
      label: 'Menu',
      done: menuDone,
      detail: menuDone ? (menuCount > 0 ? `${menuCount} menu ${menuCount === 1 ? 'item' : 'items'}.` : 'Menu is managed in your POS.') : 'Add your first menu item.',
      path: '/menu',
    },
    {
      key: 'tables',
      label: 'Tables',
      done: tables > 0,
      detail: tables > 0 ? `${tables} ${tables === 1 ? 'table' : 'tables'}.` : 'Add your tables so guests can book and order.',
      path: '/reservations',
    },
    {
      key: 'pos',
      label: 'POS connected',
      done: posLinked,
      detail: posLinked ? 'POS is linked and verified.' : 'IROAS support connects your POS after approval.',
      path: '/pos-integration',
    },
    {
      key: 'domain',
      label: 'Website address',
      done: Boolean(r.subdomain || r.custom_domain),
      detail: r.custom_domain || r.subdomain ? `Your site is set up at ${r.custom_domain || r.subdomain}.` : 'Choose your website address.',
      path: '/domain',
    },
    {
      key: 'payment',
      label: 'Onboarding payment',
      done: Boolean(settings?.onboardingPayment?.paid),
      detail: settings?.onboardingPayment?.paid ? 'Payment received.' : 'Pay your onboarding plan to go live.',
      path: '/settings',
    },
    {
      key: 'live',
      label: 'Approved and live',
      done: r.status === 'live',
      detail: r.status === 'live' ? 'Your restaurant is live.' : r.status === 'pending_approval' ? 'Waiting for IROAS approval.' : 'Finish the steps above, then submit for approval.',
      path: null,
    },
  ]
  const done = steps.filter((s) => s.done).length
  return { restaurantId, steps, done, total: steps.length, complete: done === steps.length, nextStep: steps.find((s) => !s.done)?.key || null }
}

/** Same as getOnboardingProgress, but counts the real POS menu when the restaurant is linked (best effort). */
export async function loadOnboardingProgress(restaurantId) {
  const quick = getOnboardingProgress(restaurantId)
  if (!quick) return null
  if (!quick.steps.find((s) => s.key === 'pos')?.done) return quick
  try {
    const tenant = await resolveUryTenant(restaurantId)
    const menu = await getUryMenu(tenant)
    const count = (menu?.categories || []).reduce((sum, c) => sum + (c.items?.length || 0), 0)
    return getOnboardingProgress(restaurantId, { posMenuCount: count })
  } catch {
    return quick
  }
}
