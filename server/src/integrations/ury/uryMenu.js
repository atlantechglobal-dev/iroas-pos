// URY Menu READ for a mapped URY Restaurant. Verified chain (docs/URY_MENU_API_DISCOVERY.md):
//   getdoc URY Restaurant <mapped>  -> active_menu, branch, room_wise_menu, order_type_wise_menu
//   getdoc URY Menu <active_menu>   -> branch, enabled, price_list, items[] (URY Menu Item rows)
//   getdoc Price List <price_list>  -> currency
// One getdoc returns every child row, so there is no per-item request and no pagination.

import { UryError } from './uryClient.js'
import { IntegrationError } from './uryTenant.js'

const CACHE_TTL_MS = 60_000
const cache = new Map()

/** Groups URY Menu Item rows by `course`, keeping URY's row order (`idx`). */
export function mapUryMenuToIroasMenu(menuDoc) {
  const rows = [...(menuDoc.items || [])]
    .filter((row) => row.parent === menuDoc.name)
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))

  const categories = []
  const byCourse = new Map()
  for (const row of rows) {
    const courseName = row.course || ''
    if (!byCourse.has(courseName)) {
      const category = { id: courseName || 'uncategorized', name: courseName || 'Uncategorized', items: [] }
      byCourse.set(courseName, category)
      categories.push(category)
    }
    byCourse.get(courseName).items.push({
      id: row.name,
      code: row.item || '',
      name: row.item_name || row.item || '',
      price: typeof row.rate === 'number' ? row.rate : null,
      available: row.disabled !== 1,
      special: row.special_dish === 1,
    })
  }
  return categories
}

async function readCurrency(client, priceList) {
  if (!priceList) return null
  try {
    const body = await client.getDoc('Price List', priceList)
    return body.docs[0].currency || null
  } catch (err) {
    if (err instanceof UryError && (err.code === 'not_found' || err.code === 'forbidden')) return null
    throw err
  }
}

async function loadMenu({ client, uryRestaurant, branch }) {
  let restaurant
  try {
    restaurant = (await client.getDoc('URY Restaurant', uryRestaurant)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') {
      throw new IntegrationError('mapping_invalid', 'Mapped POS restaurant does not exist.', { reason: 'restaurant_not_found' })
    }
    throw err
  }
  if (restaurant.name !== uryRestaurant || restaurant.branch !== branch) {
    throw new IntegrationError('mapping_invalid', 'Mapped POS restaurant does not match.', { reason: 'restaurant_branch_mismatch' })
  }

  const meta = {
    roomWiseMenus: restaurant.room_wise_menu === 1,
    orderTypeMenus: restaurant.order_type_wise_menu === 1,
  }
  if (!restaurant.active_menu) {
    return { menu: null, reason: 'no_active_menu', currency: null, categories: [], meta }
  }

  const menu = (await client.getDoc('URY Menu', restaurant.active_menu)).docs[0]
  if (menu.name !== restaurant.active_menu || menu.branch !== branch) {
    throw new IntegrationError('mapping_invalid', 'Active POS menu does not belong to the mapped restaurant.', { reason: 'menu_branch_mismatch' })
  }
  if (menu.enabled !== 1) {
    return { menu: { name: menu.name }, reason: 'menu_disabled', currency: null, categories: [], meta }
  }

  return {
    menu: { name: menu.name },
    reason: null,
    currency: await readCurrency(client, menu.price_list),
    categories: mapUryMenuToIroasMenu(menu),
    meta,
  }
}

/** Returns the normalized active menu of the verified tenant (see resolveUryTenant). */
export async function getUryMenu(tenant) {
  const key = `${tenant.restaurantId}\u0000${tenant.uryRestaurant}\u0000${tenant.branch}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.data

  const data = { ...(await loadMenu(tenant)), fetchedAt: new Date().toISOString() }
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
  return data
}

export function clearUryMenuCache() {
  cache.clear()
}
