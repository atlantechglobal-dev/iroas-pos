/** Warm lazy route chunks so the next navigation feels instant. */

const loaders = {
  login: () => import('@/features/auth/Login/Login'),
  createAccount: () => import('@/features/auth/CreateAccount/CreateAccount'),
  accountThanks: () => import('@/features/auth/AccountThanks/AccountThanks'),
  restaurantSetup: () => import('@/features/onboarding/RestaurantSetup/RestaurantSetup'),
  domain: () => import('@/features/onboarding/Domain/Domain'),
  brand: () => import('@/features/onboarding/Brand/Brand'),
  launch: () => import('@/features/onboarding/Launch/Launch'),
  onboardingPayment: () => import('@/features/onboarding/OnboardingPayment/OnboardingPayment'),
  dashboard: () => import('@/features/dashboard/Dashboard/Dashboard'),
  digitalBusinessCard: () => import('@/features/dashboard/DigitalBusinessCard/DigitalBusinessCard'),
  platformAdmin: () => import('@/features/platform-admin/PlatformAdmin/PlatformAdmin'),
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
