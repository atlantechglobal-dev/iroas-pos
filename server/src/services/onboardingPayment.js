/**
 * Shared helpers for onboarding AddPay payment finalization
 * (webhook + owner return sync).
 */
import { db } from '../infra/db.js'
import { addpayRequest } from './addpayClient.js'
import { getPaymentSettings, isPaymentConfigured } from './paymentSettings.js'
import { sendOnboardingPaymentEmails } from './onboardingMessaging.js'

export function parseRestaurantSettings(restaurant) {
  if (!restaurant?.settings_json) return {}
  try {
    return JSON.parse(restaurant.settings_json)
  } catch {
    return {}
  }
}

export function appPublicUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/$/, '')
}

/** Base URL AddPay can POST webhooks to (must be publicly reachable in prod). */
export function apiPublicUrl() {
  return String(
    process.env.PUBLIC_API_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'http://localhost:5173',
  )
    .trim()
    .replace(/\/$/, '')
}

function parseCheckoutData(checkout) {
  let data = checkout?.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      data = null
    }
  }
  return data && typeof data === 'object' ? data : {}
}

/**
 * Ask AddPay whether a merchant order has completed.
 * Returns { paid, cancelled, raw } or null if query is unavailable.
 */
export async function queryAddPayOrder(reference) {
  if (!isPaymentConfigured() || !reference) return null

  const settings = getPaymentSettings()
  const attempts = ['pay.paycloud.orderquery', 'pay.orderquery']

  for (const method of attempts) {
    try {
      const checkout = await addpayRequest(
        '/api/entry',
        {
          method,
          merchant_order_no: reference,
        },
        settings,
      )
      const data = parseCheckoutData(checkout)
      const transStatus = Number(
        data.trans_status ?? data.transStatus ?? checkout.trans_status ?? NaN,
      )
      if (Number.isNaN(transStatus)) {
        // Some gateways nest status differently — treat code SUCCESS + paid flags
        const paidFlag =
          data.paid === true ||
          data.paid === 'true' ||
          String(data.trade_status || data.status || '').toLowerCase() === 'success'
        if (paidFlag) return { paid: true, cancelled: false, raw: data, method }
        continue
      }
      if (transStatus === 2) return { paid: true, cancelled: false, raw: data, method }
      if (transStatus === 3) return { paid: false, cancelled: true, raw: data, method }
      return { paid: false, cancelled: false, raw: data, method, transStatus }
    } catch (err) {
      console.warn(`[addpay] order query via ${method} failed:`, err.message || err)
    }
  }
  return null
}

/**
 * Mark onboarding payment paid and send emails (idempotent).
 */
export async function finalizeOnboardingPayment(restaurant, {
  reference,
  amount,
  currency = 'ZAR',
  addpayOrderNo = null,
  method = 'addpay',
  gateway = 'addpay',
} = {}) {
  const settings = parseRestaurantSettings(restaurant)
  const pending = settings?.onboardingPayment || {}
  if (pending.paid) {
    return { alreadyPaid: true, payment: pending, settings }
  }

  const professionalEmail = settings.professionalEmail || restaurant.email || ''
  const payment = {
    ...pending,
    paid: true,
    pending: false,
    paidAt: new Date().toISOString(),
    method: pending.method || method,
    amount: pending.amount ?? amount ?? null,
    currency: pending.currency || currency,
    reference: reference || pending.reference,
    gateway: pending.gateway || gateway,
    addpayOrderNo: addpayOrderNo || pending.addpayOrderNo || null,
  }
  const nextSettings = { ...settings, onboardingPayment: payment, professionalEmail }

  db.prepare(
    `UPDATE restaurants SET
       settings_json = ?,
       email = COALESCE(NULLIF(email, ''), ?),
       status = 'live',
       launched_at = COALESCE(launched_at, datetime('now')),
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(JSON.stringify(nextSettings), professionalEmail || null, restaurant.id)

  const updated = {
    ...restaurant,
    email: restaurant.email || professionalEmail,
    status: 'live',
  }
  const emails = await sendOnboardingPaymentEmails({ restaurant: updated, payment }).catch((err) => {
    console.warn('[payment] welcome emails failed:', err.message || err)
    return null
  })

  return { alreadyPaid: false, payment, settings: nextSettings, emails, status: 'live' }
}

/**
 * If checkout is pending, query AddPay and finalize when paid.
 */
export async function syncPendingOnboardingPayment(restaurant) {
  const settings = parseRestaurantSettings(restaurant)
  const pending = settings?.onboardingPayment
  if (!pending || pending.paid || !pending.reference || !pending.pending) {
    return { synced: false, paid: Boolean(pending?.paid), payment: pending || null }
  }
  if (!isPaymentConfigured()) {
    return { synced: false, paid: false, payment: pending }
  }

  const result = await queryAddPayOrder(pending.reference)
  if (!result) {
    return { synced: false, paid: false, payment: pending, queryFailed: true }
  }

  if (result.cancelled) {
    const nextSettings = {
      ...settings,
      onboardingPayment: {
        ...pending,
        pending: false,
        cancelledAt: new Date().toISOString(),
      },
    }
    db.prepare(
      `UPDATE restaurants SET settings_json = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(JSON.stringify(nextSettings), restaurant.id)
    return {
      synced: true,
      paid: false,
      cancelled: true,
      payment: nextSettings.onboardingPayment,
    }
  }

  if (!result.paid) {
    return { synced: false, paid: false, payment: pending, transStatus: result.transStatus }
  }

  const finalized = await finalizeOnboardingPayment(restaurant, {
    reference: pending.reference,
    amount: pending.amount,
    currency: pending.currency || 'ZAR',
    addpayOrderNo: result.raw?.order_no || result.raw?.orderNo || null,
  })

  return {
    synced: true,
    paid: true,
    payment: finalized.payment,
    emails: finalized.emails,
  }
}
