// Contact details READ from URY: the URY Restaurant's own `address` link
// (Link -> Address) and that Address's phone / email_id / address lines.
// URY Restaurant has no phone or email field of its own. Nothing is
// substituted when the link is missing; the site shows a configuration warning.

import { UryError } from './uryClient.js'
import { PosEditError, rejectedByPos } from './uryEdit.js'

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

const PHONE_RE = /^[0-9+()\-\s.]{5,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_COUNTRY = 'South Africa'

async function resolveCountry(client, requested) {
  const wanted = String(requested || '').trim() || DEFAULT_COUNTRY
  const rows = await client.getList('Country', { fields: ['name'], limit: 400 })
  const hit = rows.find((row) => row.name.toLowerCase() === wanted.toLowerCase())
  if (!hit) throw new PosEditError('invalid_country', `"${wanted}" is not a country the POS knows.`)
  return hit.name
}

// An Address linked to anything other than this restaurant is never edited; a new one is created.
export async function pushUryContact(tenant, input = {}) {
  const phone = String(input.phone || '').trim()
  const email = String(input.email || '').trim()
  const line1 = String(input.address || '').trim().slice(0, 140)
  const city = String(input.city || '').trim().slice(0, 140)
  if (!line1 || !city) {
    throw new PosEditError('incomplete_address', 'Add a street address and city to update the POS contact details.')
  }
  if (phone && !PHONE_RE.test(phone)) throw new PosEditError('invalid_phone', 'Enter a valid phone number.')
  if (email && !EMAIL_RE.test(email)) throw new PosEditError('invalid_email', 'Enter a valid email address.')

  const { client, uryRestaurant } = tenant
  const country = await resolveCountry(client, input.country)
  const wanted = { address_line1: line1, city, country, phone, email_id: email }

  const restaurant = (await client.getDoc('URY Restaurant', uryRestaurant)).docs[0]
  let doc = null
  if (restaurant.address) {
    try {
      doc = (await client.getDoc('Address', restaurant.address)).docs[0]
    } catch (err) {
      if (!(err instanceof UryError && err.code === 'not_found')) throw err
    }
    const ownsIt = (doc?.links || []).some((l) => l.link_doctype === 'URY Restaurant' && l.link_name === uryRestaurant)
    if (doc && !ownsIt) doc = null
  }

  try {
    if (doc) {
      const same = Object.entries(wanted).every(([k, v]) => String(doc[k] || '') === v)
      if (same && doc.disabled !== 1) return { changed: false }
      await client.post('frappe.client.save', { doc: { ...doc, ...wanted, disabled: 0 } })
    } else {
      const created = await client.post('frappe.client.insert', {
        doc: {
          doctype: 'Address',
          address_title: uryRestaurant,
          address_type: 'Office',
          ...wanted,
          links: [{ link_doctype: 'URY Restaurant', link_name: uryRestaurant }],
        },
      })
      const name = created?.message?.name
      if (!name) throw new UryError('upstream_error', 'POS did not return the new address.')
      await client.post('frappe.client.set_value', {
        doctype: 'URY Restaurant',
        name: uryRestaurant,
        fieldname: 'address',
        value: name,
      })
    }
  } catch (err) {
    throw rejectedByPos(err)
  }
  clearUryContactCache()
  return { changed: true }
}
