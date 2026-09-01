import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import { deriveAccentShades, DEFAULT_ACCENT } from '../../lib/accentColor'
import './Settings.css'

const ACCENT_PRESETS = ['#8bc53f', '#2e6fb5', '#d3453b', '#a9821a', '#7c4aa8', '#e2703a', '#1e9e8c']

const SECTIONS = [
  {
    label: 'Restaurant',
    items: [
      { icon: '🏬', title: 'Restaurant settings', desc: 'Hours, channels, ordering rules', route: '/restaurant-profile' },
      { icon: '👥', title: 'Users & permissions', desc: 'Roles, invitations, access logs' },
      { icon: '💳', title: 'Billing & plan', desc: 'Pro plan · ₹4,999 / month' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { icon: '🔌', title: 'Integrations', desc: 'Zomato, Swiggy, accounting, KOT printers', route: '/pos-integration' },
      { icon: '🔔', title: 'Notifications', desc: 'Routes for orders, low stock, reviews', route: '/notifications' },
      { icon: '🛡', title: 'Security', desc: '2FA, IP allowlist, session policy' },
      { icon: '🔑', title: 'API keys', desc: 'For developer integrations' },
    ],
  },
  {
    label: 'Data & compliance',
    items: [
      { icon: '🗄', title: 'Backup & restore', desc: 'Automatic daily snapshots' },
      { icon: '📋', title: 'Audit logs', desc: 'Every action, every user' },
      { icon: '🔏', title: 'Data privacy', desc: 'GDPR & DPDP requests' },
    ],
  },
]

function Settings() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
  const [savingAccent, setSavingAccent] = useState(false)

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
      if (restaurant.settings?.adminAccentColor) {
        setAccentColor(restaurant.settings.adminAccentColor)
      }
    }).catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const accentStyle = deriveAccentShades(accentColor)

  const saveAccentColor = async (color) => {
    setAccentColor(color)
    setSavingAccent(true)
    try {
      await api.updateSettings({ adminAccentColor: color })
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingAccent(false)
    }
  }

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }
  const handleTileClick = (item) => {
    if (item.route) navigate(item.route)
    else alert(`${item.title} — coming soon in this demo.`)
  }

  return (
    <div className="settings-page" style={accentStyle}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand"><img src="/images/Logo9-1 1.svg" alt="logo" /></div>
          <button className="restaurant-switch" type="button" onClick={() => alert('Switch restaurant — coming soon in this demo.')}>
            <span className="avatar-badge">{displayRestaurant.charAt(0).toUpperCase()}</span>
            <span className="restaurant-info">
              <strong>{displayRestaurant}</strong>
              <small>{restaurantStatus === 'live' ? 'Live' : 'Onboarding'}</small>
            </span>
            <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <nav className="nav">
            {NAV_GROUPS.map((group) => (
              <div className="nav-group" key={group.label}>
                <p className="nav-label">{group.label}</p>
                {group.items.map((item) => (
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'settings' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); handleNavClick(item) }}>
                    <img src={item.icon} alt={item.label} />
                    {item.label}
                    {item.badge && <span className="badge">{item.badge}</span>}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              <input type="text" placeholder="Search orders, menu items, customers..." />
              <span className="kbd">⌘ K</span>
            </div>
            <div className="topbar-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => alert('Quick actions — coming soon in this demo.')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                Quick action
              </button>
              <button className="icon-btn" type="button" aria-label="Notifications" onClick={() => navigate('/notifications')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V13L20 17H4L6 13V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                <span className="dot"></span>
              </button>
              <div className="user-chip-wrapper">
                <button className="user-chip" type="button" onClick={() => setProfileOpen((p) => !p)}>
                  <span className="avatar-dark">{(currentUser?.name || 'A').charAt(0).toUpperCase()}</span>
                  <span className="user-info"><strong>{currentUser?.name || 'Owner'}</strong><small>Owner</small></span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {profileOpen && (
                  <>
                    <div className="menu-overlay" onClick={() => setProfileOpen(false)} />
                    <div className="profile-menu">
                      <button type="button" onClick={() => { setProfileOpen(false); alert('Account settings — coming soon in this demo.') }}>Settings</button>
                      <button type="button" className="danger" onClick={handleLogout}>Log out</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="content" id="top">
            <div className="page-head">
              <div>
                <p className="eyebrow">System</p>
                <h1>Settings</h1>
                <p className="page-desc">Configure every corner of IROAS for your operation. Everything here is workspace-wide.</p>
              </div>
            </div>

            <div className="settings-section">
              <p className="section-label">Appearance</p>
              <div className="accent-card">
                <div className="accent-info">
                  <strong>Dashboard accent color</strong>
                  <p>Pick a color to match your brand — it updates every page in this dashboard instantly.</p>
                </div>

                <div className="accent-controls">
                  <div className="accent-presets">
                    {ACCENT_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`accent-swatch ${accentColor.toLowerCase() === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => saveAccentColor(c)}
                        aria-label={`Use ${c}`}
                      />
                    ))}
                  </div>

                  <label className="accent-custom">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => saveAccentColor(e.target.value)}
                    />
                    <span>{savingAccent ? 'Saving…' : accentColor.toUpperCase()}</span>
                  </label>
                </div>
              </div>
            </div>

            {SECTIONS.map((section) => (
              <div key={section.label} className="settings-section">
                <p className="section-label">{section.label}</p>
                <div className="settings-grid">
                  {section.items.map((item) => (
                    <button key={item.title} type="button" className="settings-tile" onClick={() => handleTileClick(item)}>
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
          </main>
        </div>
      </div>
    </div>
  )
}

export default Settings
