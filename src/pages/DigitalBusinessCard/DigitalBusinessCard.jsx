import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredUser, clearSession } from '../../lib/api'
import './DigitalBusinessCard.css'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: '<rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="11" width="6.5" height="6.5" rx="1.2"/>',
      },
      {
        key: 'restaurant-profile',
        label: 'Restaurant Profile',
        icon: '<path d="M3 8 L4 3 H16 L17 8"/><path d="M3 8 V17 H17 V8"/><path d="M3 8 H17"/><rect x="8" y="12" width="4" height="5"/>',
      },
      {
        key: 'branding',
        label: 'Branding',
        icon: '<path d="M10 2.5c-4.1 0-7.5 3.2-7.5 7.2 0 2.9 2 4.3 3.8 4.3.9 0 1.2-.5 1.2-1 0-.4-.3-.8-.3-1.4 0-1.5 1.4-2.6 3.2-2.6 2.7 0 4.6-1.7 4.6-4 0-2.5-2.3-4.5-5-4.5Z"/><circle cx="6.3" cy="8.7" r=".9" fill="currentColor" stroke="none"/><circle cx="9.3" cy="6.2" r=".9" fill="currentColor" stroke="none"/><circle cx="13" cy="7.4" r=".9" fill="currentColor" stroke="none"/>',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        key: 'menu',
        label: 'Menu',
        icon: '<path d="M3 3 L17 17"/><path d="M17 3 L3 17"/><circle cx="5" cy="5" r="2"/><circle cx="5" cy="15" r="2"/>',
      },
      {
        key: 'incoming-orders',
        label: 'Incoming Orders',
        badge: '12',
        icon: '<rect x="4" y="3" width="12" height="15" rx="1.4"/><rect x="7.5" y="1.5" width="5" height="3" rx="1"/><path d="M7 8 H13 M7 11 H13 M7 14 H10.5"/>',
      },
      {
        key: 'reservations',
        label: 'Reservations',
        icon: '<rect x="2.5" y="3.5" width="15" height="14" rx="1.4"/><path d="M2.5 7.5 H17.5"/><path d="M6 2 V5 M14 2 V5"/>',
      },
      {
        key: 'tables',
        label: 'Tables',
        icon: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.4"/><path d="M2.5 9 H17.5 M10 4.5 V15.5"/>',
      },
      {
        key: 'staff',
        label: 'Staff',
        icon: '<circle cx="10" cy="6.5" r="3.2"/><path d="M3.5 17c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/>',
      },
      {
        key: 'customers',
        label: 'Customers',
        icon: '<circle cx="7.2" cy="6.5" r="2.6"/><circle cx="13.6" cy="7.3" r="2.1"/><path d="M2.3 17c0-2.9 2.2-5.2 4.9-5.2s4.9 2.3 4.9 5.2"/><path d="M12.7 12.3c2 .3 3.6 2.2 3.6 4.5"/>',
      },
      {
        key: 'role-permissions',
        label: 'Role Permissions',
        icon: '<circle cx="6.5" cy="13.5" r="3.3"/><path d="M8.8 11.2 15.5 4.5 M13 7 14.6 8.6 M15.2 4.8 17 6.6"/>',
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        key: 'analytics',
        label: 'Analytics',
        icon: '<path d="M3 17 V11 M8 17 V6 M13 17 V9 M17.5 17 V3"/>',
      },
      {
        key: 'payments',
        label: 'Payments',
        icon: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.6"/><path d="M2.5 8 H17.5"/>',
      },
      {
        key: 'marketing',
        label: 'Marketing',
        icon: '<path d="M3 8 V12 L6 12.6 V7.4 Z"/><path d="M6 7.4 13 3.5 V16.5 L6 12.6"/><path d="M5.5 12.8 6.8 16.5 H4.7 Z"/>',
      },
      {
        key: 'reviews',
        label: 'Reviews',
        icon: '<path d="M10 2.5 12.2 7.4 17.5 8.1 13.6 11.7 14.6 17 10 14.3 5.4 17 6.4 11.7 2.5 8.1 7.8 7.4 Z"/>',
      },
      {
        key: 'one-link',
        label: 'One Link',
        route: '/one-link',
        icon: '<path d="M8.5 11.5 11.5 8.5"/><path d="M9.3 5.8 11 4.1a3 3 0 0 1 4.2 4.2l-1.7 1.7"/><path d="M10.7 14.2 9 15.9a3 3 0 0 1-4.2-4.2l1.7-1.7"/>',
      },
      {
        key: 'directory-listings',
        label: 'Directory Listings',
        route: '/directory-listings',
        icon: '<path d="M4 5 H16 M4 10 H16 M4 15 H16"/><circle cx="4" cy="5" r=".2"/>',
      },
      {
        key: 'digital-business-card',
        label: 'Digital Business Card',
        route: '/digital-business-card',
        icon: '<rect x="2.5" y="4" width="15" height="12" rx="1.6"/><circle cx="7" cy="9.2" r="1.7"/><path d="M4.5 13.6c.5-1.5 1.5-2.2 2.5-2.2s2 .7 2.5 2.2"/><path d="M12 8 H15 M12 10.5 H15"/>',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        key: 'pos',
        label: 'POS Integration',
        icon: '<path d="M7 2.5 V7 M13 2.5 V7"/><rect x="5.5" y="7" width="9" height="5" rx="1.2"/><path d="M10 12 V15.5"/><path d="M7 15.5 H13"/>',
      },
      {
        key: 'notifications',
        label: 'Notifications',
        icon: '<path d="M5 14c0-1 .8-1.2.8-3.2V9a4.2 4.2 0 0 1 8.4 0v1.8c0 2 .8 2.2.8 3.2Z"/><path d="M8.3 16.5a1.8 1.8 0 0 0 3.4 0"/>',
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: '<circle cx="10" cy="10" r="2.6"/><path d="M10 3v2M10 15v2M17 10h-2M5 10H3M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4M14.9 14.9l-1.4-1.4M6.5 6.5 5.1 5.1"/>',
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        key: 'platform-admin',
        label: 'Platform Admin',
        route: '/platform-admin',
        icon: '<path d="M10 2.3 16.5 4.7 V9.5c0 4.2-2.7 6.9-6.5 8.2-3.8-1.3-6.5-4-6.5-8.2V4.7Z"/><path d="M7.3 10 9.2 11.9 12.9 8.2"/>',
      },
    ],
  },
]

const THEME_COLORS = {
  lime: { accent: '#8dc63f', dark: '#7ab52f' },
  charcoal: { accent: '#26282a', dark: '#141516' },
  olive: { accent: '#5f8f5a', dark: '#4d7549' },
}

function DigitalBusinessCard() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const [activeNav, setActiveNav] = useState('digital-business-card')
  const [theme, setTheme] = useState('lime')
  const [card, setCard] = useState({
    name: 'Ananya Rao',
    role: 'Owner · Saffron & Fig',
    phone: '+91 98200 11223',
    email: 'ananya@saffronandfig.in',
    website: 'saffronandfig.in',
    insta: '@saffronandfig',
    address: '12 Linking Road, Bandra West, Mumbai',
  })

  const updateField = (field) => (event) => {
    setCard((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleNavClick = (item) => {
    setActiveNav(item.key)
    if (item.route) navigate(item.route)
  }

  const handleDownload = () => {
    alert('Downloading card as PNG…')
  }

  const handleShare = () => {
    alert('Share link copied: iroas.link/saffron-fig')
  }

  const colors = THEME_COLORS[theme]

  return (
    <div
      className={`business-card-page ${theme === 'charcoal' ? 'theme-charcoal' : ''}`}
      style={{ '--accent': colors.accent, '--accent-dark': colors.dark }}
    >
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="brand">
            <img src="/images/Logo9-1 1.svg" alt="Logo" style={{ height: 24 }} />
          </div>

          <div className="store-switcher">
            <div className="avatar">SF</div>
            <div className="meta">
              <div className="name">Saffron & Fig</div>
              <div className="sub">Downtown · Open</div>
            </div>
            <div className="chev">▾</div>
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>

              {group.items.map((item) => (
                <div
                  className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                  key={item.key}
                  onClick={() => handleNavClick(item)}
                >
                  <span
                    className="ico"
                    dangerouslySetInnerHTML={{
                      __html: `<svg viewBox="0 0 20 20">${item.icon}</svg>`,
                    }}
                  />
                  {item.label}
                  {item.badge && <span className="badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <div className="search">
              🔍 Search orders, menu items, customers... <kbd>⌘ K</kbd>
            </div>
            <button className="btn btn-primary">+ Quick action</button>
            <div className="icon-btn">
              🔔<span className="dot"></span>
            </div>
            <div className="profile" onClick={handleLogout} title="Click to log out">
              <div className="avatar">
                {(currentUser?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="meta">
                <div className="name">{currentUser?.name || 'Owner'}</div>
                <div className="role">Owner</div>
              </div>
            </div>
          </div>

          <div className="page-head">
            <div>
              <div className="eyebrow">GROWTH</div>
              <h1>Digital Business Card</h1>
              <p>
                A tap-to-share card for your restaurant — QR code, contact
                details and links, ready for WhatsApp, email signatures and
                print.
              </p>
            </div>

            <div className="page-actions">
              <button className="btn btn-ghost" onClick={handleDownload}>
                ⬇ Download PNG
              </button>
              <button className="btn btn-primary" onClick={handleShare}>
                ⇗ Share card
              </button>
            </div>
          </div>

          <div className="content">
            {/* FORM */}
            <section className="card">
              <h2>Card details</h2>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="f-name">Name</label>
                  <input
                    id="f-name"
                    type="text"
                    value={card.name}
                    onChange={updateField('name')}
                  />
                </div>

                <div className="field">
                  <label htmlFor="f-role">Role / restaurant</label>
                  <input
                    id="f-role"
                    type="text"
                    value={card.role}
                    onChange={updateField('role')}
                  />
                </div>

                <div className="field">
                  <label htmlFor="f-phone">Phone</label>
                  <input
                    id="f-phone"
                    type="text"
                    value={card.phone}
                    onChange={updateField('phone')}
                  />
                </div>

                <div className="field">
                  <label htmlFor="f-email">Email</label>
                  <input
                    id="f-email"
                    type="text"
                    value={card.email}
                    onChange={updateField('email')}
                  />
                </div>

                <div className="field">
                  <label htmlFor="f-website">Website</label>
                  <input
                    id="f-website"
                    type="text"
                    value={card.website}
                    onChange={updateField('website')}
                  />
                </div>

                <div className="field">
                  <label htmlFor="f-insta">Instagram</label>
                  <input
                    id="f-insta"
                    type="text"
                    value={card.insta}
                    onChange={updateField('insta')}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="f-address">Address</label>
                  <input
                    id="f-address"
                    type="text"
                    value={card.address}
                    onChange={updateField('address')}
                  />
                </div>
              </div>

              <div className="theme-block">
                <label>Theme</label>

                <div className="theme-options">
                  {Object.keys(THEME_COLORS).map((key) => (
                    <div
                      key={key}
                      className={`theme-opt ${theme === key ? 'selected' : ''}`}
                      data-theme={key}
                      onClick={() => setTheme(key)}
                    >
                      <span className="swatch"></span>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="info-note">
                <span className="ico">🪪</span>
                <span>
                  Your card lives at{' '}
                  <code>iroas.link/saffron-fig</code>. Anyone who scans the
                  QR can save you to contacts, call, or open your menu in one
                  tap.
                </span>
              </div>
            </section>

            {/* LIVE PREVIEW */}
            <section>
              <div className="preview-label">LIVE PREVIEW</div>

              <div className="preview-card">
                <div className="preview-header">
                  <div className="store">SAFFRON & FIG</div>
                  <div className="pname">{card.name}</div>
                  <div className="prole">{card.role}</div>
                </div>

                <div className="preview-body">
                  <div className="prow">
                    <span className="ico">☎</span>
                    <span>{card.phone}</span>
                  </div>
                  <div className="prow">
                    <span className="ico">✉</span>
                    <span>{card.email}</span>
                  </div>
                  <div className="prow">
                    <span className="ico">🌐</span>
                    <span>{card.website}</span>
                  </div>
                  <div className="prow">
                    <span className="ico">📷</span>
                    <span>{card.insta}</span>
                  </div>
                  <div className="prow">
                    <span className="ico">⚲</span>
                    <span>{card.address}</span>
                  </div>
                </div>

                <div className="preview-qr">
                  <div className="qr-box">
                    <svg viewBox="0 0 29 29">
                      <rect width="29" height="29" fill="#15161a" />
                      <g fill="#fff">
                        <rect x="1" y="1" width="7" height="7" />
                        <rect x="21" y="1" width="7" height="7" />
                        <rect x="1" y="21" width="7" height="7" />
                        <rect x="3" y="3" width="3" height="3" fill="#15161a" />
                        <rect x="23" y="3" width="3" height="3" fill="#15161a" />
                        <rect x="3" y="23" width="3" height="3" fill="#15161a" />
                        <rect x="10" y="1" width="1" height="1" />
                        <rect x="12" y="1" width="1" height="1" />
                        <rect x="15" y="1" width="1" height="1" />
                        <rect x="10" y="4" width="1" height="1" />
                        <rect x="13" y="4" width="1" height="1" />
                        <rect x="17" y="4" width="1" height="1" />
                        <rect x="10" y="7" width="1" height="1" />
                        <rect x="12" y="7" width="1" height="1" />
                        <rect x="14" y="7" width="1" height="1" />
                        <rect x="16" y="7" width="1" height="1" />
                        <rect x="1" y="10" width="1" height="1" />
                        <rect x="4" y="10" width="1" height="1" />
                        <rect x="10" y="10" width="1" height="1" />
                        <rect x="13" y="10" width="1" height="1" />
                        <rect x="16" y="10" width="1" height="1" />
                        <rect x="20" y="10" width="1" height="1" />
                        <rect x="24" y="10" width="1" height="1" />
                        <rect x="27" y="10" width="1" height="1" />
                        <rect x="10" y="12" width="1" height="1" />
                        <rect x="14" y="12" width="1" height="1" />
                        <rect x="18" y="12" width="1" height="1" />
                        <rect x="22" y="12" width="1" height="1" />
                        <rect x="26" y="12" width="1" height="1" />
                        <rect x="12" y="14" width="1" height="1" />
                        <rect x="15" y="14" width="1" height="1" />
                        <rect x="19" y="14" width="1" height="1" />
                        <rect x="23" y="14" width="1" height="1" />
                        <rect x="1" y="16" width="1" height="1" />
                        <rect x="5" y="16" width="1" height="1" />
                        <rect x="11" y="16" width="1" height="1" />
                        <rect x="17" y="16" width="1" height="1" />
                        <rect x="21" y="16" width="1" height="1" />
                        <rect x="25" y="16" width="1" height="1" />
                        <rect x="10" y="21" width="7" height="7" />
                        <rect x="21" y="21" width="1" height="1" />
                        <rect x="23" y="21" width="1" height="1" />
                        <rect x="25" y="21" width="1" height="1" />
                        <rect x="27" y="21" width="1" height="1" />
                        <rect x="20" y="24" width="1" height="1" />
                        <rect x="22" y="24" width="1" height="1" />
                        <rect x="26" y="24" width="1" height="1" />
                        <rect x="21" y="27" width="1" height="1" />
                        <rect x="24" y="27" width="1" height="1" />
                        <rect x="27" y="27" width="1" height="1" />
                      </g>
                    </svg>
                  </div>

                  <div className="qtext">
                    Scan to save contact, view the menu and book a table.
                    <span className="link">iroas.link/saffron-fig</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default DigitalBusinessCard
