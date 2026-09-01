import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import { deriveAccentShades, DEFAULT_ACCENT } from '../../lib/accentColor'
import './Marketing.css'

const CAMPAIGNS = [
  { icon: '🎟', name: 'WEEKEND25', meta: 'Coupon · 25% off', status: 'Live', progress: '412 / 1000' },
  { icon: '✉', name: 'Monsoon menu launch', meta: 'Email · 4.2k recipients', status: 'Sent', progress: 'Opened 38%' },
  { icon: '💬', name: 'Booking reminder', meta: 'SMS · auto', status: 'Active', progress: '1.1k sent' },
  { icon: '📱', name: 'Friday Tapas push', meta: 'Push notification', status: 'Scheduled', progress: 'Scheduled · Fri 5 PM' },
  { icon: '🎁', name: '₹500 gift card', meta: 'Gift card', status: 'Live', progress: 'Sold 86' },
  { icon: '🏆', name: 'Fig Club Loyalty', meta: 'Loyalty · 8 pts / ₹100', status: 'Live', progress: '1,240 members' },
]

function Marketing() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
        if (restaurant.settings?.adminAccentColor) setAccentColor(restaurant.settings.adminAccentColor)
    }).catch(() => {})
  }, [])
const accentStyle = deriveAccentShades(accentColor)

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="marketing-page" style={accentStyle}>
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'marketing' ? 'active' : ''}`}
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
                <p className="eyebrow">Growth</p>
                <h1>Marketing</h1>
                <p className="page-desc">Coupons, loyalty, gift cards and campaigns across email, SMS and push — launch in minutes.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => alert('New campaign — coming soon in this demo.')}>+ New campaign</button>
            </div>

            <div className="suggestion-card">
              <span className="suggestion-icon">✦</span>
              <div className="suggestion-body">
                <strong>Smart suggestion</strong>
                <p>Tuesdays are 31% slower than weekends. Try a 20% lunch offer for loyalty members.</p>
              </div>
              <button className="btn btn-dark" type="button" onClick={() => alert('Create offer — coming soon in this demo.')}>Create offer</button>
            </div>

            <div className="section-head">
              <h2>Active campaigns</h2>
              <span className="muted-note">Across all channels</span>
            </div>

            <div className="campaign-grid">
              {CAMPAIGNS.map((c) => (
                <div className="campaign-card" key={c.name}>
                  <div className="campaign-top">
                    <span className="campaign-icon">{c.icon}</span>
                    <span className={`status-pill status-${c.status.toLowerCase()}`}>{c.status}</span>
                  </div>
                  <strong>{c.name}</strong>
                  <p>{c.meta}</p>
                  <div className="campaign-foot">
                    <span>{c.progress}</span>
                    <button type="button" onClick={() => alert(`Manage ${c.name} — coming soon in this demo.`)}>Manage</button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Marketing
