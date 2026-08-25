import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import './OneLink.css'

const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')

const NAV_GROUPS = [
  {
    heading: 'OVERVIEW',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: '/images/dashboard.svg',
        route: '/dashboard',
      },
      {
        key: 'restaurant-profile',
        label: 'Restaurant Profile',
        icon: '/images/rest.svg',
        route: '/restaurant-profile',
      },
      {
        key: 'branding',
        label: 'Branding',
        icon: '/images/black.branding.svg',
      },
    ],
  },
  {
    heading: 'OPERATIONS',
    items: [
      { key: 'menu', label: 'Menu', icon: '/images/blackmenu.svg' },
      {
        key: 'incoming-orders',
        label: 'Incoming Orders',
        icon: '/images/incoming.svg',
        notification: '12',
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
    heading: 'GROWTH',
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
    heading: 'SYSTEM',
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
    heading: 'PLATFORM',
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

const INITIAL_DESTINATIONS = [
  {
    key: 'website',
    icon: '/images/website icon.svg',
    name: 'Website',
    meta: 'Full restaurant website · /site',
    clicks: '4,210 clicks',
    live: true,
  },
  {
    key: 'menu',
    icon: '/images/menu.png',
    name: 'Digital Menu',
    meta: 'Live menu with prices · /site/menu',
    clicks: '9,814 clicks',
    live: true,
  },
  {
    key: 'order',
    icon: '/images/order online.png',
    name: 'Order Online',
    meta: 'Delivery & takeaway · /site/menu',
    clicks: '6,402 clicks',
    live: true,
  },
  {
    key: 'book',
    icon: '/images/table book.png',
    name: 'Book a Table',
    meta: 'Live availability · /site/book',
    clicks: '2,311 clicks',
    live: true,
  },
  {
    key: 'review',
    icon: '/images/review.svg',
    name: 'Leave a Review',
    meta: 'Google reviews · https://g.page/saffronfig/review',
    clicks: '872 clicks',
    live: true,
  },
  {
    key: 'instagram',
    icon: '/images/instagram.svg',
    name: 'Instagram',
    meta: '@saffronandfig · https://instagram.com/saffronandfig',
    clicks: '512 clicks',
    live: false,
  },
  {
    key: 'directions',
    icon: '/images/direction.svg',
    name: 'Directions',
    meta: '17 Pali Hill, Bandra W · https://maps.google.com',
    clicks: '1,490 clicks',
    live: true,
  },
  {
    key: 'call',
    icon: '/images/call.svg',
    name: 'Call Restaurant',
    meta: '+91 98200 11223 · tel:+919820011223',
    clicks: '331 clicks',
    live: false,
  },
]

const THEMES = ['Lime (Brand)', 'Charcoal', 'Ivory']

function OneLink() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const [activeNav, setActiveNav] = useState('one-link')
  const [destinations, setDestinations] = useState(INITIAL_DESTINATIONS)
  const [theme, setTheme] = useState(THEMES[0])
  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [publishLabel, setPublishLabel] = useState('✓  Publish changes')

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        setRestaurantStatus(restaurant.status)
      })
      .catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const linkSlug = slugify(restaurantName || currentUser?.name || 'your-link')
  const oneLink = `iroas.link/${linkSlug}`

  const handleNavClick = (item) => {
    setActiveNav(item.key)
    setProfileOpen(false)
    if (item.route) {
      navigate(item.route)
    } else {
      alert(`${item.label} — coming soon in this demo.`)
    }
  }

  const toggleDestination = (key) => {
    setDestinations((prev) =>
      prev.map((destination) =>
        destination.key === key
          ? { ...destination, live: !destination.live }
          : destination,
      ),
    )
  }

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(`https://${oneLink}`)
      .then(() => alert('Link copied!'))
      .catch(() => alert('Unable to copy link.'))
  }

  const handlePublish = () => {
    setPublishLabel('✓ Published')
    setTimeout(() => setPublishLabel('✓  Publish changes'), 2000)
  }

  const handleDownloadQR = async () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(
      `https://${oneLink}`,
    )}`

    try {
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${linkSlug}-QR.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(qrUrl, '_blank')
    }
  }

  const handleAddCustomLink = () => {
    setDestinations((prev) => [
      ...prev,
      {
        key: `custom-${prev.length}`,
        icon: '/images/domain.png',
        name: 'Custom Link',
        meta: 'Custom destination link',
        clicks: '0 clicks',
        live: true,
      },
    ])
  }

  const handlePreviewScroll = () => {
    document
      .querySelector('.one-link-page .preview-card')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const liveDestinations = destinations.filter((d) => d.live)

  return (
    <div className="one-link-page">
      <div className="app">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar">
          <div className="logo-area">
            <img src="/images/Logo9-1 1.svg" alt="IROAS Logo" />
          </div>

          <div
            className="restaurant-box"
            onClick={() => alert('Switch restaurant — coming soon in this demo.')}
          >
            <div className="restaurant-symbol">
              {displayRestaurant.charAt(0).toUpperCase()}
            </div>

            <div className="restaurant-details">
              <strong>{displayRestaurant}</strong>
              <span>{restaurantStatus === 'live' ? 'Live' : 'Onboarding'}</span>
            </div>

            <span className="restaurant-arrow">
              <img src="/images/upd.svg" alt="icon" />
            </span>
          </div>

          <nav>
            {NAV_GROUPS.map((group) => (
              <div key={group.heading}>
                <div className="nav-heading">{group.heading}</div>

                {group.items.map((item) => (
                  <div
                    className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                    key={item.key}
                    onClick={() => handleNavClick(item)}
                  >
                    <span className="nav-icon">
                      <img src={item.icon} alt="icon" />
                    </span>
                    <span>{item.label}</span>
                    {item.notification && (
                      <b className="notification">{item.notification}</b>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main">
          {/* TOP BAR */}
          <header className="topbar">
            <div className="search-box">
              <span className="search-icon">⌕</span>
              <input type="text" placeholder="Search orders, menu items, customers..." />
              <span className="search-shortcut">⌘ K</span>
            </div>

            <div className="top-right">
              <button className="quick-action" onClick={() => alert('Quick action menu opened.')}>
                + Quick action
              </button>

              <button
                className="notification-button"
                onClick={() => alert('No new notifications.')}
              >
                <img src="/images/bell.svg" alt="Notifications" />
              </button>

              <div className="profile-wrapper">
                <div className="profile" onClick={() => setProfileOpen((prev) => !prev)}>
                  <div className="profile-image">
                    {(currentUser?.name || 'A').charAt(0).toUpperCase()}
                  </div>

                  <div className="profile-details">
                    <strong>{currentUser?.name || 'Owner'}</strong>
                    <small>Owner</small>
                  </div>

                  <span className="profile-arrow">⌄</span>
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
          </header>

          {/* PAGE CONTENT */}
          <section className="page">
            <div className="page-title">
              <div className="heading-text">
                <div className="growth-label">GROWTH</div>

                <h1>One Link</h1>

                <p>
                  One shareable link for every restaurant destination —
                  website, menu, ordering, bookings and socials.
                  <br />
                  Put it in your bio, on receipts and on table cards.
                </p>
              </div>

              <div className="title-buttons">
                <button className="download-qr" onClick={handleDownloadQR}>
                  <img src="/images/down.png" alt="" />
                  Download QR
                </button>

                <button className="publish-button" onClick={handlePublish}>
                  {publishLabel}
                </button>
              </div>
            </div>

            <div className="dashboard-grid">
              {/* LEFT COLUMN */}
              <div className="left-column">
                {/* YOUR LINK CARD */}
                <div className="card link-card">
                  <div className="card-title">
                    <img src="/images/domain.png" alt="" />
                    <strong>Your link</strong>
                  </div>

                  <div className="link-row">
                    <div className="link-field">
                      iroas.link/<strong>{linkSlug}</strong>
                    </div>

                    <button className="small-button" onClick={handleCopyLink}>
                      <img src="/images/copy.svg" alt="Copy" />
                      <span>Copy</span>
                    </button>

                    <button className="small-button" onClick={handlePreviewScroll}>
                      <img src="/images/eyee.svg" alt="Preview" />
                      <span>Preview</span>
                    </button>
                  </div>

                  <div className="available">This link is available.</div>

                  <div className="stats">
                    <div className="stat-box">
                      <span>Total views</span>
                      <strong>18,204</strong>
                    </div>

                    <div className="stat-box">
                      <span>Link clicks (30d)</span>
                      <strong>9,842</strong>
                    </div>

                    <div className="stat-box">
                      <span>Click-through</span>
                      <strong>54%</strong>
                    </div>
                  </div>
                </div>

                {/* DESTINATIONS CARD */}
                <div className="card destinations-card">
                  <div className="destinations-header">
                    <div>
                      <h2>Destinations</h2>
                      <p>Toggle what appears, drag to reorder</p>
                    </div>

                    <button className="add-link" onClick={handleAddCustomLink}>
                      + Add custom link
                    </button>
                  </div>

                  <div className="destination-list">
                    {destinations.map((destination) => (
                      <div className="destination" key={destination.key}>
                        <span className="drag">⠿</span>

                        <div className="destination-icon">
                          <img src={destination.icon} alt={destination.name} />
                        </div>

                        <div className="destination-content">
                          <div className="destination-name">
                            {destination.name}
                            <span className={destination.live ? 'live' : 'hidden'}>
                              {destination.live ? 'Live' : 'Hidden'}
                            </span>
                          </div>

                          <small>{destination.meta}</small>
                        </div>

                        <span className="click-number">{destination.clicks}</span>

                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={destination.live}
                            onChange={() => toggleDestination(destination.key)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* APPEARANCE & SEO */}
                <div className="card appearance-card">
                  <h2>Appearance & SEO</h2>

                  <div className="input-grid">
                    <div className="input-group">
                      <label>Page headline</label>
                      <input type="text" defaultValue="Saffron & Fig · Bandra West" />
                    </div>

                    <div className="input-group">
                      <label>Sub headline</label>
                      <input type="text" defaultValue="Modern Indian, served slowly" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Meta description</label>
                    <input type="text" defaultValue="Order, book a table or browse our menu." />
                  </div>

                  <div className="theme-buttons">
                    {THEMES.map((themeName) => (
                      <button
                        key={themeName}
                        className={`theme ${theme === themeName ? 'active' : ''}`}
                        onClick={() => setTheme(themeName)}
                      >
                        {themeName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE — LIVE PREVIEW */}
              <div className="preview-card">
                <h2>Live preview</h2>

                <div className="phone">
                  <div className="phone-screen">
                    <div className="preview-logo">
                      <div className="preview-circle">
                        {displayRestaurant.charAt(0).toUpperCase()}
                      </div>
                      <strong>{displayRestaurant}</strong>
                      <span>{oneLink}</span>
                    </div>

                    <div className="preview-links">
                      {liveDestinations.map((destination) => (
                        <div className="preview-link" key={destination.key}>
                          <div className="preview-link-icon">
                            <img src={destination.icon} alt="" />
                          </div>

                          <span>{destination.name}</span>

                          <img
                            src="/images/arrow.svg"
                            className="external-icon"
                            alt=""
                          />
                        </div>
                      ))}
                    </div>

                    <div className="powered">Powered by IROAS</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default OneLink
