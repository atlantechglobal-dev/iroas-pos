/**
 * Dual-lane order status for URY-linked restaurants:
 *
 *   Payment (URY POS Invoice — read-only in IROAS):
 *     Draft → Unbilled → Paid   (take payment in URY; guest may Request bill)
 *
 *   Kitchen (IROAS — staff advances step-by-step):
 *     Received → Accepted → Preparing → Ready → Completed
 *
 * Guest Track shows both. Staff POS board can group by either lane.
 */

import { db } from '../../infra/db.js'

export const KITCHEN_STEPS = ['received', 'accepted', 'preparing', 'ready', 'completed']

export const KITCHEN_LABELS = {
  received: 'Received',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
}

const STEP_SET = new Set(KITCHEN_STEPS)

export function nextKitchenStep(step) {
  const i = KITCHEN_STEPS.indexOf(step)
  if (i < 0 || i >= KITCHEN_STEPS.length - 1) return null
  return KITCHEN_STEPS[i + 1]
}

export function defaultKitchenStep(invoiceState) {
  if (invoiceState === 'paid') return 'completed'
  if (invoiceState === 'cancelled' || invoiceState === 'returned') return 'completed'
  return 'received'
}

export function getKitchenSteps(restaurantId, invoiceIds) {
  const ids = [...new Set((invoiceIds || []).map(String).filter(Boolean))]
  if (!ids.length) return new Map()
  const placeholders = ids.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT invoice_id, step, updated_at FROM ury_order_kitchen
       WHERE restaurant_id = ? AND invoice_id IN (${placeholders})`,
    )
    .all(restaurantId, ...ids)
  return new Map(rows.map((r) => [r.invoice_id, { step: r.step, updatedAt: r.updated_at }]))
}

export function attachKitchenProgress(restaurantId, orders) {
  const stored = getKitchenSteps(
    restaurantId,
    orders.map((o) => o.id),
  )
  return orders.map((order) => {
    const hit = stored.get(order.id)
    const kitchenStep = hit?.step && STEP_SET.has(hit.step) ? hit.step : defaultKitchenStep(order.state)
    return {
      ...order,
      kitchenStep,
      kitchenLabel: KITCHEN_LABELS[kitchenStep] || kitchenStep,
      nextKitchenStep: nextKitchenStep(kitchenStep),
      kitchenUpdatedAt: hit?.updatedAt || null,
    }
  })
}

/** Set kitchen step explicitly, or advance one step when `{ advance: true }`. */
export function setKitchenStep(restaurantId, invoiceId, { step, advance } = {}) {
  const id = String(invoiceId || '').trim()
  if (!id) throw Object.assign(new Error('Invoice required.'), { code: 'invalid_invoice', status: 400 })

  const existing = db
    .prepare(`SELECT step FROM ury_order_kitchen WHERE restaurant_id = ? AND invoice_id = ?`)
    .get(restaurantId, id)
  const current = existing?.step && STEP_SET.has(existing.step) ? existing.step : 'received'

  let next = null
  if (advance) {
    next = nextKitchenStep(current)
    if (!next) {
      throw Object.assign(new Error('Kitchen is already at the last step.'), { code: 'kitchen_done', status: 400 })
    }
  } else if (step && STEP_SET.has(step)) {
    next = step
  } else {
    throw Object.assign(new Error('Pass advance:true or a valid kitchen step.'), {
      code: 'invalid_kitchen_step',
      status: 400,
    })
  }

  db.prepare(
    `INSERT INTO ury_order_kitchen (restaurant_id, invoice_id, step, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(restaurant_id, invoice_id) DO UPDATE SET
       step = excluded.step,
       updated_at = excluded.updated_at`,
  ).run(restaurantId, id, next)

  return {
    invoiceId: id,
    kitchenStep: next,
    kitchenLabel: KITCHEN_LABELS[next],
    nextKitchenStep: nextKitchenStep(next),
  }
}
