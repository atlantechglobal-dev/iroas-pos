import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import './DirectoryListings.css'

const NAV_GROUPS = [
  {
    label: 'Overview',
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
    label: 'Operations',
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
    label: 'Growth',
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
    label: 'System',
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
    label: 'Platform',
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

const DIRECTORIES = [
  {
    name: 'Google Business Profile',
    meta: 'Verified · 4.7★ (1,204)',
    views: '18.4k',
    updated: 'Updated 2 hours ago',
    status: 'live',
    action: 'View',
  },
  {
    name: 'Zomato',
    meta: 'Claimed · 4.4★ (862)',
    views: '9.1k',
    updated: 'Updated Yesterday',
    status: 'live',
    action: 'View',
  },
  {
    name: 'Swiggy',
    meta: 'Menu prices out of sync (6 items)',
    views: '7.6k',
    updated: 'Updated 4 days ago',
    status: 'attention',
    action: 'Fix now',
  },
  {
    name: 'Apple Maps',
    meta: 'Verification postcard in transit',
    views: '1.2k',
    updated: 'Updated 6 days ago',
    status: 'pending',
    action: 'View',
  },
  {
    name: 'TripAdvisor',
    meta: 'Claimed · 4.5★ (318)',
    views: '2.3k',
    updated: 'Updated 3 days ago',
    status: 'live',
    action: 'View',
  },
  {
    name: 'Facebook Page',
    meta: 'Opening hours differ from profile',
    views: '4.0k',
    updated: 'Updated 1 week ago',
    status: 'attention',
    action: 'Fix now',
  },
  {
    name: 'Bing Places',
    meta: 'Submitted, awaiting review',
    views: '410',
    updated: 'Updated 2 weeks ago',
    status: 'pending',
    action: 'View',
  },
  {
    name: 'Justdial',
    meta: 'Claimed · phone verified',
    views: '1.8k',
    updated: 'Updated 5 days ago',
    status: 'live',
    action: 'View',
  },
]

const STATUS_LABEL = {
  live: 'Live',
  pending: 'Pending',
  attention: 'Needs attention',
}

function DirectoryListings() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [activeNav, setActiveNav] = useState('directory-listings')
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantCity, setRestaurantCity] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        if (restaurant.city) setRestaurantCity(restaurant.city)
        setRestaurantStatus(restaurant.status)
      })
      .catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const restaurantSubtitle = [
    restaurantCity.trim(),
    restaurantStatus === 'live' ? 'Live' : 'Onboarding',
  ]
    .filter(Boolean)
    .join(' · ')

  const handleLogout = () => {
    clearSession()
    navigate('/login')
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

  const handleSync = () => {
    alert('Syncing all directories… this demo is not connected to a real listings provider yet.')
  }

  const handleAction = (name) => {
    alert(`${name} — coming soon in this demo.`)
  }

  const filteredDirectories = DIRECTORIES.filter((directory) =>
    directory.name.toLowerCase().includes(directoryQuery.trim().toLowerCase()),
  )

  return (
    <div className="directory-page">
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="brand">
            <img src="/images/Logo9-1 1.svg" alt="logo" />
          </div>

          <button
            className="restaurant-switch"
            type="button"
            onClick={() => alert('Switch restaurant — coming soon in this demo.')}
          >
            <span className="avatar-badge">
              {displayRestaurant.charAt(0).toUpperCase()}
            </span>
            <span className="restaurant-info">
              <strong>{displayRestaurant}</strong>
              <small>{restaurantSubtitle || 'Onboarding'}</small>
            </span>
            <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <nav className="nav">
            {NAV_GROUPS.map((group) => (
              <div className="nav-group" key={group.label}>
                <p className="nav-label">{group.label}</p>

                {group.items.map((item) => (
                  <a
                    href="#top"
                    key={item.key}
                    className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                    onClick={(event) => {
                      event.preventDefault()
                      handleNavClick(item)
                    }}
                  >
                    <img src={item.icon} alt={item.label} />
                    {item.label}
                    {item.badge && <span className="badge">{item.badge}</span>}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* MAIN */}
        <div className="main">
          {/* TOPBAR */}
          <header className="topbar">
            <div className="search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Search orders, menu items, customers..." />
              <span className="kbd">⌘ K</span>
            </div>

            <div className="topbar-actions">
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => alert('Quick actions — coming soon in this demo.')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                Quick action
              </button>

              <button
                className="icon-btn"
                type="button"
                aria-label="Notifications"
                onClick={() => alert('No new notifications.')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6 8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V13L20 17H4L6 13V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span className="dot"></span>
              </button>

              <div className="user-chip-wrapper">
                <button
                  className="user-chip"
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                >
                  <span className="avatar-dark">
                    {(currentUser?.name || 'A').charAt(0).toUpperCase()}
                  </span>
                  <span className="user-info">
                    <strong>{currentUser?.name || 'Owner'}</strong>
                    <small>Owner</small>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

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
          </header>

          {/* CONTENT */}
          <main className="content" id="top">
            <div className="page-head">
              <div>
                <p className="eyebrow">Growth</p>
                <h1>Directory Listings</h1>
                <p className="page-desc">
                  One profile, everywhere. Track accuracy of your name,
                  address, hours and menu across every major directory.
                </p>
              </div>

              <button className="btn btn-primary" type="button" onClick={handleSync}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12C4 7.58172 7.58172 4 12 4C15.0808 4 17.7461 5.78325 19.0429 8.4M20 12C20 16.4183 16.4183 20 12 20C8.91924 20 6.25392 18.2167 4.95712 15.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M19 4V8.5H14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 20V15.5H9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sync all
              </button>
            </div>

            <div className="stat-cards">
              <div className="stat-card">
                <span className="pill pill-green">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Live
                </span>
                <div className="stat-number">4</div>
                <p className="stat-sub">of 8 directories</p>
              </div>

              <div className="stat-card">
                <span className="pill pill-yellow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Pending
                </span>
                <div className="stat-number">2</div>
                <p className="stat-sub">of 8 directories</p>
              </div>

              <div className="stat-card">
                <span className="pill pill-red">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="16.3" r="1" fill="currentColor" />
                  </svg>
                  Needs attention
                </span>
                <div className="stat-number">2</div>
                <p className="stat-sub">of 8 directories</p>
              </div>
            </div>

            <div className="directory-panel">
              <div className="directory-toolbar">
                <div className="search-bar search-bar-muted">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search directories..."
                    value={directoryQuery}
                    onChange={(event) => setDirectoryQuery(event.target.value)}
                  />
                </div>

                <span className="sync-note">Last full sync · today 06:40</span>
              </div>

              <ul className="directory-list">
                {filteredDirectories.map((directory) => (
                  <li className="directory-row" key={directory.name}>
                    <div className="directory-main">
                      <strong>{directory.name}</strong>
                      <p>{directory.meta}</p>
                    </div>

                    <div className="directory-metric">
                      <strong>{directory.views}</strong> monthly views
                    </div>

                    <div className="directory-updated">{directory.updated}</div>

                    <span className={`status status-${directory.status}`}>
                      {STATUS_LABEL[directory.status]}
                    </span>

                    <button
                      className="btn btn-outline btn-xs"
                      type="button"
                      onClick={() => handleAction(directory.name)}
                    >
                      {directory.action}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M14 3H21V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 14V19C19 20.1046 18.1046 21 17 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default DirectoryListings
