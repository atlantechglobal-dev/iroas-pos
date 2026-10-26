// Guest (website pickup) ordering through URY's customer-facing self-ordering
// API (ury/ury/api/self_ordering.py on version-16, read from source):
//   generate_qr_token(profile, table=None)   staff-only, stateless HMAC pickup token
//   get_ordering_context(token)              -> { session, ... }  (creates a URY Ordering Session)
//   add_customer_items(session, items)       -> { invoice, pickup_code, items[], grand_total, billed }
//                                               items: [{ item, qty, comment? }]; URY prices them
//                                               server-side (price_items_for_invoice)
//   get_order_status(session)                -> { session_status, invoice, billed, submitted, ... }
// The order is authoritative in URY (POS Invoice + KOT). Self-ordering always
// creates the invoice under the profile default customer; after a successful
// place we attach the real guest via create_customer + set_value on the Draft
// POS Invoice (verified live). IROAS keeps submission id, session and guest contact.
//
// Duplicate safety: one URY session per IROAS submission id, and the profile
// has allow_add_to_running_table = 0, so URY rejects a second add on the same
// session. After an unknown outcome (timeout / 5xx) the session's status is
// checked before any resend.

import { createHash } from 'node:crypto'
import { db } from '../../infra/db.js'
import { getEnv } from '../../config/env.js'
import { UryError } from './uryClient.js'
import { mapInvoiceState } from './uryOrders.js'
import { findOrCreateUryCustomer, OrderingError } from './uryOrdering.js'
import { sellableByCode } from './uryMenu.js'

const M = 'ury.ury.api.self_ordering'
const SUBMISSION_RE = /^[A-Za-z0-9-]{16,64}$/
const MAX_LINES = 50
const MAX_QTY = 20
const MAX_COMMENT = 200

const inFlight = new Set()
const pickupTokens = new Map()
const billingFlagsCache = new Map() // profileName → { expires, flags }

export class GuestOrderError extends Error {
  constructor(code, message, { status = 400 } = {}) {
    super(message)
    this.name = 'GuestOrderError'
    this.code = code
    this.status = status
  }
}

function retryAfterMs() {
  return Number(getEnv('URY_GUEST_ORDER_RETRY_AFTER_MS')) || 150_000
}

function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeItems(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new GuestOrderError('items_required', 'Add at least one item.')
  if (raw.length > MAX_LINES) throw new GuestOrderError('too_many_items', `At most ${MAX_LINES} lines per order.`)
  return raw.map((line) => {
    const code = clean(line?.code ?? line?.item, 140)
    const qty = Number(line?.qty)
    if (!code) throw new GuestOrderError('item_required', 'Every line needs an item.')
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new GuestOrderError('invalid_qty', `Quantity must be a whole number from 1 to ${MAX_QTY}.`)
    }
    const comment = clean(line?.comment, MAX_COMMENT)
    return comment ? { code, qty, comment } : { code, qty }
  })
}

function hashItems(items) {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex')
}

/** URY ValidationError text -> guest-facing outcome. The order was not saved (URY rolls back). */
export function classifyRejection(message) {
  const text = String(message || '')
  if (/POS Opening Entry|open the POS|close the POS/i.test(text)) {
    return {
      code: 'pos_closed',
      status: 409,
      message: 'The restaurant is not taking orders right now (its POS shift is not open). Please try again later.',
    }
  }
  if (/not available on this menu/i.test(text)) {
    return { code: 'item_unavailable', status: 422, message: 'An item in your order is no longer available. Please review your cart.' }
  }
  if (/Invalid quantity/i.test(text)) return { code: 'invalid_qty', status: 422, message: 'An item quantity is invalid.' }
  if (/running|occupied|active order/i.test(text)) {
    return { code: 'table_busy', status: 409, message: 'This table already has an open order. Please ask the staff to add items to it.' }
  }
  if (/currently unavailable|not enabled|not configured/i.test(text)) {
    return { code: 'ordering_unavailable', status: 409, message: 'Online ordering is currently unavailable.' }
  }
  return { code: 'order_rejected', status: 422, message: text.slice(0, 300) || 'The restaurant could not accept this order.' }
}

function getRow(restaurantId, submissionId) {
  return db
    .prepare('SELECT * FROM ury_guest_orders WHERE restaurant_id = ? AND submission_id = ?')
    .get(restaurantId, submissionId)
}

/** Billing switches on URY Self Ordering Profile (enable_request_bill is often off; pay-at-counter on). */
async function readBillingFlags(tenant) {
  const profile = tenant.selfOrderingProfile
  if (!profile) {
    return { enableRequestBill: false, enablePayAtCounter: true, enableCustomerPayment: false }
  }
  const hit = billingFlagsCache.get(profile)
  if (hit && hit.expires > Date.now()) return hit.flags
  let flags = { enableRequestBill: false, enablePayAtCounter: true, enableCustomerPayment: false }
  try {
    const doc = (await tenant.client.getDoc('URY Self Ordering Profile', profile)).docs[0]
    flags = {
      enableRequestBill: doc.enable_request_bill === 1,
      enablePayAtCounter: doc.enable_pay_at_counter === 1,
      enableCustomerPayment: doc.enable_customer_payment === 1,
    }
  } catch (err) {
    if (!(err instanceof UryError)) throw err
  }
  billingFlagsCache.set(profile, { expires: Date.now() + 60_000, flags })
  return flags
}

function update(id, fields) {
  const keys = Object.keys(fields)
  db.prepare(
    `UPDATE ury_guest_orders SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`,
  ).run({ ...fields, id })
  return db.prepare('SELECT * FROM ury_guest_orders WHERE id = ?').get(id)
}

function mapOrderResponse(msg) {
  return {
    invoice: msg.invoice || null,
    pickupCode: msg.pickup_code || msg.invoice || null,
    items: (msg.items || []).map((it) => ({
      code: it.item_code,
      name: it.item_name || it.item_code,
      qty: it.qty,
      rate: it.rate,
      amount: it.amount,
      comment: it.comment || '',
    })),
    total: typeof msg.grand_total === 'number' ? msg.grand_total : null,
  }
}

/** Browser-safe view of a submission (never includes the URY session token). */
function view(row, extra = {}) {
  const order = row.response_json ? JSON.parse(row.response_json) : null
  return {
    submissionId: row.submission_id,
    status: row.status === 'submitting' ? 'verifying' : row.status,
    invoice: row.invoice || null,
    pickupCode: order?.pickupCode || null,
    items: order?.items || [],
    total: order?.total ?? null,
    table: row.ury_table || null,
    customer: row.ury_customer || order?.customer || null,
    customerName: order?.customerName || row.guest_name || null,
    code: row.error_code || null,
    message: row.error_message || null,
    guestDetailsStoredInPos: Boolean(row.ury_customer),
    ...extra,
  }
}

/**
 * Replaces the self-ordering default customer on a Draft POS Invoice with the
 * real guest (create_customer / find by mobile). Failures are logged; the order stays placed.
 */
async function attachGuestCustomer(tenant, row) {
  if (!row?.invoice || row.ury_customer) return row
  const guestName = clean(row.guest_name, 80)
  const guestPhone = String(row.guest_phone || '').replace(/[^\d+]/g, '')
  if (!guestName || guestPhone.replace(/\D/g, '').length < 7) return row

  let customer
  try {
    customer = await findOrCreateUryCustomer(tenant, { name: guestName, phone: guestPhone })
  } catch (err) {
    if (err instanceof OrderingError || err instanceof UryError) {
      console.warn(`[ury-guest] restaurant=${tenant.restaurantId} attach_customer=${err.code} invoice=${row.invoice}`)
      return row
    }
    throw err
  }

  try {
    const doc = (await tenant.client.getDoc('POS Invoice', row.invoice)).docs[0]
    if (doc.restaurant !== tenant.uryRestaurant && doc.branch !== tenant.branch) return row
    if (doc.docstatus !== 0 && doc.status !== 'Draft') {
      // Already paid/submitted — cannot rewrite customer; still record the link for Account.
      const order = row.response_json ? JSON.parse(row.response_json) : {}
      return update(row.id, {
        ury_customer: customer.id,
        response_json: JSON.stringify({ ...order, customer: customer.id, customerName: customer.name }),
      })
    }
    await tenant.client.post('frappe.client.set_value', {
      doctype: 'POS Invoice',
      name: row.invoice,
      fieldname: { customer: customer.id, mobile_number: customer.phone || guestPhone },
    })
  } catch (err) {
    if (err instanceof UryError) {
      console.warn(`[ury-guest] restaurant=${tenant.restaurantId} set_invoice_customer=${err.code} invoice=${row.invoice}`)
      return row
    }
    throw err
  }

  const order = row.response_json ? JSON.parse(row.response_json) : {}
  return update(row.id, {
    ury_customer: customer.id,
    response_json: JSON.stringify({ ...order, customer: customer.id, customerName: customer.name }),
  })
}

function outcome(row, { replay = false } = {}) {
  switch (row.status) {
    case 'placed':
      return { httpStatus: replay ? 200 : 201, body: { success: true, data: view(row, { replay }) } }
    case 'rejected':
      return {
        httpStatus: rejectionStatus(row.error_code),
        body: { success: false, code: row.error_code, error: row.error_message, data: view(row) },
      }
    case 'failed':
      return {
        httpStatus: 502,
        body: {
          success: false,
          code: 'pos_unavailable',
          error: 'We could not reach the restaurant’s POS. Your order was not placed. Please try again.',
          data: view(row, { retryable: true }),
        },
      }
    case 'unknown':
      return {
        httpStatus: 202,
        body: {
          success: true,
          data: view(row, {
            message:
              row.error_message ||
              'We are confirming your order with the restaurant. Please do not order again — check back in a moment.',
            retryAfterSeconds: Math.ceil(retryAfterMs() / 1000),
          }),
        },
      }
    default:
      return {
        httpStatus: 202,
        body: { success: true, data: view(row, { message: 'Your order is being sent to the restaurant…', retryAfterSeconds: 3 }) },
      }
  }
}

function rejectionStatus(code) {
  return ['pos_closed', 'ordering_unavailable', 'table_busy'].includes(code) ? 409 : 422
}

/** URY ordering token for pickup (no table) or for one URY table (QR dine-in). */
async function orderingToken(tenant, table = null) {
  const key = `${tenant.restaurantId}\u0000${tenant.selfOrderingProfile}\u0000${table || ''}`
  if (pickupTokens.has(key)) return pickupTokens.get(key)
  const body = await tenant.client.post(`${M}.generate_qr_token`, {
    profile: tenant.selfOrderingProfile,
    ...(table ? { table } : {}),
  })
  const token = body?.message
  if (typeof token !== 'string' || !token) throw new UryError('upstream_error', 'URY returned no ordering token.')
  pickupTokens.set(key, token)
  return token
}

function isUnknownOutcome(err) {
  return err instanceof UryError && (['timeout', 'unreachable'].includes(err.code) || err.status >= 500)
}

async function fetchOrder(tenant, session) {
  const body = await tenant.client.get(`${M}.get_customer_order`, { session })
  return body?.message || null
}

/** Asks URY whether this submission's session already produced an invoice. */
async function reconcile(tenant, row) {
  let status
  try {
    status = (await tenant.client.get(`${M}.get_order_status`, { session: row.ury_session }))?.message || {}
  } catch (err) {
    if (err instanceof UryError && (err.code === 'forbidden' || err.code === 'auth_failed')) {
      const r = update(row.id, {
        status: 'unknown',
        error_code: 'order_unverified',
        error_message: 'We could not confirm whether this order reached the restaurant. Please contact the restaurant before ordering again.',
      })
      return { done: true, row: r }
    }
    if (isUnknownOutcome(err)) return { done: true, row }
    throw err
  }
  if (status.invoice) {
    const msg = (await fetchOrder(tenant, row.ury_session).catch(() => null)) || { invoice: status.invoice }
    let r = update(row.id, {
      status: 'placed',
      invoice: msg.invoice || status.invoice,
      response_json: JSON.stringify(mapOrderResponse(msg)),
      error_code: null,
      error_message: null,
    })
    r = await attachGuestCustomer(tenant, r)
    return { done: true, row: r }
  }
  const last = Date.parse(row.last_attempt_at || '') || 0
  if (Date.now() - last < retryAfterMs()) return { done: true, row }
  return { done: false, row }
}

async function addItems(tenant, row, items) {
  row = update(row.id, { status: 'submitting', attempts: row.attempts + 1, last_attempt_at: new Date().toISOString() })
  let body
  try {
    body = await tenant.client.post(`${M}.add_customer_items`, {
      session: row.ury_session,
      items: items.map((i) => ({ item: i.code, qty: i.qty, ...(i.comment ? { comment: i.comment } : {}) })),
    })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      if (/Adding further items to this order is not allowed/i.test(err.message)) {
        // An earlier attempt on this session already created the order.
        const r = await reconcile(tenant, { ...row, last_attempt_at: '' })
        return r.row
      }
      const rej = classifyRejection(err.message)
      return update(row.id, { status: 'rejected', error_code: rej.code, error_message: rej.message })
    }
    if (err instanceof UryError && err.code === 'forbidden' && row.attempts <= 1) {
      return update(row.id, { status: 'failed', error_code: 'session_rejected', error_message: null })
    }
    if (isUnknownOutcome(err) || err instanceof UryError) {
      return update(row.id, { status: 'unknown', error_code: err.code || 'unknown', error_message: null })
    }
    throw err
  }
  const msg = body?.message
  if (!msg?.invoice) return update(row.id, { status: 'unknown', error_code: 'no_invoice', error_message: null })
  row = update(row.id, {
    status: 'placed',
    invoice: msg.invoice,
    response_json: JSON.stringify(mapOrderResponse(msg)),
    error_code: null,
    error_message: null,
  })
  return attachGuestCustomer(tenant, row)
}

async function openSessionAndAdd(tenant, row, items) {
  let session
  try {
    const token = await orderingToken(tenant, row.ury_table || null)
    const ctx = (await tenant.client.post(`${M}.get_ordering_context`, { token }))?.message
    session = typeof ctx?.session === 'string' ? ctx.session : null
    if (!session) throw new UryError('upstream_error', 'URY returned no ordering session.')
  } catch (err) {
    // No items were sent, so no order exists for this attempt.
    if (err instanceof UryError && (err.code === 'validation' || err.code === 'forbidden')) {
      pickupTokens.clear()
      const rej = err.code === 'validation' ? classifyRejection(err.message) : classifyRejection('not configured')
      return update(row.id, { status: 'rejected', error_code: rej.code, error_message: rej.message })
    }
    if (err instanceof UryError) return update(row.id, { status: 'failed', error_code: err.code, error_message: null })
    throw err
  }
  row = update(row.id, { ury_session: session })
  return addItems(tenant, row, items)
}

/**
 * Submits (or safely re-submits) a guest order for a verified tenant: pickup, or
 * dine-in when `input.table` is a URY table already verified for this tenant.
 * Returns { httpStatus, body } for the public route.
 */
export async function submitGuestOrder(tenant, input = {}) {
  if (!tenant.selfOrderingProfile) {
    throw new GuestOrderError('ordering_unavailable', 'Online ordering is currently unavailable.', { status: 409 })
  }
  const submissionId = String(input.submissionId || '')
  if (!SUBMISSION_RE.test(submissionId)) throw new GuestOrderError('invalid_submission', 'Invalid order reference.')
  const items = normalizeItems(input.items)
  const guestName = clean(input.guestName, 80)
  const guestPhone = String(input.guestPhone ?? '').replace(/[^\d+]/g, '').slice(0, 20)
  if (!guestName) throw new GuestOrderError('invalid_name', 'Enter your name.')
  if (guestPhone.replace(/\D/g, '').length < 7) throw new GuestOrderError('invalid_phone', 'Enter a valid phone number.')
  const availability = await sellableByCode(tenant.client, {
    posProfile: tenant.posProfile,
    branch: tenant.branch,
    codes: items.map((item) => item.code),
  })
  if (availability) {
    const blocked = items.find((item) => {
      const row = availability.get(item.code)
      return row && (!row.sellable || row.availableQty < item.qty)
    })
    if (blocked) {
      throw new GuestOrderError('item_unavailable', 'An item in your order is not available today. Please review your cart.', { status: 422 })
    }
  }
  const table = input.table ? clean(input.table, 140) : null
  const requestHash = hashItems(table ? { items, table } : items)

  const key = `${tenant.restaurantId}\u0000${submissionId}`
  if (inFlight.has(key)) {
    const row = getRow(tenant.restaurantId, submissionId)
    if (row) return outcome({ ...row, status: 'submitting' })
    return { httpStatus: 202, body: { success: true, data: { submissionId, status: 'verifying', retryAfterSeconds: 3 } } }
  }
  inFlight.add(key)
  try {
    let row = getRow(tenant.restaurantId, submissionId)
    if (row && row.request_hash !== requestHash) {
      throw new GuestOrderError('submission_conflict', 'This order reference was already used for a different order.', { status: 409 })
    }
    if (row && (row.status === 'placed' || row.status === 'rejected')) return outcome(row, { replay: true })

    if (row && (row.status === 'submitting' || row.status === 'unknown') && row.ury_session) {
      const r = await reconcile(tenant, row)
      if (r.done) return outcome(r.row, { replay: r.row.status === 'placed' })
      return outcome(await addItems(tenant, r.row, items))
    }

    if (row) {
      row = update(row.id, { status: 'submitting', ury_session: null, error_code: null, error_message: null })
    } else {
      db.prepare(
        `INSERT INTO ury_guest_orders (restaurant_id, submission_id, request_hash, status, guest_name, guest_phone, ury_table)
         VALUES (?, ?, ?, 'submitting', ?, ?, ?)`,
      ).run(tenant.restaurantId, submissionId, requestHash, guestName, guestPhone, table)
      row = getRow(tenant.restaurantId, submissionId)
    }
    let result = await openSessionAndAdd(tenant, row, items)
    if (result.status === 'placed' && !result.ury_customer) {
      result = await attachGuestCustomer(tenant, result)
    }
    return outcome(result)
  } finally {
    inFlight.delete(key)
  }
}

/** Current state of a submission, with live POS status for placed orders. */
export async function getGuestOrder(tenant, submissionId) {
  let row = getRow(tenant.restaurantId, String(submissionId || ''))
  if (!row) throw new GuestOrderError('not_found', 'Order not found.', { status: 404 })

  if ((row.status === 'submitting' || row.status === 'unknown') && row.ury_session && !inFlight.has(`${tenant.restaurantId}\u0000${row.submission_id}`)) {
    try {
      row = (await reconcile(tenant, { ...row, last_attempt_at: new Date().toISOString() })).row
    } catch (err) {
      if (!(err instanceof UryError)) throw err
    }
  }
  if (row.status !== 'placed' || !row.invoice) return outcome(row, { replay: true })

  let live = null
  try {
    const doc = (await tenant.client.getDoc('POS Invoice', row.invoice)).docs[0]
    if (doc.branch === tenant.branch || doc.restaurant === tenant.uryRestaurant) {
      let billed = null
      let submitted = null
      if (row.ury_session) {
        try {
          const st = (await tenant.client.get(`${M}.get_order_status`, { session: row.ury_session }))?.message || {}
          if (typeof st.billed === 'boolean' || st.billed === 0 || st.billed === 1) billed = Boolean(st.billed)
          if (typeof st.submitted === 'boolean' || st.submitted === 0 || st.submitted === 1) submitted = Boolean(st.submitted)
        } catch (err) {
          if (!(err instanceof UryError)) throw err
        }
      }
      const flags = await readBillingFlags(tenant)
      const unpaid = ['draft', 'unbilled'].includes(mapInvoiceState(doc))
      live = {
        state: mapInvoiceState(doc),
        posStatus: doc.status || '',
        orderType: doc.order_type || (row.ury_table ? 'Dine In' : 'Take Away'),
        table: doc.restaurant_table || row.ury_table || null,
        billed,
        submitted,
        total: doc.rounded_total || doc.grand_total || null,
        enableRequestBill: flags.enableRequestBill,
        enablePayAtCounter: flags.enablePayAtCounter,
        canRequestBill:
          flags.enableRequestBill && unpaid && Boolean(row.ury_session) && billed !== true,
        canPayAtCounter: flags.enablePayAtCounter && unpaid && mapInvoiceState(doc) !== 'paid',
      }
    }
  } catch (err) {
    if (!(err instanceof UryError)) throw err
  }
  const res = outcome(row, { replay: true })
  res.body.data.live = live
  return res
}

/**
 * Asks URY to mark the guest's open order as ready for payment (self_ordering.request_bill).
 * When the Self Ordering Profile has Enable Request Bill off (common), skips URY and
 * returns pay-at-counter / print guidance instead of failing.
 */
export async function requestGuestBill(tenant, submissionId) {
  const row = getRow(tenant.restaurantId, String(submissionId || ''))
  if (!row) throw new GuestOrderError('not_found', 'Order not found.', { status: 404 })
  if (row.status !== 'placed' || !row.invoice) {
    throw new GuestOrderError('not_ready', 'This order is not ready for the bill yet.', { status: 409 })
  }

  const flags = await readBillingFlags(tenant)
  if (!flags.enableRequestBill) {
    const res = await getGuestOrder(tenant, submissionId)
    if (res.body?.data?.live) {
      res.body.data.live.billReady = true
      res.body.data.live.payAtCounter = Boolean(flags.enablePayAtCounter)
    } else if (res.body?.data) {
      res.body.data.live = { billReady: true, payAtCounter: Boolean(flags.enablePayAtCounter) }
    }
    return res
  }

  if (!row.ury_session) {
    throw new GuestOrderError('session_expired', 'This order session has ended. Please ask the staff for the bill.', { status: 409 })
  }
  try {
    await tenant.client.post(`${M}.request_bill`, { session: row.ury_session })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      const msg = err.message || ''
      if (/not enabled/i.test(msg)) {
        billingFlagsCache.delete(tenant.selfOrderingProfile)
        const res = await getGuestOrder(tenant, submissionId)
        if (res.body?.data?.live) {
          res.body.data.live.billReady = true
          res.body.data.live.payAtCounter = true
        }
        return res
      }
      throw new GuestOrderError('bill_rejected', msg || 'The restaurant could not prepare the bill.', { status: 422 })
    }
    if (err instanceof UryError && (err.code === 'forbidden' || err.code === 'auth_failed')) {
      throw new GuestOrderError('session_expired', 'This order session has ended. Please ask the staff for the bill.', { status: 409 })
    }
    throw err
  }
  return getGuestOrder(tenant, submissionId)
}

export function clearPickupTokens() {
  pickupTokens.clear()
}
