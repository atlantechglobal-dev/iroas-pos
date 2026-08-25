import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import './PlatformAdmin.css'

const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '/images/dashboard.svg' },
      {
        key: 'restaurant-profile',
        label: 'Restaurant Profile',
        icon: '/images/rest.svg',
      },
      {
        key: 'branding',
        label: 'Branding',
        icon: '/images/black.branding.svg',
      },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { key: 'menu', label: 'Menu', icon: '/images/blackmenu.svg' },
      {
        key: 'incoming-orders',
        label: 'Incoming Orders',
        icon: '/images/incoming.svg',
        badge: '12',
      },
      {
        key: 'reservations',
        label: 'Reservations',
        icon: '/images/breserve.svg',
      },
      { key: 'tables', label: 'Tables', icon: '/images/tabs.svg' },
      { key: 'staff', label: 'Staff', icon: '/images/stafb.svg' },
      { key: 'customers', label: 'Customers', icon: '/images/cust.svg' },
      {
        key: 'role-permissions',
        label: 'Role Permissions',
        icon: '/images/role key.svg',
      },
    ],
  },
  {
    label: 'GROWTH',
    items: [
      { key: 'analytics', label: 'Analytics', icon: '/images/analy.png' },
      { key: 'payments', label: 'Payments', icon: '/images/payments.svg' },
      { key: 'marketing', label: 'Marketing', icon: '/images/market.svg' },
      { key: 'reviews', label: 'Reviews', icon: '/images/breview.svg' },
      {
        key: 'one-link',
        label: 'One Link',
        icon: '/images/one link.svg',
        route: '/one-link',
      },
      {
        key: 'directory-listings',
        label: 'Directory Listings',
        icon: '/images/directory.svg',
        route: '/directory-listings',
      },
      {
        key: 'digital-business-card',
        label: 'Digital Business Card',
        icon: '/images/digicard.svg',
        route: '/digital-business-card',
      },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { key: 'pos', label: 'POS Integration', icon: '/images/pos.svg' },
      {
        key: 'notifications',
        label: 'Notifications',
        icon: '/images/noti.svg',
      },
      { key: 'settings', label: 'Settings', icon: '/images/settings.svg' },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      {
        key: 'platform-admin',
        label: 'Platform Admin',
        icon: '/images/platad.svg',
        route: '/platform-admin',
      },
    ],
  },
]

const INITIAL_FLAGS = [
  {
    key: 'kds_v2',
    description: 'New kitchen display layout · 38% of tenants',
    enabled: true,
  },
  {
    key: 'ai_menu_copy',
    description: 'AI-written dish descriptions · Beta cohort',
    enabled: true,
  },
  {
    key: 'table_merge',
    description: 'Merge & split tables on the floor · All tenants',
    enabled: true,
  },
  {
    key: 'loyalty_wallet',
    description: 'Stored-value customer wallet · Internal only',
    enabled: false,
  },
  {
    key: 'whatsapp_alerts',
    description: 'Order updates over WhatsApp · 12% of tenants',
    enabled: false,
  },
]

const SYSTEM_HEALTH = [
  { label: 'API', status: 'p95 128 ms · 0 errors', dot: 'green' },
  { label: 'Order pipeline', status: 'queue depth 4', dot: 'green' },
  {
    label: 'Payments webhook',
    status: '1 retry in last hour',
    dot: 'green',
  },
  { label: 'POS bridge', status: '1 tenant degraded', dot: 'yellow' },
]

const AUDIT_LOG = [
  {
    text: 'Suspended tenant Kaapi Club',
    meta: 'you@iroas.io · 12 min ago',
  },
  {
    text: 'Enabled flag ai_menu_copy for Bao Republic',
    meta: 'ops@iroas.io · 2 hr ago',
  },
  {
    text: 'Upgraded Nomad Pizzeria to Growth',
    meta: 'you@iroas.io · yesterday',
  },
  {
    text: 'Issued credit note ₹1,999 to Coast & Co.',
    meta: 'billing@iroas.io · 2 days ago',
  },
]

const STATUS_CLASS = {
  live: 'active-status',
  onboarding: 'trial-status',
}

const STATUS_LABEL = {
  live: 'Active',
  onboarding: 'Onboarding',
}

function PlatformAdmin() {
  const navigate = useNavigate()
  const admin = getStoredUser()

  const [activeNav, setActiveNav] = useState('platform-admin')
  const [tenantSearch, setTenantSearch] = useState('')
  const [flags, setFlags] = useState(INITIAL_FLAGS)
  const [tenants, setTenants] = useState([])
  const [stats, setStats] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)

  const loadTenants = (search = '') => {
    api
      .adminTenants(search)
      .then(({ tenants }) => setTenants(tenants))
      .catch(() => setTenants([]))
  }

  useEffect(() => {
    loadTenants()
    api
      .adminStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => loadTenants(tenantSearch), 250)
    return () => clearTimeout(handle)
  }, [tenantSearch])

  const handleNavClick = (item) => {
    setActiveNav(item.key)
    setProfileOpen(false)
    if (item.route) {
      navigate(item.route)
    } else {
      alert(`${item.label} — coming soon in this demo.`)
    }
  }

  const toggleFlag = (key) => {
    setFlags((prev) =>
      prev.map((flag) =>
        flag.key === key ? { ...flag, enabled: !flag.enabled } : flag,
      ),
    )
  }

  const handleImpersonate = (name) => {
    alert(`Impersonating ${name}`)
  }

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const STATS = stats
    ? [
        { title: '▣   Active tenants', number: stats.activeTenants, small: 'currently live' },
        { title: '⌁   Onboarding', number: stats.onboardingTenants, small: 'in setup' },
        { title: '♧   Total tenants', number: stats.totalTenants, small: 'all time' },
      ]
    : []

  return (
    <div className="platform-admin-page">
      <div className="app">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar">
          <div className="logo-area">
            <img
              src="/images/Logo9-1 1.svg"
              alt="IROAS"
              className="iroas-logo"
            />
          </div>

          <div className="restaurant-box">
            <div className="restaurant-avatar">
              <img src="/images/Logo9-1 1.svg" alt="icon" />
            </div>

            <div className="restaurant-info">
              <div className="restaurant-name">IROAS Platform</div>
              <div className="restaurant-status">
                {stats ? `${stats.totalTenants} tenants` : 'All tenants'}
              </div>
            </div>
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="section-title">{group.label}</div>

              {group.items.map((item) => (
                <div
                  className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                  key={item.key}
                  onClick={() => handleNavClick(item)}
                >
                  <span className="plain-icon">
                    <img src={item.icon} alt="icon" />
                  </span>
                  <span>{item.label}</span>
                  {item.badge && <span className="badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          {/* TOP SEARCH */}
          <div className="top-bar">
            <div className="search-box">
              <span>Search orders, menu items, customers...</span>
              <span className="shortcut">⌘ K</span>
            </div>

            <div className="top-actions">
              <button
                className="quick-action"
                onClick={() => alert('Quick action clicked')}
              >
                + Quick action
              </button>

              <button
                className="notification"
                onClick={() => alert('No new notifications.')}
              >
                <img src="/images/bell.svg" alt="icon" />
              </button>

              <div className="profile-wrapper">
                <div className="profile" onClick={() => setProfileOpen((prev) => !prev)}>
                  <div className="profile-circle">
                    {(admin?.name || 'A').charAt(0).toUpperCase()}
                  </div>

                  <div className="profile-text">
                    <strong>{admin?.name || 'Admin'}</strong>
                    <small>Platform Admin</small>
                  </div>

                  <span>⌄</span>
                </div>

                {profileOpen && (
                  <>
                    <div className="menu-overlay" onClick={() => setProfileOpen(false)} />
                    <div className="profile-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false)
                          alert('Account settings — coming soon in this demo.')
                        }}
                      >
                        Settings
                      </button>
                      <button type="button" className="danger" onClick={handleLogout}>
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* PAGE HEADER */}
          <div className="page-header">
            <div>
              <div className="page-label">PLATFORM</div>

              <h1>Platform Admin</h1>

              <p>
                Operator-only view across every restaurant on IROAS: tenants,
                plans, feature rollout and system health.
              </p>
            </div>

            <button
              className="new-tenant"
              onClick={() => alert('New tenant clicked')}
            >
              <img src="/images/new.svg" alt="New tenant" />
              <span>New tenant</span>
            </button>
          </div>

          {/* STAT CARDS */}
          <div className="stats-grid">
            {STATS.map((stat) => (
              <div className="stat-card" key={stat.title}>
                <div className="stat-title">{stat.title}</div>
                <div className="stat-number">{stat.number}</div>
                <div className="stat-small">{stat.small}</div>
              </div>
            ))}
          </div>

          {/* TENANTS */}
          <section className="tenants-card">
            <div className="card-header">
              <div>
                <h2>Tenants</h2>
                <span>{tenants.length} shown</span>
              </div>

              <input
                type="text"
                placeholder="Search tenants..."
                value={tenantSearch}
                onChange={(event) => setTenantSearch(event.target.value)}
              />
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>RESTAURANT</th>
                    <th>OWNER</th>
                    <th>PLAN</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>
                        <strong>{tenant.name || 'Untitled restaurant'}</strong>
                        <small>{tenant.city || 'No city set'}</small>
                      </td>
                      <td>
                        <strong>{tenant.owner_name}</strong>
                        <small>{tenant.owner_email}</small>
                      </td>
                      <td>{tenant.plan}</td>
                      <td>
                        <span className={`status ${STATUS_CLASS[tenant.status]}`}>
                          {STATUS_LABEL[tenant.status]}
                        </span>
                      </td>
                      <td>
                        <button
                          className="impersonate"
                          onClick={() => handleImpersonate(tenant.name || tenant.owner_name)}
                        >
                          Impersonate
                        </button>
                      </td>
                    </tr>
                  ))}

                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
                        No tenants match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* BOTTOM */}
          <div className="bottom-grid">
            {/* FEATURE FLAGS */}
            <section className="feature-card">
              <div className="feature-header">
                <h2>Feature flags</h2>
                <span>Gradual rollout across tenants</span>
              </div>

              {flags.map((flag) => (
                <div className="feature-row" key={flag.key}>
                  <div className="flag-icon">⚑</div>

                  <div className="feature-info">
                    <strong>{flag.key}</strong>
                    <small>{flag.description}</small>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={flag.enabled}
                      onChange={() => toggleFlag(flag.key)}
                    />
                    <span></span>
                  </label>
                </div>
              ))}
            </section>

            {/* RIGHT COLUMN */}
            <div className="right-column">
              {/* SYSTEM HEALTH */}
              <div className="side-card system-health">
                <h2>System health</h2>

                {SYSTEM_HEALTH.map((item) => (
                  <div className="health-item" key={item.label}>
                    <div className="health-left">
                      <img
                        src="/images/db.svg"
                        className="health-icon"
                        alt=""
                      />
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.status}</p>
                      </div>
                    </div>
                    <span className={`status-dot ${item.dot}`}></span>
                  </div>
                ))}
              </div>

              {/* AUDIT TRAIL */}
              <section className="small-card audit-card">
                <h2>Audit trail</h2>
                <p>Operator actions</p>

                {AUDIT_LOG.map((entry) => (
                  <div className="audit-item" key={entry.text}>
                    <img src="/images/audit.svg" alt="icon" />
                    <div>
                      <strong>{entry.text}</strong>
                      <small>{entry.meta}</small>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default PlatformAdmin
