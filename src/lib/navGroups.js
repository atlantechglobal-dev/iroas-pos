export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '/images/dashboard.svg', route: '/dashboard' },
      { key: 'restaurant-profile', label: 'Restaurant Profile', icon: '/images/rest.svg', route: '/restaurant-profile' },
      { key: 'branding', label: 'Branding', icon: '/images/black.branding.svg', route: '/brand' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'menu', label: 'Menu', icon: '/images/blackmenu.svg', route: '/menu' },
      { key: 'incoming-orders', label: 'Incoming Orders', icon: '/images/incoming.svg', route: '/orders', badge: '12' },
      { key: 'reservations', label: 'Reservations', icon: '/images/breserve.svg', route: '/reservations' },
      { key: 'tables', label: 'Tables', icon: '/images/tabs.svg', route: '/tables' },
      { key: 'staff', label: 'Staff', icon: '/images/stafb.svg', route: '/staff' },
      { key: 'customers', label: 'Customers', icon: '/images/cust.svg' },
      { key: 'role-permissions', label: 'Role Permissions', icon: '/images/role key.svg' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { key: 'analytics', label: 'Analytics', icon: '/images/analy.png', route: '/analytics' },
      { key: 'payments', label: 'Payments', icon: '/images/payments.svg', route: '/payments' },
      { key: 'marketing', label: 'Marketing', icon: '/images/market.svg', route: '/marketing' },
      { key: 'reviews', label: 'Reviews', icon: '/images/breview.svg', route: '/reviews' },
      { key: 'one-link', label: 'One Link', icon: '/images/one link.svg', route: '/one-link' },
      { key: 'directory-listings', label: 'Directory Listings', icon: '/images/directory.svg', route: '/directory-listings' },
      { key: 'digital-business-card', label: 'Digital Business Card', icon: '/images/digicard.svg', route: '/digital-business-card' },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'pos', label: 'POS Integration', icon: '/images/pos.svg', route: '/pos-integration' },
      { key: 'notifications', label: 'Notifications', icon: '/images/noti.svg', route: '/notifications' },
      { key: 'settings', label: 'Settings', icon: '/images/settings.svg', route: '/settings' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { key: 'platform-admin', label: 'Platform Admin', icon: '/images/platad.svg', route: '/platform-admin' },
    ],
  },
]
