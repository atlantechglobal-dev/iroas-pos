// Contact details READ from URY: the URY Restaurant's own `address` link
// (Link -> Address) and that Address's phone / email_id / address lines.
// URY Restaurant has no phone or email field of its own. Nothing is
// substituted when the link is missing; the site shows a configuration warning.

import { UryError } from './uryClient.js'

const CACHE_TTL_MS = 15 * 60_000
const STALE_LIMIT_MS = 24 * 60 * 60_000
const cache = new Map()

export function mapAddress(doc) {
  const lines = [doc.address_line1, doc.address_line2].filter(Boolean)
  return {
    phone: doc.phone || '',
    email: doc.email_id || '',
    address: lines.join(', '),
    city: doc.city || '',
    state: doc.state || '',
    pincode: doc.pincode || '',
    country: doc.country || '',
  }
}

async function load({ client, uryRestaurant }) {
  const restaurant = (await client.getDoc('URY Restaurant', uryRestaurant)).docs[0]
  if (!restaurant.address) {
    return { status: 'not_configured', message: 'No address is linked to this restaurant in the POS yet.' }
  }
  let doc
  try {
    doc = (await client.getDoc('Address', restaurant.address)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') {
      return { status: 'not_configured', message: 'The address linked in the POS no longer exists.' }
    }
    throw err
  }
  if (doc.name !== restaurant.address || doc.disabled === 1) {
    return { status: 'not_configured', message: 'The address linked in the POS is disabled.' }
  }
  const contact = mapAddress(doc)
  return {
    status: 'ok',
    ...contact,
    message: contact.phone || contact.email ? null : 'The POS address has no phone number or email.',
  }
}

export async function getUryContact(tenant) {
  const key = `${tenant.restaurantId}\u0000${tenant.uryRestaurant}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data
  try {
    const data = { ...(await load(tenant)), fetchedAt: new Date().toISOString(), stale: false }
    cache.set(key, { data, at: Date.now() })
    return data
  } catch (err) {
    if (err instanceof UryError && hit && Date.now() - hit.at < STALE_LIMIT_MS) {
      return { ...hit.data, stale: true }
    }
    throw err
  }
}

export function clearUryContactCache() {
  cache.clear()
}
