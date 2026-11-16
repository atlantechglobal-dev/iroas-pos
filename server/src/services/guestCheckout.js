/**
 * AddPay hosted-checkout for guest orders (the "Pay now" option), separate
 * from `onboardingPayment.js` which handles the platform's own launch fee.
 *
 * AddPay credentials here are the single shared platform account
 * (`paymentSettings.js`) — guest-order payments route through it today,
 * same as the onboarding fee. A real per-restaurant payout/merchant split
 * is a future business decision, not handled by this flow.
 */
import { addpayRequest } from './addpayClient.js'
import { getPaymentSettings, isPaymentConfigured } from './paymentSettings.js'
import { appPublicUrl, apiPublicUrl } from './onboardingPayment.js'

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
 * Build an AddPay checkout session for a guest order's total.
 * Returns { reference, payUrl }. Throws on failure — caller decides
 * whether to fall back to "pay at the table" rather than block the order.
 */
export async function createGuestOrderCheckout(restaurant, order) {
  if (!isPaymentConfigured()) {
    throw Object.assign(new Error('Online payment is not set up yet.'), { status: 503 })
  }

  const reference = `ORD-${restaurant.id}-${order.id}-${Date.now().toString(36).toUpperCase()}`
  const appBase = appPublicUrl()
  const apiBase = apiPublicUrl()
  // The restaurant row's slug lives in `subdomain`, not `slug` — mirrors
  // `publicSlug()` in modules/public/routes.js and `guestSitePath()` from
  // src/shared/utils/guestLinks.js (frontend-only module, not importable here).
  const slug = restaurant.subdomain || String(restaurant.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const trackingPath = `/s/${slug}/tracking?code=${encodeURIComponent(order.publicCode)}`

  const checkout = await addpayRequest(
    '/api/entry',
    {
      method: 'pay.paycloud.checkout',
      merchant_order_no: reference,
      order_amount: order.total,
      price_currency: 'ZAR',
      notify_url: `${apiBase}/api/public/payments/addpay/webhook`,
      return_url: `${appBase}${trackingPath}&paid=return`,
      description: `Order ${order.publicCode} — ${restaurant.name || 'restaurant'}`,
      expires: 1800,
      term_ip: '127.0.0.1',
    },
    getPaymentSettings(),
  )

  const data = parseCheckoutData(checkout)
  const payUrl = data?.pay_url || data?.payUrl || data?.checkout_url
  if (!payUrl) {
    throw Object.assign(new Error('AddPay did not return a payment URL.'), { status: 502 })
  }

  return { reference, payUrl }
}
