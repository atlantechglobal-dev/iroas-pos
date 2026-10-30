// URY order READ. URY POS records every order as a POS Invoice (Draft while the
// table is open, Paid once settled); `restaurant` links it to the URY Restaurant.
//   list:   get_list POS Invoice filtered by restaurant, newest first
//   items:  getdoc POS Invoice <name> -> items[] (POS Invoice Item rows)
// `URY Order` itself cannot be listed (get_list returns 500), so it is not used.

import { UryError } from './uryClient.js'
import { findUryCustomerByPhone, normalizePhone, OrderingError, phonesMatch } from './uryOrdering.js'

const INVOICE_FIELDS = [
  'name',
  'status',
  'docstatus',
  'order_type',
  'restaurant',
  'restaurant_table',
  'customer',
  'customer_name',
  'mobile_number',
  'grand_total',
  'rounded_total',
  'currency',
  'posting_date',
  'posting_time',
  'total_qty',
  'waiter',
  'modified',
]

const LIST_LIMIT = 100
const DETAIL_LIMIT = 30

const PAID_STATUSES = new Set(['Paid', 'Submitted', 'Consolidated'])
const RETURN_STATUSES = new Set(['Return', 'Credit Note Issued'])
/** Matches URY POS Orders tabs: Draft (counter/takeaway) · Unbilled (open dine-in) · Paid. */
const COUNTER_TYPES = new Set(['Take Away', 'Delivery', 'Phone In', 'Aggregators'])

/**
 * draft: takeaway/counter queue (URY "Draft")
 * unbilled: dine-in open or submitted awaiting payment (URY "Unbilled")
 * paid · cancelled · returned
 */
export function mapInvoiceState(row) {
  if (row.status === 'Cancelled' || row.docstatus === 2) return 'cancelled'
  if (RETURN_STATUSES.has(row.status)) return 'returned'
  if (PAID_STATUSES.has(row.status)) return 'paid'
  if (row.docstatus === 0 || row.status === 'Draft') {
    const type = String(row.order_type || '')
    if (COUNTER_TYPES.has(type) || (!row.restaurant_table && type !== 'Dine In')) return 'draft'
    return 'unbilled'
  }
  return 'unbilled'
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function mapUryInvoice(row, items = null) {
  return {
    id: row.name,
    state: mapInvoiceState(row),
    posStatus: row.status || '',
    orderType: row.order_type || '',
    table: row.restaurant_table || '',
    customerId: row.customer || '',
    customer: row.customer_name || row.customer || '',
    phone: row.mobile_number || '',
    waiter: row.waiter || '',
    total: num(row.rounded_total) || num(row.grand_total),
    currency: row.currency || null,
    qty: num(row.total_qty),
    postedAt: row.posting_date ? `${row.posting_date}${row.posting_time ? ` ${String(row.posting_time).slice(0, 8)}` : ''}` : null,
    updatedAt: row.modified || null,
    items,
  }
}

function mapItems(doc) {
  return (doc.items || [])
    .filter((it) => it.parent === doc.name)
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
    .map((it) => ({
      id: it.name,
      name: it.item_name || it.item_code || '',
      qty: num(it.qty),
      rate: num(it.rate),
      amount: num(it.amount),
    }))
}

function cents(value) {
  return Math.round(Number(value) * 100)
}

async function loadOwnInvoice(tenant, invoiceId) {
  const name = String(invoiceId || '').trim()
  if (!name) throw new OrderingError('invoice_required', 'Choose an order.')
  let doc
  try {
    doc = (await tenant.client.getDoc('POS Invoice', name)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') throw new OrderingError('not_found', 'Order not found.', { status: 404 })
    throw err
  }
  if (doc.restaurant !== tenant.uryRestaurant) throw new OrderingError('not_found', 'Order not found.', { status: 404 })
  return doc
}

async function paymentModes(client) {
  const body = await client.get('ury.ury_pos.api.getModeOfPayment')
  const modes = (Array.isArray(body?.message) ? body.message : [])
    .map((row) => row.mode_of_payment || row.name)
    .filter(Boolean)
  if (!modes.length) throw new OrderingError('no_payment_mode', 'No payment mode is configured in the POS.', { status: 409 })
  return modes
}

function billFromDoc(doc, modes) {
  const total = num(doc.rounded_total) || num(doc.grand_total) || 0
  const payable = doc.docstatus === 0 && doc.status !== 'Cancelled' && !PAID_STATUSES.has(doc.status)
  return {
    ...mapUryInvoice(doc, mapItems(doc)),
    customerId: doc.customer || '',
    subtotal: num(doc.net_total) ?? num(doc.grand_total) ?? total,
    total,
    canPay: payable,
    modes,
  }
}

/** Invoice lines and payment modes for the order sheet. */
export async function getUryInvoiceBill(tenant, invoiceId) {
  const doc = await loadOwnInvoice(tenant, invoiceId)
  return billFromDoc(doc, await paymentModes(tenant.client))
}

/** Settles a draft POS invoice the same way URY POS Pay does (`make_invoice`). */
export async function payUryInvoice(tenant, invoiceId, input = {}) {
  const doc = await loadOwnInvoice(tenant, invoiceId)
  if (doc.docstatus !== 0 || PAID_STATUSES.has(doc.status) || doc.status === 'Cancelled') {
    throw new OrderingError('already_settled', 'This order is already settled.', { status: 409 })
  }
  const modes = await paymentModes(tenant.client)
  const total = num(doc.rounded_total) || num(doc.grand_total) || 0
  const rows = (Array.isArray(input.payments) ? input.payments : [])
    .map((row) => ({
      mode_of_payment: String(row.mode || row.mode_of_payment || '').trim(),
      amount: Math.round(Number(row.amount) * 100) / 100,
    }))
    .filter((row) => row.amount > 0)
  if (!rows.length) throw new OrderingError('payment_required', 'Enter a payment amount.')
  if (rows.some((row) => !modes.includes(row.mode_of_payment))) {
    throw new OrderingError('invalid_mode', 'Use a payment mode from the POS.')
  }
  if (cents(rows.reduce((sum, row) => sum + row.amount, 0)) !== cents(total)) {
    throw new OrderingError('amount_mismatch', 'The amount entered must match the order total.')
  }

  const profile = (await tenant.client.get('ury.ury_pos.api.getPosProfile'))?.message || {}
  try {
    await tenant.client.post('ury.ury.doctype.ury_order.ury_order.make_invoice', {
      customer: doc.customer,
      payments: rows,
      cashier: doc.cashier || profile.cashier,
      pos_profile: doc.pos_profile || tenant.posProfile,
      owner: doc.owner || profile.owner,
      ...(doc.restaurant_table ? { table: doc.restaurant_table } : {}),
      invoice: doc.name,
    })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new OrderingError('payment_rejected', err.message, { status: 422 })
    }
    throw err
  }
  return { invoice: doc.name, paid: true }
}

/** Cancels an open (draft) order through URY's own cancel_order, which also frees the table. */
export async function cancelUryInvoice(tenant, invoiceId, input = {}) {
  const reason = String(input.reason || '').trim().slice(0, 140)
  if (reason.length < 3) throw new OrderingError('reason_required', 'Enter a reason for cancelling this order.')
  const doc = await loadOwnInvoice(tenant, invoiceId)
  if (doc.docstatus !== 0 || PAID_STATUSES.has(doc.status) || doc.status === 'Cancelled') {
    throw new OrderingError('not_cancellable', 'Only an open order can be cancelled.', { status: 409 })
  }
  let body
  try {
    body = await tenant.client.post('ury.ury.doctype.ury_order.ury_order.cancel_order', { invoice_id: doc.name, reason })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new OrderingError('cancel_rejected', err.message, { status: 422 })
    }
    throw err
  }
  const message = body?.message
  if (message && typeof message === 'object' && message.status === 'Failure') {
    throw new OrderingError('cancel_failed', 'The POS could not cancel this order.', { status: 502 })
  }
  return { invoice: doc.name, cancelled: true }
}

/** Marks the invoice printed in URY (`qz_print_update`), which is what the POS print button calls. */
export async function printUryInvoice(tenant, invoiceId) {
  const doc = await loadOwnInvoice(tenant, invoiceId)
  const body = await tenant.client.post('ury.ury.api.ury_print.qz_print_update', { invoice: doc.name })
  const message = body?.message
  if (message && message.status === 'Failure') {
    throw new OrderingError('print_failed', 'The POS could not mark this bill as printed.', { status: 502 })
  }
  return billFromDoc(doc, [])
}

export async function listUryOrders({ client, uryRestaurant }) {
  const rows = (
    await client.getList('POS Invoice', {
      fields: INVOICE_FIELDS,
      filters: { restaurant: uryRestaurant },
      orderBy: 'modified desc',
      limit: LIST_LIMIT,
    })
  ).filter((row) => row.restaurant === uryRestaurant)

  const withItems = new Set(
    rows
      .filter((row) => ['draft', 'unbilled'].includes(mapInvoiceState(row)))
      .slice(0, DETAIL_LIMIT)
      .map((row) => row.name),
  )
  const details = new Map()
  await Promise.all(
    [...withItems].map(async (name) => {
      const doc = (await client.getDoc('POS Invoice', name)).docs[0]
      if (doc.restaurant === uryRestaurant) details.set(name, mapItems(doc))
    }),
  )

  return rows.map((row) => mapUryInvoice(row, details.get(row.name) ?? null))
}

const VISIBLE_ACCOUNT_STATES = new Set(['draft', 'unbilled', 'paid'])

/**
 * The POS customer for this website account.
 * A saved customer id is exact: a different phone match is not used in its place.
 */
export async function findGuestAccountCustomer(tenant, phone, customerId) {
  const mobile = normalizePhone(phone)
  const wantedId = String(customerId || '').trim()
  if (wantedId) {
    try {
      const doc = (await tenant.client.getDoc('Customer', wantedId)).docs[0]
      if (!doc || doc.disabled === 1) return null
      return {
        id: doc.name,
        name: doc.customer_name || doc.name,
        phone: doc.mobile_number || mobile,
        created: false,
      }
    } catch {
      return null
    }
  }
  if (mobile.replace(/\D/g, '').length < 7) return null
  return findUryCustomerByPhone(tenant, mobile)
}

/**
 * Invoices for one POS customer at this restaurant.
 * Another customer's invoices are left out. No customer means an empty list.
 */
export async function listUryOrdersByPhone(tenant, phone, { customerId } = {}) {
  const { client, uryRestaurant } = tenant
  const mobile = normalizePhone(phone)
  if (!String(customerId || '').trim() && mobile.replace(/\D/g, '').length < 7) return []

  const customer = await findGuestAccountCustomer(tenant, mobile, customerId)
  if (!customer?.id) return []

  const rows = (
    await client.getList('POS Invoice', {
      fields: INVOICE_FIELDS,
      filters: [
        ['restaurant', '=', uryRestaurant],
        ['customer', '=', customer.id],
      ],
      orderBy: 'modified desc',
      limit: LIST_LIMIT,
    })
  ).filter((row) => row.restaurant === uryRestaurant && row.customer === customer.id)

  return rows
    .map((row) => mapUryInvoice(row, null))
    .filter((order) => VISIBLE_ACCOUNT_STATES.has(order.state))
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

/**
 * Guest Track: one POS Invoice by id + phone used at checkout.
 * Phone must match invoice.mobile_number or the Customer’s mobile_number.
 */
export async function getUryOrderByInvoiceAndPhone(tenant, invoiceId, phone) {
  const { client, uryRestaurant } = tenant
  const name = String(invoiceId || '').trim()
  const mobile = normalizePhone(phone)
  if (!name) return null
  if (phoneDigits(mobile).length < 7) return null

  let doc
  try {
    doc = (await client.getDoc('POS Invoice', name)).docs[0]
  } catch {
    return null
  }
  if (!doc || doc.restaurant !== uryRestaurant) return null

  let ok = phonesMatch(doc.mobile_number, mobile)
  if (!ok && doc.customer) {
    try {
      const customer = (await client.getDoc('Customer', doc.customer)).docs[0]
      ok = phonesMatch(customer?.mobile_number, mobile)
    } catch {
      ok = false
    }
  }
  if (!ok) return null

  return mapUryInvoice(doc, mapItems(doc))
}

/** Customers are global in URY (no restaurant field), so derive them from this restaurant's invoices. */
export async function listUryCustomers({ client, uryRestaurant }) {
  const rows = (
    await client.getList('POS Invoice', {
      fields: ['name', 'restaurant', 'status', 'docstatus', 'customer', 'customer_name', 'mobile_number', 'grand_total', 'rounded_total', 'currency', 'posting_date'],
      filters: { restaurant: uryRestaurant },
      orderBy: 'posting_date desc',
    })
  ).filter((row) => row.restaurant === uryRestaurant && row.customer)

  const byCustomer = new Map()
  for (const row of rows) {
    const state = mapInvoiceState(row)
    if (state === 'cancelled' || state === 'returned') continue
    let entry = byCustomer.get(row.customer)
    if (!entry) {
      entry = {
        id: row.customer,
        name: row.customer_name || row.customer,
        phone: row.mobile_number || '',
        visits: 0,
        spend: 0,
        currency: row.currency || null,
        lastVisit: row.posting_date || null,
      }
      byCustomer.set(row.customer, entry)
    }
    entry.visits += 1
    if (state === 'paid') entry.spend += num(row.rounded_total) || num(row.grand_total) || 0
    if (!entry.phone && row.mobile_number) entry.phone = row.mobile_number
    if (row.posting_date && (!entry.lastVisit || row.posting_date > entry.lastVisit)) entry.lastVisit = row.posting_date
  }
  return [...byCustomer.values()].sort((a, b) => String(b.lastVisit || '').localeCompare(String(a.lastVisit || '')))
}
