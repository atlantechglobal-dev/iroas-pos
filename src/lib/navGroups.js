import { ROUTES } from '../constants/routes.js'

/** Restaurant owner / tenant sidebar */
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '/images/dashboard.svg', route: ROUTES.DASHBOARD },
      {
        key: 'digital-business-card',
        label: 'Digital Business Card',
        icon: '/images/digicard.svg',
        route: ROUTES.DIGITAL_BUSINESS_CARD,
      },
      {
        key: 'business-id',
        label: 'Business ID',
        icon: '/images/share qr.svg',
        route: ROUTES.BUSINESS_ID,
      },
      {
        key: 'restaurant-profile',
        label: 'Restaurant Profile',
        icon: '/images/rest.svg',
        route: ROUTES.RESTAURANT_PROFILE,
      },
      { key: 'branding', label: 'Branding', icon: '/images/black.branding.svg', route: ROUTES.BRAND },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'menu', label: 'Menu', icon: '/images/blackmenu.svg', route: ROUTES.MENU },
      {
        key: 'incoming-orders',
        label: 'Incoming Orders',
        icon: '/images/incoming.svg',
        route: ROUTES.ORDERS,
        badge: '12',
      },
      {
        key: 'reservations',
        label: 'Reservations',
        icon: '/images/breserve.svg',
        route: ROUTES.RESERVATIONS,
      },
      { key: 'tables', label: 'Table QR', icon: '/images/tabs.svg', route: ROUTES.TABLES },
      { key: 'staff', label: 'Staff', icon: '/images/stafb.svg', route: ROUTES.STAFF },
      { key: 'customers', label: 'Customers', icon: '/images/cust.svg', route: ROUTES.CUSTOMERS },
      {
        key: 'role-permissions',
        label: 'Role Permissions',
        icon: '/images/role key.svg',
        route: ROUTES.ROLE_PERMISSIONS,
        hidden: true,
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      { key: 'analytics', label: 'Analytics', icon: '/images/analy.png', route: ROUTES.ANALYTICS },
      { key: 'payments', label: 'Payments', icon: '/images/payments.svg', route: ROUTES.PAYMENTS },
      { key: 'marketing', label: 'Marketing', icon: '/images/market.svg', route: ROUTES.MARKETING },
      { key: 'reviews', label: 'Reviews', icon: '/images/breview.svg', route: ROUTES.REVIEWS },
      { key: 'one-link', label: 'One Link', icon: '/images/one link.svg', route: ROUTES.ONE_LINK },
      {
        key: 'directory-listings',
        label: 'Directory Listings',
        icon: '/images/directory.svg',
        route: ROUTES.DIRECTORY_LISTINGS,
      },
      {
        key: 'mobile-app',
        label: 'Mobile Application',
        icon: '/images/pos.svg',
        route: ROUTES.MOBILE_APP,
      },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'pos', label: 'POS Integration', icon: '/images/pos.svg', route: ROUTES.POS_INTEGRATION },
      {
        key: 'notifications',
        label: 'Notifications',
        icon: '/images/noti.svg',
        route: ROUTES.NOTIFICATIONS,
      },
      { key: 'settings', label: 'Settings', icon: '/images/settings.svg', route: ROUTES.SETTINGS },
    ],
  },
]

/**
 * Super admin / Platform Admin sidebar only.
 * Restaurant Overview / Operations / Growth are never shown here.
 */
export const ADMIN_NAV_GROUPS = [
  {
    label: 'Platform',
    items: [
      {
        key: 'platform-admin',
        label: 'Dashboard',
        icon: '/images/dashboard.svg',
        route: ROUTES.PLATFORM_ADMIN,
      },
      {
        key: 'platform-customers',
        label: 'Customers',
        icon: '/images/cust.svg',
        route: ROUTES.PLATFORM_CUSTOMERS,
      },
      {
        key: 'platform-account-approve',
        label: 'Account approve',
        icon: '/images/platad.svg',
        route: ROUTES.PLATFORM_ACCOUNT_APPROVE,
      },
      {
        key: 'platform-customer-onboarding',
        label: 'Customer onboarding',
        icon: '/images/directory.svg',
        route: ROUTES.PLATFORM_CUSTOMER_ONBOARDING,
      },
      {
        key: 'platform-plans',
        label: 'Plans',
        icon: '/images/payments.svg',
        route: ROUTES.PLATFORM_PLANS,
      },
      {
        key: 'platform-identities',
        label: 'Identity review',
        icon: '/images/digicard.svg',
        route: ROUTES.PLATFORM_IDENTITIES,
      },
      {
        key: 'platform-products',
        label: 'Products',
        icon: '/images/pos.svg',
        route: ROUTES.PLATFORM_PRODUCTS,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        key: 'platform-notifications',
        label: 'Notifications',
        icon: '/images/noti.svg',
        route: ROUTES.PLATFORM_NOTIFICATIONS,
      },
      {
        key: 'platform-audit',
        label: 'Audit log',
        icon: '/images/audit.svg',
        route: ROUTES.PLATFORM_AUDIT,
      },
      {
        key: 'platform-staff',
        label: 'Platform staff',
        icon: '/images/stafb.svg',
        route: ROUTES.PLATFORM_STAFF,
      },
      {
        key: 'platform-professional',
        label: 'Professional card',
        icon: '/images/digicard.svg',
        route: ROUTES.PLATFORM_PROFESSIONAL,
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        key: 'platform-settings',
        label: 'Platform settings',
        icon: '/images/settings.svg',
        route: ROUTES.PLATFORM_SETTINGS,
      },
      {
        key: 'platform-settings-email',
        label: 'Email settings',
        icon: '/images/msg.svg',
        route: ROUTES.PLATFORM_SETTINGS_EMAIL,
      },
      {
        key: 'platform-settings-payment',
        label: 'Payment settings',
        icon: '/images/lock.svg',
        route: ROUTES.PLATFORM_SETTINGS_PAYMENT,
      },
      {
        key: 'platform-settings-google',
        label: 'Google sign-in',
        icon: '/images/security.svg',
        route: ROUTES.PLATFORM_SETTINGS_GOOGLE,
      },
      {
        key: 'platform-settings-categories',
        label: 'Business categories',
        icon: '/images/tabs.svg',
        route: ROUTES.PLATFORM_SETTINGS_CATEGORIES,
      },
      {
        key: 'platform-settings-flags',
        label: 'Feature flags',
        icon: '/images/platad.svg',
        route: ROUTES.PLATFORM_SETTINGS_FLAGS,
      },
    ],
  },
]

const ADMIN_PATH_KEYS = [
  [ROUTES.PLATFORM_ADMIN, 'platform-admin', true],
  [ROUTES.PLATFORM_PLANS, 'platform-plans'],
  [ROUTES.PLATFORM_CUSTOMERS, 'platform-customers'],
  [ROUTES.PLATFORM_ACCOUNT_APPROVE, 'platform-account-approve'],
  [ROUTES.PLATFORM_APPROVE, 'platform-account-approve'],
  [ROUTES.PLATFORM_CUSTOMER_ONBOARDING, 'platform-customer-onboarding'],
  [ROUTES.PLATFORM_IDENTITIES, 'platform-identities'],
  [ROUTES.PLATFORM_PRODUCTS, 'platform-products'],
  [ROUTES.PLATFORM_NOTIFICATIONS, 'platform-notifications'],
  [ROUTES.PLATFORM_AUDIT, 'platform-audit'],
  [ROUTES.PLATFORM_STAFF, 'platform-staff'],
  [ROUTES.PLATFORM_PROFESSIONAL, 'platform-professional'],
  [ROUTES.PLATFORM_SETTINGS_EMAIL, 'platform-settings-email'],
  [ROUTES.PLATFORM_SETTINGS_PAYMENT, 'platform-settings-payment'],
  [ROUTES.PLATFORM_SETTINGS_GOOGLE, 'platform-settings-google'],
  [ROUTES.PLATFORM_SETTINGS_CATEGORIES, 'platform-settings-categories'],
  [ROUTES.PLATFORM_SETTINGS_FLAGS, 'platform-settings-flags'],
  [ROUTES.PLATFORM_SETTINGS, 'platform-settings'],
  // Legacy redirects still highlight settings
  [ROUTES.SETTINGS_EMAIL, 'platform-settings-email'],
  [ROUTES.SETTINGS_PAYMENT, 'platform-settings-payment'],
]

/** Resolve sidebar active key from the current path (covers settings subpages too). */
export function getActiveNavKey(pathname, { isAdmin = false } = {}) {
  if (!pathname) return null

  if (isAdmin) {
    for (const [route, key, exact] of ADMIN_PATH_KEYS) {
      if (exact) {
        if (pathname === route) return key
        continue
      }
      if (pathname === route || pathname.startsWith(`${route}/`)) return key
    }

    const adminItems = ADMIN_NAV_GROUPS.flatMap((group) => group.items)
    const exactAdmin = adminItems.find((item) => item.route === pathname)
    if (exactAdmin) return exactAdmin.key
    return 'platform-admin'
  }

  if (pathname === ROUTES.BRAND || pathname.startsWith(`${ROUTES.BRAND}/`)) {
    return 'branding'
  }
  if (
    pathname === ROUTES.DIGITAL_BUSINESS_CARD ||
    pathname.startsWith(`${ROUTES.DIGITAL_BUSINESS_CARD}/`)
  ) {
    return 'digital-business-card'
  }
  if (pathname === ROUTES.BUSINESS_ID || pathname.startsWith(`${ROUTES.BUSINESS_ID}/`)) {
    return 'business-id'
  }
  if (pathname === ROUTES.ORDERS || pathname.startsWith(`${ROUTES.ORDERS}/`)) {
    return 'incoming-orders'
  }
  if (pathname.startsWith(ROUTES.SETTINGS)) {
    return 'settings'
  }

  const items = NAV_GROUPS.flatMap((group) => group.items)
  const exact = items.find((item) => item.route === pathname)
  if (exact) return exact.key

  const prefixed = items
    .filter((item) => item.route !== '/' && pathname.startsWith(`${item.route}/`))
    .sort((a, b) => b.route.length - a.route.length)

  return prefixed[0]?.key || null
}

export function getNavGroupsForUser({ isAdmin = false } = {}) {
  if (isAdmin) {
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.hidden),
    })).filter((group) => group.items.length > 0)
  }

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.hidden && !item.adminOnly),
  })).filter((group) => group.items.length > 0)
}
