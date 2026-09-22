/** Warm lazy route chunks so the next navigation feels instant. */

const loaders = {
  login: () => import('../pages/Login/Login.jsx'),
  createAccount: () => import('../pages/CreateAccount/CreateAccount.jsx'),
  accountThanks: () => import('../pages/AccountThanks/AccountThanks.jsx'),
  restaurantSetup: () => import('../pages/RestaurantSetup/RestaurantSetup.jsx'),
  domain: () => import('../pages/Domain/Domain.jsx'),
  brand: () => import('../pages/Brand/Brand.jsx'),
  launch: () => import('../pages/Launch/Launch.jsx'),
  onboardingPayment: () => import('../pages/OnboardingPayment/OnboardingPayment.jsx'),
  dashboard: () => import('../pages/Dashboard/Dashboard.jsx'),
  platformAdmin: () => import('../pages/PlatformAdmin/PlatformAdmin.jsx'),
}

const warmed = new Set()

export function prefetchRoute(key) {
  const load = loaders[key]
  if (!load || warmed.has(key)) return
  warmed.add(key)
  load().catch(() => {
    warmed.delete(key)
  })
}

export function prefetchRoutes(keys = []) {
  for (const key of keys) prefetchRoute(key)
}

export function prefetchWhenIdle(keys = []) {
  const run = () => prefetchRoutes(keys)
  if (typeof window === 'undefined') return
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1800 })
  } else {
    window.setTimeout(run, 280)
  }
}
