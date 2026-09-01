import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import { deriveAccentShades, DEFAULT_ACCENT } from '../../lib/accentColor'
import './DigitalBusinessCard.css'

const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')

const THEME_COLORS = {
  lime: { accent: '#8dc63f', dark: '#7ab52f' },
  charcoal: { accent: '#26282a', dark: '#141516' },
  olive: { accent: '#5f8f5a', dark: '#4d7549' },
}

function DigitalBusinessCard() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [activeNav, setActiveNav] = useState('digital-business-card')
  const [theme, setTheme] = useState('lime')
  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
  const [card, setCard] = useState({
    name: currentUser?.name || '',
    role: '',
    phone: '',
    email: currentUser?.email || '',
    website: '',
    insta: '',
    address: '',
  })

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        setRestaurantStatus(restaurant.status)
        if (restaurant.settings?.adminAccentColor) setAccentColor(restaurant.settings.adminAccentColor)

        setCard((prev) => ({
          ...prev,
          role: `Owner · ${restaurant.name || 'Your restaurant'}`,
          phone: restaurant.phone || prev.phone,
          website: restaurant.website || prev.website,
          address: restaurant.address || prev.address,
        }))
      })
      .catch(() => {})
  }, [])
const accentStyle = deriveAccentShades(accentColor)

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const cardSlug = slugify(restaurantName || currentUser?.name || 'your-card')
  const cardLink = `iroas.link/${cardSlug}`

  const updateField = (field) => (event) => {
    setCard((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleNavClick = (item) => {
    setActiveNav(item.key)
    setProfileOpen(false)
    if (item.route) {
      navigate(item.route)
    } else {
      alert(`${item.label} — coming soon in this demo.`)
    }
  }

  const handleDownload = () => {
    alert('Downloading card as PNG… (demo — export isn\'t wired up to a real image renderer yet.)')
  }

  const handleShare = () => {
    navigator.clipboard
      .writeText(`https://${cardLink}`)
      .then(() => alert(`Share link copied: ${cardLink}`))
      .catch(() => alert(`Share link: ${cardLink}`))
  }

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const colors = THEME_COLORS[theme]

  return (
    <div
      className={`business-card-page ${theme === 'charcoal' ? 'theme-charcoal' : ''}`}
      style={{ '--accent': colors.accent, '--accent-dark': colors.dark, ...accentStyle }}
    >
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="brand">
            <img src="/images/Logo9-1 1.svg" alt="Logo" style={{ height: 24 }} />
          </div>

          <div
            className="store-switcher"
            onClick={() => alert('Switch restaurant — coming soon in this demo.')}
          >
            <div className="avatar">{displayRestaurant.charAt(0).toUpperCase()}</div>
            <div className="meta">
              <div className="name">{displayRestaurant}</div>
              <div className="sub">
                {restaurantStatus === 'live' ? 'Live' : 'Onboarding'}
              </div>
            </div>
            <div className="chev">▾</div>
          </div>

          <nav className="nav-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>

              {group.items.map((item) => (
                <div
                  className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                  key={item.key}
                  onClick={() => handleNavClick(item)}
                >
                  <span className="ico">
                    <img src={item.icon} alt="" />
                  </span>
                  {item.label}
                  {item.badge && <span className="badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
          </nav>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <div className="search">
              🔍 Search orders, menu items, customers... <kbd>⌘ K</kbd>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => alert('Quick actions — coming soon in this demo.')}
            >
              + Quick action
            </button>
            <div
              className="icon-btn"
              onClick={() => alert('No new notifications.')}
            >
              🔔<span className="dot"></span>
            </div>
            <div className="profile-wrapper">
              <div className="profile" onClick={() => setProfileOpen((prev) => !prev)}>
                <div className="avatar">
                  {(currentUser?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="meta">
                  <div className="name">{currentUser?.name || 'Owner'}</div>
                  <div className="role">Owner</div>
                </div>
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
                  Your card lives at <code>{cardLink}</code>. Anyone who
                  scans the QR can save you to contacts, call, or open your
                  menu in one tap.
                </span>
              </div>
            </section>

            {/* LIVE PREVIEW */}
            <section>
              <div className="preview-label">LIVE PREVIEW</div>

              <div className="preview-card">
                <div className="preview-header">
                  <div className="store">{displayRestaurant.toUpperCase()}</div>
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
                    <span className="link">{cardLink}</span>
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
