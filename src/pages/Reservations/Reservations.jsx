import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import './Reservations.css'

const TIMELINE_HOURS = ['6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00']

const TIMELINE_ROWS = [
  { table: 'T-03', name: 'Vikram P. · 4', start: 2, span: 1, tint: 'pending' },
  { table: 'T-08', name: 'Aditi & Rohan · 2', start: 3, span: 1, tint: 'confirmed' },
  { table: 'T-11', name: 'Sara L. · 2', start: 7, span: 1, tint: 'pending' },
  { table: 'T-15', name: 'Khanna · 6', start: 4, span: 1, tint: 'confirmed' },
  { table: 'T-19', name: 'Walk-in · 3', start: 1, span: 1, tint: 'confirmed' },
]

const UPCOMING = [
  { name: 'Aditi & Rohan', party: 2, meta: '+91 98xxxxxx21 · Anniversary cake', time: '7:30 PM', table: 'T-08', status: 'Confirmed' },
  { name: 'Khanna family', party: 6, meta: '+91 98xxxxxx44 · High chair needed', time: '8:00 PM', table: 'T-15', status: 'Confirmed' },
  { name: 'Vikram P.', party: 4, meta: '+91 98xxxxxx07 · Window seat', time: '8:45 PM', table: 'T-03', status: 'Pending' },
  { name: 'Sara L.', party: 2, meta: '+91 98xxxxxx99 · —', time: '9:15 PM', table: 'T-11', status: 'Confirmed' },
]

const VIEWS = ['Calendar', 'Timeline', 'List']

function Reservations() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [view, setView] = useState('Timeline')
  const [reservations, setReservations] = useState(UPCOMING)

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
    }).catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const arrivingSoon = reservations.filter((r) => r.status === 'Confirmed').length

  const confirmReservation = (name) => {
    setReservations((prev) => prev.map((r) => (r.name === name ? { ...r, status: 'Confirmed' } : r)))
  }

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="reservations-page">
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'reservations' ? 'active' : ''}`}
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
                <p className="eyebrow">Front of house</p>
                <h1>Reservations</h1>
                <p className="page-desc">Manage bookings across calendar, timeline and list. Auto-confirm, send reminders and assign tables.</p>
              </div>
              <div className="head-actions">
                <div className="view-toggle">
                  {VIEWS.map((v) => (
                    <button key={v} type="button" className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v}</button>
                  ))}
                </div>
                <button className="btn btn-primary" type="button" onClick={() => alert('New booking — coming soon in this demo.')}>+ New booking</button>
              </div>
            </div>

            {view === 'Timeline' && (
              <div className="card timeline-card">
                <h2>Tonight's timeline</h2>
                <span className="muted-note">Sun · 6:00 – 10:30 PM</span>

                <div className="timeline-grid">
                  <div className="timeline-header">
                    <div className="timeline-corner" />
                    {TIMELINE_HOURS.map((h) => <div key={h} className="timeline-hour">{h}</div>)}
                  </div>
                  {TIMELINE_ROWS.map((row) => (
                    <div className="timeline-row" key={row.table}>
                      <div className="timeline-label">{row.table}</div>
                      <div className="timeline-track" style={{ gridTemplateColumns: `repeat(${TIMELINE_HOURS.length}, 1fr)` }}>
                        <div className={`timeline-block ${row.tint}`} style={{ gridColumn: `${row.start} / span ${row.span}` }}>
                          {row.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'Calendar' && (
              <div className="card">
                <h2>Calendar</h2>
                <p className="muted-note">Full calendar view — coming soon in this demo.</p>
              </div>
            )}

            <div className="card upcoming-card">
              <h2>Upcoming reservations</h2>
              <span className="muted-note">{arrivingSoon} of {reservations.length} confirmed · click to assign table, confirm or message</span>

              <ul className="reservation-list">
                {reservations.map((r) => (
                  <li key={r.name}>
                    <span className="party-count">{r.party}</span>
                    <div className="reservation-main">
                      <strong>{r.name}</strong>
                      <p>{r.meta}</p>
                    </div>
                    <div className="reservation-time">
                      <strong>{r.time}</strong>
                      <small>{r.table}</small>
                    </div>
                    <span className={`status-pill ${r.status === 'Confirmed' ? 'confirmed' : 'pending'}`}>{r.status}</span>
                    <button
                      className="manage-btn"
                      type="button"
                      onClick={() => r.status === 'Pending' ? confirmReservation(r.name) : alert(`Manage ${r.name} — coming soon in this demo.`)}
                    >
                      {r.status === 'Pending' ? 'Confirm' : 'Manage'}
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

export default Reservations
