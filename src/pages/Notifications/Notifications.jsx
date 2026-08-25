import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import './Notifications.css'

const FEED = [
  { icon: '📦', type: 'Orders', title: 'New delivery order #10428', meta: '₹2,480 · 4 items · Bandra West · pay online (captured)', time: 'just now', unread: true },
  { icon: '📅', type: 'Bookings', title: 'Table booked for 7:30 pm', meta: 'Rhea Menon · 4 guests · anniversary note added', time: '6 min ago', unread: true },
  { icon: '⚠', type: 'Inventory', title: 'Low stock: Tiger prawns', meta: '2.1 kg left · covers about 6 more orders', time: '22 min ago', unread: true },
  { icon: '💳', type: 'Payments', title: 'Refund processed', meta: '₹540 returned to Card ••08 for order #10411', time: '1 hr ago' },
  { icon: '⭐', type: 'Reviews', title: 'New 5★ Google review', meta: '"The galouti kebab is unreal." — Aditya S.', time: '2 hr ago' },
  { icon: '👥', type: 'Staff', title: 'Shift swap requested', meta: 'Imran wants to swap Fri dinner with Neha', time: '3 hr ago' },
  { icon: '📦', type: 'Orders', title: 'Order #10420 completed', meta: 'Dine-in · Table 07 · ₹1,240 · 38 min turnaround', time: '4 hr ago' },
  { icon: '📅', type: 'Bookings', title: 'Booking cancelled', meta: 'Party of 6 at 9 pm cancelled by guest', time: '5 hr ago' },
]

const FILTERS = ['All', 'Orders', 'Bookings', 'Payments', 'Reviews', 'Inventory', 'Staff']

const TODAY_VOLUME = [
  { label: 'Orders', count: 42 },
  { label: 'Bookings', count: 11 },
  { label: 'Payments', count: 38 },
  { label: 'Stock alerts', count: 3 },
]

const ROUTING = [
  { event: 'New orders', email: true, sms: true, push: true },
  { event: 'Order cancelled / refunded', email: true, sms: false, push: true },
  { event: 'New reservation', email: true, sms: true, push: true },
  { event: 'Low stock alerts', email: false, sms: false, push: true },
  { event: 'New review', email: true, sms: false, push: false },
  { event: 'Daily summary', email: true, sms: false, push: false },
]

function Notifications() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [filter, setFilter] = useState('All')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [feed, setFeed] = useState(FEED)
  const [routing, setRouting] = useState(ROUTING)

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
    }).catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const unreadCount = feed.filter((f) => f.unread).length

  const filtered = feed.filter((f) => {
    if (unreadOnly && !f.unread) return false
    if (filter === 'All') return true
    return f.type === filter
  })

  const markAllRead = () => setFeed((prev) => prev.map((f) => ({ ...f, unread: false })))
  const toggleRoute = (event, channel) => {
    setRouting((prev) => prev.map((r) => (r.event === event ? { ...r, [channel]: !r[channel] } : r)))
  }

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="notifications-page">
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'notifications' ? 'active' : ''}`}
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
              <button className="icon-btn" type="button" aria-label="Notifications">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V13L20 17H4L6 13V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                {unreadCount > 0 && <span className="dot"></span>}
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
                <h1>Notifications</h1>
                <p className="page-desc">A single inbox for orders, bookings, payments, reviews and stock — with per-channel routing.</p>
              </div>
              <button className="btn btn-outline" type="button" onClick={markAllRead}>✓ Mark all read</button>
            </div>

            <div className="two-col">
              <section className="card feed-card">
                <div className="filter-row">
                  {FILTERS.map((f) => (
                    <button key={f} type="button" className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                  ))}
                  <label className="unread-toggle">
                    <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
                    Unread only ({unreadCount})
                  </label>
                </div>

                <ul className="feed-list">
                  {filtered.map((f, i) => (
                    <li key={i} className={f.unread ? 'unread' : ''}>
                      <span className="feed-ico">{f.icon}</span>
                      <div className="feed-main">
                        <strong>{f.title}{f.unread && <span className="unread-dot" />}</strong>
                        <p>{f.meta}</p>
                      </div>
                      <span className="feed-time">{f.time}</span>
                    </li>
                  ))}
                  {filtered.length === 0 && <p className="empty-note">Nothing here.</p>}
                </ul>
              </section>

              <div className="side-col">
                <section className="card">
                  <h2>Today</h2>
                  <span className="muted-note">Alert volume by type</span>
                  <ul className="volume-list">
                    {TODAY_VOLUME.map((v) => (
                      <li key={v.label}><span>{v.label}</span><strong>{v.count}</strong></li>
                    ))}
                  </ul>
                </section>

                <section className="card">
                  <h2>Routing</h2>
                  <span className="muted-note">Where each alert is delivered</span>
                  <div className="routing-table">
                    <div className="routing-head">
                      <span>Event</span><span>Email</span><span>SMS</span><span>Push</span>
                    </div>
                    {routing.map((r) => (
                      <div className="routing-row" key={r.event}>
                        <span>{r.event}</span>
                        {['email', 'sms', 'push'].map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            className={`route-check ${r[ch] ? 'on' : ''}`}
                            onClick={() => toggleRoute(r.event, ch)}
                          >
                            {r[ch] ? '✓' : ''}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>

                <div className="quiet-note">
                  🔕 Quiet hours are on from <strong>1:00 am – 8:00 am</strong>. Only urgent order and payment failures break through.
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Notifications
