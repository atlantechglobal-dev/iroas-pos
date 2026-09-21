import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { ROUTES } from '../../constants/routes.js'
import { PlatformSubnav } from './PlatformSubnav.jsx'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

const CARDS = [
  {
    to: ROUTES.PLATFORM_SETTINGS_EMAIL,
    title: 'Email settings',
    desc: 'ZeptoMail / SMTP · welcome, approve & detail emails',
  },
  {
    to: ROUTES.PLATFORM_SETTINGS_PAYMENT,
    title: 'Payment settings',
    desc: 'AddPay credentials for onboarding launch payment',
  },
  {
    to: ROUTES.PLATFORM_SETTINGS_FLAGS,
    title: 'Feature flags',
    desc: 'Gradual rollout toggles across all tenants',
  },
  {
    to: ROUTES.PLATFORM_PLANS,
    title: 'Plans catalog',
    desc: 'Starter, Growth & Enterprise launch packages',
  },
  {
    to: ROUTES.PLATFORM_STAFF,
    title: 'Platform staff',
    desc: 'Invite and manage super admin accounts',
  },
  {
    to: ROUTES.PLATFORM_AUDIT,
    title: 'Audit log',
    desc: 'Operator actions across the platform',
  },
]

function PlatformSettings() {
  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-settings"
      variant="admin"
      adminSubtitle="Platform settings"
    >
      <div className="page-header">
        <div>
          <div className="page-label">SETTINGS</div>
          <h1>Platform settings</h1>
          <p>Global configuration for email, payments, flags, and operator access.</p>
        </div>
      </div>

      <PlatformSubnav active="platform-settings" />

      <div className="pa-quick-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {CARDS.map((card) => (
          <Link key={card.to} className="pa-quick-card" to={card.to}>
            <strong>{card.title}</strong>
            <span>{card.desc}</span>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  )
}

export default PlatformSettings
