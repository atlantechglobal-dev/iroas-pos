import { ROUTES } from '../constants/routes.js'

export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '/images/dashboard.svg', route: ROUTES.DASHBOARD },
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
      { key: 'tables', label: 'Tables', icon: '/images/tabs.svg', route: ROUTES.TABLES },
      { key: 'staff', label: 'Staff', icon: '/images/stafb.svg', route: ROUTES.STAFF },
      { key: 'customers', label: 'Customers', icon: '/images/cust.svg', route: ROUTES.CUSTOMERS },
      {
        key: 'role-permissions',
        label: 'Role Permissions',
        icon: '/images/role key.svg',
        route: ROUTES.ROLE_PERMISSIONS,
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
        key: 'digital-business-card',
        label: 'Digital Business Card',
        icon: '/images/digicard.svg',
        route: ROUTES.DIGITAL_BUSINESS_CARD,
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
  {
    label: 'Platform',
    adminOnly: true,
    items: [
      {
        key: 'platform-admin',
        label: 'Platform Admin',
        icon: '/images/platad.svg',
        route: ROUTES.PLATFORM_ADMIN,
      },
    ],
  },
]

/** Resolve sidebar active key from the current path (covers settings subpages too). */
export function getActiveNavKey(pathname) {
  if (!pathname) return null

  if (pathname === ROUTES.BRAND || pathname.startsWith(`${ROUTES.BRAND}/`)) {
    return 'branding'
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
  return NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin)
}
