// QR codes for URY tables. The code is `u.<table, base64url>.<signature>`, signed
// with a server secret per restaurant, so a guest can only order for the table
// whose QR they scanned. The URY ordering token for that table is fetched
// server-side (self_ordering.generate_qr_token) and never sent to the browser.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getEnv } from '../../config/env.js'
import { UryError } from './uryClient.js'
import { listUryTables } from './uryTables.js'

const PREFIX = 'u.'

function secret() {
  const value = getEnv('URY_TABLE_QR_SECRET') || getEnv('JWT_SECRET')
  if (!value) throw new Error('URY_TABLE_QR_SECRET or JWT_SECRET must be set.')
  return value
}

function sign(restaurantId, table) {
  return createHmac('sha256', secret())
    .update(`ury-table-qr\u0000${restaurantId}\u0000${table}`)
    .digest('base64url')
    .slice(0, 22)
}

export function isUryTableCode(code) {
  return String(code || '').startsWith(PREFIX)
}

export function signTableCode(restaurantId, table) {
  return `${PREFIX}${Buffer.from(String(table), 'utf8').toString('base64url')}.${sign(restaurantId, table)}`
}

/** Returns the URY table name if the code was signed for this restaurant, else null. */
export function verifyTableCode(restaurantId, code) {
  const match = /^u\.([A-Za-z0-9_-]{1,200})\.([A-Za-z0-9_-]{22})$/.exec(String(code || ''))
  if (!match) return null
  const table = Buffer.from(match[1], 'base64url').toString('utf8')
  if (!table || table.length > 140) return null
  const expected = Buffer.from(sign(restaurantId, table))
  const given = Buffer.from(match[2])
  return expected.length === given.length && timingSafeEqual(expected, given) ? table : null
}

/** Verifies a scanned code and re-reads the table from URY. Returns null if invalid or not this restaurant's. */
export async function resolveUryTableCode(tenant, code) {
  const name = verifyTableCode(tenant.restaurantId, code)
  if (!name) return null
  let table
  try {
    table = (await tenant.client.getDoc('URY Table', name)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') return null
    throw err
  }
  if (table.restaurant !== tenant.uryRestaurant || table.is_take_away === 1) return null
  return {
    name: table.name,
    room: table.restaurant_room || '',
    seats: table.no_of_seats > 0 ? table.no_of_seats : null,
    occupied: table.occupied === 1,
  }
}

/** URY tables of the tenant with their signed QR codes (staff view). Take-away tables are excluded. */
export async function listUryTableQrCodes(tenant) {
  const tables = await listUryTables(tenant)
  return tables
    .filter((t) => !t.takeAway)
    .map((t) => ({ ...t, code: signTableCode(tenant.restaurantId, t.name) }))
}
