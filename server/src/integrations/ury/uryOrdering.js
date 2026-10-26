// URY order/customer WRITE, using the exact calls the URY POS frontend makes
// (captured from /assets/ury/pos/assets/index-*.js):
//   POST ury.ury.doctype.ury_order.ury_order.sync_order
//        { items:[{item,item_name,rate,qty,comment}], no_of_pax, pos_profile, order_type,
//          table, room, customer, cashier, owner, mode_of_payment, last_invoice, invoice,
//          waiter, comments }   -> message.status === "Failure" on rejection
//   POST ury.ury_pos.api.create_customer { customer_name, mobile_number }
//        -> message { status:"success", name, customer_name, mobile_number, ... }
// Everything except the guest's choices (table, customer, items, pax, note) is
// resolved server-side from the mapped restaurant; client prices are ignored.

import { UryError } from './uryClient.js'
import { IntegrationError } from './uryTenant.js'
import { sellableByCode } from './uryMenu.js'

export class OrderingError extends Error {
  constructor(code, message, { status = 400 } = {}) {
    super(message)
    this.name = 'OrderingError'
    this.code = code
    this.status = status
  }
}

const MAX_LINES = 50
const MAX_QTY = 99
const MAX_PAX = 50

function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function normalizePhone(value) {
  return String(value ?? '').replace(/[^\d+]/g, '').slice(0, 20)
}

/** Open shift, cashier/owner/waiter and payment mode for the tenant's verified POS profile. */
async function getOrderingContext(tenant) {
  const { client, posProfile: profileName, branch, integrationUser: waiter } = tenant

  const [limited, modes] = await Promise.all([
    client.get('ury.ury_pos.api.getPosProfile').then((b) => b?.message || {}),
    client.get('ury.ury_pos.api.getModeOfPayment').then((b) => (Array.isArray(b?.message) ? b.message : [])),
  ])
  if (limited.pos_profile !== profileName || limited.branch !== branch) {
    throw new IntegrationError('mapping_invalid', 'POS profile no longer matches the mapping.', { reason: 'pos_profile_mismatch' })
  }

  const opening = await client.get('erpnext.selling.page.point_of_sale.point_of_sale.check_opening_entry', { user: waiter })
  const ownOpen = (Array.isArray(opening?.message) ? opening.message : []).some((e) => e.pos_profile === profileName)
  const profileOpen = ownOpen
    ? true
    : (
        await client.getList('POS Opening Entry', {
          fields: ['name', 'pos_profile', 'status'],
          filters: [
            ['pos_profile', '=', profileName],
            ['status', '=', 'Open'],
          ],
          limit: 5,
        })
      ).some((row) => row.pos_profile === profileName && row.status === 'Open')
  if (!profileOpen) {
    throw new OrderingError('pos_closed', 'The POS shift is not open. Open the shift in IROAS or URY POS first.', { status: 409 })
  }

  const modeOfPayment = modes[0]?.mode_of_payment
  if (!modeOfPayment) throw new OrderingError('pos_closed', 'No payment mode is configured in the POS.', { status: 409 })

  return { profileName, cashier: limited.cashier, owner: limited.owner, waiter, modeOfPayment }
}

async function getTableForRestaurant({ client, uryRestaurant }, tableName) {
  let table
  try {
    table = (await client.getDoc('URY Table', tableName)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') throw new OrderingError('table_not_found', 'Table not found.')
    throw err
  }
  if (table.restaurant !== uryRestaurant) throw new OrderingError('table_not_found', 'Table not found.')
  return table
}

function orderTypeFor(table) {
  return table.is_take_away === 1 ? 'Take Away' : 'Dine In'
}

async function getMenuItems(client, profileName, table) {
  const body = await client.get('ury.ury_pos.api.getRestaurantMenu', {
    pos_profile: profileName,
    room: table.restaurant_room || '',
    order_type: orderTypeFor(table),
  })
  return Array.isArray(body?.message?.items) ? body.message.items : []
}

/** Orderable items for one table (its room + order type), as the URY POS shows them. */
export async function getUryOrderMenu(tenant, tableName) {
  const ctx = await getOrderingContext(tenant)
  const table = await getTableForRestaurant(tenant, clean(tableName, 140))
  const raw = await getMenuItems(tenant.client, ctx.profileName, table)
  const availability = await sellableByCode(tenant.client, {
    posProfile: ctx.profileName,
    branch: tenant.branch,
    codes: raw.map((it) => it.item),
  })
  const items = raw.map((it) => {
    const avail = availability?.get(it.item)
    return {
      code: it.item,
      name: it.item_name || it.item,
      rate: typeof it.rate === 'number' ? it.rate : null,
      course: it.course_label || it.course || '',
      available: it.disabled !== 1 && (avail ? avail.sellable : true),
      stockQty: avail ? avail.availableQty : null,
      special: it.special_dish === 1,
      image: it.item_image || null,
    }
  })
  return {
    table: { name: table.name, room: table.restaurant_room || '', seats: table.no_of_seats || null, occupied: table.occupied === 1 },
    orderType: orderTypeFor(table),
    items,
  }
}

/** Phone forms URY may already store (desk uses local digits; create_customer often keeps +). */
export function phoneLookupVariants(phone) {
  const mobile = normalizePhone(phone)
  const digits = mobile.replace(/\D/g, '')
  const variants = [mobile, digits]
  if (!digits) return []

  // South Africa: 27… ↔ 0… (local mobiles are 10 digits including leading 0)
  if (digits.startsWith('27') && digits.length >= 11) {
    variants.push(`0${digits.slice(2)}`, `+${digits}`, digits.slice(2))
  }
  if (digits.startsWith('0') && digits.length === 10) {
    variants.push(`+27${digits.slice(1)}`, `27${digits.slice(1)}`)
  }
  // India: 91… ↔ 10-digit mobile (common on this demo)
  if (digits.startsWith('91') && digits.length >= 12) {
    variants.push(digits.slice(2), `+${digits}`)
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    variants.push(`+91${digits}`, `91${digits}`)
  }
  // Desk often stores the national number without country code
  if (digits.length > 10) variants.push(digits.slice(-10))
  if (digits.length > 9) variants.push(digits.slice(-9))

  return [...new Set(variants.filter((v) => String(v || '').replace(/\D/g, '').length >= 7))]
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

/** True when two phone strings refer to the same national number (ignores + / country prefix). */
export function phonesMatch(a, b) {
  const da = phoneDigits(a)
  const db = phoneDigits(b)
  if (!da || !db || da.length < 7 || db.length < 7) return false
  if (da === db) return true
  const variantsA = new Set(phoneLookupVariants(a).map(phoneDigits))
  const variantsB = new Set(phoneLookupVariants(b).map(phoneDigits))
  for (const v of variantsA) {
    if (variantsB.has(v)) return true
  }
  const tail = (d) => (d.length > 9 ? d.slice(-9) : d)
  return tail(da) === tail(db)
}

/** Looks up a URY Customer by phone (exact variants, then trailing-digit match). */
export async function findUryCustomerByPhone({ client }, phone) {
  const mobile = normalizePhone(phone)
  const digits = phoneDigits(mobile)
  if (digits.length < 7) return null

  const variants = phoneLookupVariants(mobile)
  try {
    const existing = await client.getList('Customer', {
      fields: ['name', 'customer_name', 'mobile_number', 'disabled'],
      filters: [['mobile_number', 'in', variants]],
      limit: 20,
    })
    const hit = existing.find((c) => c.disabled !== 1)
    if (hit) {
      return { id: hit.name, name: hit.customer_name || hit.name, phone: hit.mobile_number || mobile, created: false }
    }
  } catch (err) {
    if (!(err instanceof UryError && err.code === 'forbidden')) throw err
  }

  // Desk values with spaces / odd formatting: match on national tail
  const tail = digits.length >= 10 ? digits.slice(-10) : digits
  try {
    const liked = await client.getList('Customer', {
      fields: ['name', 'customer_name', 'mobile_number', 'disabled'],
      filters: [['mobile_number', 'like', `%${tail}%`]],
      limit: 20,
    })
    const match = liked.find((c) => c.disabled !== 1 && phonesMatch(c.mobile_number, mobile))
    if (match) {
      return {
        id: match.name,
        name: match.customer_name || match.name,
        phone: match.mobile_number || mobile,
        created: false,
      }
    }
  } catch (err) {
    if (!(err instanceof UryError && err.code === 'forbidden')) throw err
  }
  return null
}

/** Finds a URY customer by mobile number (common formats), or creates one. Customers are global in URY. */
export async function findOrCreateUryCustomer(tenant, { name, phone }) {
  const mobile = normalizePhone(phone)
  const customerName = clean(name, 140)
  if (mobile.replace(/\D/g, '').length < 7) throw new OrderingError('invalid_phone', 'Enter a valid phone number.')

  const existing = await findUryCustomerByPhone(tenant, mobile)
  if (existing) return existing

  if (!customerName) throw new OrderingError('invalid_name', 'Enter the guest’s name.')
  let body
  try {
    body = await tenant.client.post('ury.ury_pos.api.create_customer', { customer_name: customerName, mobile_number: mobile })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') throw new OrderingError('customer_failed', err.message, { status: 422 })
    throw err
  }
  const msg = body?.message
  if (!msg || msg.status !== 'success' || !msg.name) {
    throw new OrderingError('customer_failed', 'The POS could not create this customer.', { status: 502 })
  }
  return { id: msg.name, name: msg.customer_name || customerName, phone: msg.mobile_number || mobile, created: true }
}

/** Sends a new order for a free table to the URY kitchen (creates the Draft POS Invoice + KOT). */
export async function placeUryOrder(tenant, input = {}) {
  const { client } = tenant
  const tableName = clean(input.table, 140)
  const customerId = clean(input.customer, 140)
  const pax = Math.max(1, Math.min(MAX_PAX, Math.trunc(Number(input.pax) || 1)))
  const comments = clean(input.comments, 300)
  const lines = Array.isArray(input.items) ? input.items.slice(0, MAX_LINES + 1) : []
  if (!tableName) throw new OrderingError('table_required', 'Choose a table.')
  if (!customerId) throw new OrderingError('customer_required', 'Choose a customer.')
  if (!lines.length) throw new OrderingError('items_required', 'Add at least one item.')
  if (lines.length > MAX_LINES) throw new OrderingError('too_many_items', `At most ${MAX_LINES} lines per order.`)

  const ctx = await getOrderingContext(tenant)
  const table = await getTableForRestaurant(tenant, tableName)
  if (table.occupied === 1) {
    throw new OrderingError('table_occupied', `${table.name} already has an open order. Add to it from the POS.`, { status: 409 })
  }

  try {
    await client.getDoc('Customer', customerId)
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') throw new OrderingError('customer_required', 'Customer not found.')
    throw err
  }

  const menuRows = await getMenuItems(client, ctx.profileName, table)
  const menu = new Map(menuRows.map((it) => [it.item, it]))
  const availability = await sellableByCode(client, {
    posProfile: ctx.profileName,
    branch: tenant.branch,
    codes: lines.map((line) => line?.item ?? line?.code),
  })
  const items = []
  for (const line of lines) {
    const code = clean(line?.item ?? line?.code, 140)
    const qty = Math.trunc(Number(line?.qty))
    const menuItem = menu.get(code)
    const avail = availability?.get(code)
    if (!menuItem || menuItem.disabled === 1 || (avail && (!avail.sellable || avail.availableQty < qty))) {
      throw new OrderingError('item_unavailable', `${menuItem?.item_name || code || 'This item'} is not available today.`)
    }
    if (!(qty >= 1 && qty <= MAX_QTY)) throw new OrderingError('invalid_qty', `Quantity must be 1–${MAX_QTY}.`)
    const comment = clean(line?.comment, 140)
    items.push({ item: menuItem.item, item_name: menuItem.item_name, rate: menuItem.rate, qty, ...(comment ? { comment } : {}) })
  }

  const payload = {
    items,
    no_of_pax: pax,
    pos_profile: ctx.profileName,
    order_type: orderTypeFor(table),
    table: table.name,
    ...(table.restaurant_room ? { room: table.restaurant_room } : {}),
    customer: customerId,
    cashier: ctx.cashier,
    owner: ctx.owner,
    mode_of_payment: ctx.modeOfPayment,
    last_invoice: null,
    invoice: null,
    waiter: ctx.waiter,
    ...(comments ? { comments } : {}),
  }

  let body
  try {
    body = await client.post('ury.ury.doctype.ury_order.ury_order.sync_order', payload)
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      if (/opening entry/i.test(err.message) && /outdated|close the pos/i.test(err.message)) {
        throw new OrderingError('pos_shift_outdated', 'Today’s POS shift is not open. Close the previous shift and open a new one in URY POS, then try again.', { status: 409 })
      }
      throw new OrderingError('order_rejected', err.message, { status: 422 })
    }
    throw err
  }
  const msg = body?.message
  if (msg && typeof msg === 'object' && msg.status === 'Failure') {
    throw new OrderingError('order_failed', 'The POS rejected this order. Please try again.', { status: 502 })
  }
  const invoice = typeof msg === 'string' ? msg : msg?.name || msg?.invoice || null
  return { invoice, table: table.name, items: items.length, pax }
}
