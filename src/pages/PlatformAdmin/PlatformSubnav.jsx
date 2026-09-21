import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'

const LINKS = [
  { to: ROUTES.PLATFORM_ADMIN, label: 'Dashboard', key: 'platform-admin' },
  { to: ROUTES.PLATFORM_CUSTOMERS, label: 'Customers', key: 'platform-customers' },
  { to: ROUTES.PLATFORM_APPROVE, label: 'Approve', key: 'platform-approve' },
  {
    to: ROUTES.PLATFORM_CUSTOMER_ONBOARDING,
    label: 'Onboarding',
    key: 'platform-customer-onboarding',
  },
  { to: ROUTES.PLATFORM_PLANS, label: 'Plans', key: 'platform-plans' },
  { to: ROUTES.PLATFORM_IDENTITIES, label: 'Identities', key: 'platform-identities' },
  { to: ROUTES.PLATFORM_PRODUCTS, label: 'Products', key: 'platform-products' },
  { to: ROUTES.PLATFORM_SETTINGS, label: 'Settings', key: 'platform-settings' },
]

export function PlatformSubnav({ active }) {
  return (
    <nav className="pa-subnav" aria-label="Platform sections">
      {LINKS.map((link) => (
        <Link
          key={link.key}
          to={link.to}
          className={
            active === link.key ||
            (link.key === 'platform-settings' &&
              String(active || '').startsWith('platform-settings'))
              ? 'is-active'
              : undefined
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
