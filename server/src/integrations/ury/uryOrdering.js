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
  const open = (Array.isArray(opening?.message) ? opening.message : []).some((e) => e.pos_profile === profileName)
  if (!open) {
    throw new OrderingError('pos_closed', 'The POS shift is not open. Open the POS in URY first.', { status: 409 })
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
  const items = (await getMenuItems(tenant.client, ctx.profileName, table)).map((it) => ({
    code: it.item,
    name: it.item_name || it.item,
    rate: typeof it.rate === 'number' ? it.rate : null,
    course: it.course_label || it.course || '',
    available: it.disabled !== 1,
    special: it.special_dish === 1,
    image: it.item_image || null,
  }))
  return {
    table: { name: table.name, room: table.restaurant_room || '', seats: table.no_of_seats || null, occupied: table.occupied === 1 },
    orderType: orderTypeFor(table),
    items,
  }
}

/** Finds a URY customer by exact mobile number, or creates one. Customers are global in URY. */
export async function findOrCreateUryCustomer({ client }, { name, phone }) {
  const { getList } = client
  const mobile = normalizePhone(phone)
  const customerName = clean(name, 140)
  if (mobile.replace(/\D/g, '').length < 7) throw new OrderingError('invalid_phone', 'Enter a valid phone number.')

  const existing = await getList('Customer', {
    fields: ['name', 'customer_name', 'mobile_number', 'disabled'],
    filters: { mobile_number: mobile },
    limit: 1,
  })
  if (existing[0] && existing[0].disabled !== 1) {
    const c = existing[0]
    return { id: c.name, name: c.customer_name || c.name, phone: c.mobile_number || mobile, created: false }
  }

  if (!customerName) throw new OrderingError('invalid_name', 'Enter the guest’s name.')
  let body
  try {
    body = await client.post('ury.ury_pos.api.create_customer', { customer_name: customerName, mobile_number: mobile })
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

  const menu = new Map((await getMenuItems(client, ctx.profileName, table)).map((it) => [it.item, it]))
  const items = []
  for (const line of lines) {
    const code = clean(line?.item ?? line?.code, 140)
    const qty = Math.trunc(Number(line?.qty))
    const menuItem = menu.get(code)
    if (!menuItem || menuItem.disabled === 1) throw new OrderingError('item_unavailable', `Item unavailable: ${code || 'unknown'}.`)
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
