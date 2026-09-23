/** Launch / subscription plans shown in Platform Admin → Plans */

export const PLATFORM_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Launch your digital storefront',
    priceZar: 999,
    billing: 'one-time launch',
    popular: false,
    features: [
      'Guest website & menu',
      'Business ID QR card',
      'Reservations (basic)',
      'Email notifications',
      'Single location',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Scale orders and marketing',
    priceZar: 2499,
    billing: 'one-time launch',
    popular: true,
    features: [
      'Everything in Starter',
      'Incoming orders & KDS',
      'Table QR ordering',
      'Reviews & One Link hub',
      'Priority onboarding review',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Multi-site and custom rollout',
    priceZar: 4999,
    billing: 'one-time launch',
    popular: false,
    features: [
      'Everything in Growth',
      'Multi-location ready',
      'POS integration support',
      'Dedicated success contact',
      'Custom domain assist',
    ],
  },
]

export function formatPlanPrice(amountZar) {
  const n = Math.round(Number(amountZar) || 0)
  return `R${n.toLocaleString('en-ZA')}`
}
