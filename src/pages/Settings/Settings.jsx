import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { MESSAGES } from '../../constants/messages.js'
import { ROUTES } from '../../constants/routes.js'
import './Settings.css'

function Settings() {
  const navigate = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()

  const sections = [
    {
      label: 'Restaurant',
      items: [
        { icon: '🏬', title: 'Restaurant settings', desc: 'Hours, channels, ordering rules', route: '/restaurant-profile' },
        { icon: '👥', title: 'Users & permissions', desc: 'Roles, invitations, access logs', route: '/settings/users' },
        { icon: '💳', title: 'Billing & plan', desc: 'Pro plan · ₹4,999 / month', route: '/settings/billing' },
      ],
    },
    {
      label: 'Platform',
      items: [
        ...(isAdmin
          ? [
              {
                icon: '✉️',
                title: 'Email settings',
                desc: 'ZeptoMail API · welcome, approve & detail emails',
                route: ROUTES.SETTINGS_EMAIL,
              },
              {
                icon: '💰',
                title: 'Payment settings',
                desc: 'AddPay credentials for onboarding launch payment',
                route: ROUTES.SETTINGS_PAYMENT,
              },
            ]
          : []),
        { icon: '🔌', title: 'Integrations', desc: 'Zomato, Swiggy, accounting, KOT printers', route: '/pos-integration' },
        { icon: '🔔', title: 'Notifications', desc: 'Routes for orders, low stock, reviews', route: '/notifications' },
        { icon: '🛡', title: 'Security', desc: '2FA, IP allowlist, session policy', route: '/settings/security' },
        { icon: '🔑', title: 'API keys', desc: 'For developer integrations', route: '/settings/api-keys' },
      ],
    },
    {
      label: 'Data & compliance',
      items: [
        { icon: '🗄', title: 'Backup & restore', desc: 'Automatic daily snapshots', route: '/settings/backup' },
        { icon: '📋', title: 'Audit logs', desc: 'Every action, every user', route: '/settings/audit' },
        { icon: '🔏', title: 'Data privacy', desc: 'GDPR & DPDP requests', route: '/settings/privacy' },
      ],
    },
  ]

  const handleTileClick = (item) => {
    if (item.route) navigate(item.route)
    else toast.info(MESSAGES.COMING_SOON(item.title))
  }

  return (
    <DashboardLayout pageClassName="settings-page" activeNav="settings">
      <div className="page-head">
        <div>
          <p className="eyebrow">System</p>
          <h1>Settings</h1>
          <p className="page-desc">
            Configure every corner of IROAS for your operation. Everything here is workspace-wide.
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.label} className="settings-section">
          <p className="section-label">{section.label}</p>
          <div className="settings-grid">
            {section.items.map((item) => (
              <button
                key={item.title}
                type="button"
                className="settings-tile"
                onClick={() => handleTileClick(item)}
              >
                <span className="tile-ico">{item.icon}</span>
                <span className="tile-text">
                  <strong>{item.title}</strong>
                  <small>{item.desc}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </DashboardLayout>
  )
}

export default Settings
