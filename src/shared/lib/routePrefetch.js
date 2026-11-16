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
  'digital-business-card': () => import('@/features/dashboard/DigitalBusinessCard/DigitalBusinessCard'),
  'business-id': () => import('@/features/dashboard/BusinessId/BusinessId'),
  'restaurant-profile': () => import('@/features/dashboard/RestaurantProfile/RestaurantProfile'),
  branding: () => import('@/features/onboarding/Brand/Brand'),
  menu: () => import('@/features/dashboard/Menu/Menu'),
  'incoming-orders': () => import('@/features/dashboard/Orders/Orders'),
  'pos-shift': () => import('@/features/dashboard/PosShift/PosShift'),
  reservations: () => import('@/features/dashboard/Reservations/Reservations'),
  tables: () => import('@/features/dashboard/Tables/Tables'),
  staff: () => import('@/features/dashboard/Staff/Staff'),
  customers: () => import('@/features/dashboard/Customers/Customers'),
  payments: () => import('@/features/dashboard/Payments/Payments'),
  marketing: () => import('@/features/dashboard/Marketing/Marketing'),
  reviews: () => import('@/features/dashboard/Reviews/Reviews'),
  'one-link': () => import('@/features/dashboard/OneLink/OneLink'),
  'directory-listings': () => import('@/features/dashboard/DirectoryListings/DirectoryListings'),
  'mobile-app': () => import('@/features/dashboard/MobileApplication/MobileApplication'),
  pos: () => import('@/features/dashboard/PosIntegration/PosIntegration'),
  notifications: () => import('@/features/dashboard/Notifications/Notifications'),
  settings: () => import('@/features/dashboard/Settings/Settings'),
  platformAdmin: () => import('@/features/platform-admin/PlatformAdmin/PlatformAdmin'),
  'platform-admin': () => import('@/features/platform-admin/PlatformAdmin/PlatformAdmin'),
  'platform-customers': () => import('@/features/platform-admin/PlatformAdmin/PlatformCustomers'),
  'platform-account-approve': () => import('@/features/platform-admin/PlatformAdmin/AccountApprove'),
  'platform-customer-onboarding': () =>
    import('@/features/platform-admin/PlatformAdmin/CustomerOnboarding'),
  'platform-plans': () => import('@/features/platform-admin/PlatformAdmin/Plans'),
  'platform-notifications': () => import('@/features/platform-admin/PlatformAdmin/PlatformNotifications'),
  'platform-audit': () => import('@/features/platform-admin/PlatformAdmin/PlatformAudit'),
  'platform-staff': () => import('@/features/platform-admin/PlatformAdmin/PlatformStaff'),
  'platform-professional': () => import('@/features/platform-admin/PlatformAdmin/PlatformProfessional'),
  'platform-settings': () => import('@/features/platform-admin/PlatformAdmin/PlatformSettings'),
  'platform-settings-email': () => import('@/features/dashboard/Settings/EmailSettings'),
  'platform-settings-payment': () => import('@/features/dashboard/Settings/PaymentSettings'),
  'platform-settings-google': () => import('@/features/dashboard/Settings/GoogleAuthSettings'),
  'platform-settings-categories': () =>
    import('@/features/platform-admin/PlatformAdmin/BusinessCategoriesSettings'),
  'platform-settings-flags': () => import('@/features/platform-admin/PlatformAdmin/FeatureFlags'),
}

export const OWNER_NAV_PREFETCH = [
  'dashboard',
  'digital-business-card',
  'business-id',
  'restaurant-profile',
  'branding',
  'menu',
  'incoming-orders',
  'pos-shift',
  'reservations',
  'tables',
  'staff',
  'customers',
  'payments',
  'marketing',
  'reviews',
  'one-link',
  'directory-listings',
  'mobile-app',
  'pos',
  'notifications',
  'settings',
]

export const ADMIN_NAV_PREFETCH = [
  'platform-admin',
  'platform-customers',
  'platform-account-approve',
  'platform-customer-onboarding',
  'platform-plans',
  'platform-notifications',
  'platform-audit',
  'platform-staff',
  'platform-professional',
  'platform-settings',
  'platform-settings-email',
  'platform-settings-payment',
  'platform-settings-google',
  'platform-settings-categories',
  'platform-settings-flags',
]

const warmed = new Set()

export function prefetchRoute(key) {
  const load = loaders[key]
  if (!load || warmed.has(key)) return Promise.resolve()
  warmed.add(key)
  return load().catch(() => {
    warmed.delete(key)
  })
}

export function prefetchNavKey(key) {
  return prefetchRoute(key)
}

export function prefetchRoutes(keys = []) {
  for (const key of keys) prefetchRoute(key)
}

/** Load one page at a time while the browser is idle, so the click does not freeze. */
export function prefetchWhenIdle(keys = []) {
  if (typeof window === 'undefined') return
  const queue = keys.filter((key) => loaders[key] && !warmed.has(key))
  const step = () => {
    const key = queue.shift()
    if (!key) return
    Promise.resolve(prefetchRoute(key)).finally(() => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(step, { timeout: 1200 })
      } else {
        window.setTimeout(step, 80)
      }
    })
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(step, { timeout: 800 })
  } else {
    window.setTimeout(step, 200)
  }
}
