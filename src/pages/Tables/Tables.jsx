import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import './Tables.css'

const INITIAL_TABLES = [
  { id: 'T-01', seats: 2, status: 'available' },
  { id: 'T-02', seats: 2, status: 'available', note: '32m' },
  { id: 'T-03', seats: 4, status: 'reserved', note: '8:45' },
  { id: 'T-04', seats: 6, status: 'available', note: '1h 12m' },
  { id: 'T-05', seats: 4, status: 'available', note: '18m' },
  { id: 'T-06', seats: 2, status: 'occupied' },
  { id: 'T-07', seats: 2, status: 'available' },
  { id: 'T-08', seats: 2, status: 'reserved', note: '7:30' },
  { id: 'T-09', seats: 4, status: 'available', note: '44m' },
  { id: 'T-10', seats: 4, status: 'out' },
  { id: 'T-11', seats: 2, status: 'reserved', note: '9:15' },
  { id: 'T-12', seats: 8, status: 'available', note: '2h 04m' },
  { id: 'T-13', seats: 4, status: 'available' },
  { id: 'T-14', seats: 2, status: 'available' },
  { id: 'T-15', seats: 6, status: 'reserved', note: '8:00' },
]

const STATUS_LABEL = { available: 'Available', occupied: 'Occupied', reserved: 'Reserved', out: 'Out of service' }

function Tables() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [tables, setTables] = useState(INITIAL_TABLES)
  const [selected, setSelected] = useState([])

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
    }).catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'

  const counts = tables.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

  const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0)

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const cycleStatus = (id) => {
    const order = ['available', 'occupied', 'reserved', 'cleaning', 'out']
    setTables((prev) => prev.map((t) => {
      if (t.id !== id) return t
      const idx = order.indexOf(t.status)
      const next = order[(idx + 1) % order.length]
      return { ...t, status: next }
    }))
  }

  const handleMerge = () => {
    if (selected.length < 2) { alert('Select 2 or more tables to merge.'); return }
    alert(`Merged ${selected.join(', ')} — demo only.`)
    setSelected([])
  }

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="tables-page">
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'tables' ? 'active' : ''}`}
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
                <p className="eyebrow">Floor plan</p>
                <h1>Tables</h1>
                <p className="page-desc">Live view of your floor. Click a table to cycle status, select multiple to merge.</p>
              </div>
              <div className="head-actions">
                <button className="btn btn-outline" type="button" onClick={handleMerge}>⤴ Merge{selected.length > 0 ? ` (${selected.length})` : ''}</button>
                <button className="btn btn-outline" type="button" onClick={() => alert('Split — coming soon in this demo.')}>⤳ Split</button>
                <button className="btn btn-primary" type="button" onClick={() => alert('Add table — coming soon in this demo.')}>+ Add table</button>
              </div>
            </div>

            <div className="status-cards">
              <div className="status-card"><span className="dot available" /> Available<strong>{counts.available || 0}</strong></div>
              <div className="status-card"><span className="dot occupied" /> Occupied<strong>{counts.occupied || 0}</strong></div>
              <div className="status-card"><span className="dot reserved" /> Reserved<strong>{counts.reserved || 0}</strong></div>
              <div className="status-card"><span className="dot cleaning" /> Cleaning<strong>{counts.cleaning || 0}</strong></div>
              <div className="status-card"><span className="dot out" /> Out of service<strong>{counts.out || 0}</strong></div>
            </div>

            <div className="card floor-card">
              <div className="floor-head">
                <div>
                  <h2>Main hall</h2>
                  <span className="muted-note">{totalSeats} seats · Live occupancy · click to cycle status, shift-click to select</span>
                </div>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => alert('Auto-seat — coming soon in this demo.')}>⚡ Auto-seat</button>
              </div>

              <div className="floor-plan">
                {tables.map((t) => (
                  <div
                    key={t.id}
                    className={`table-cell ${t.status} ${selected.includes(t.id) ? 'selected' : ''}`}
                    onClick={(e) => (e.shiftKey ? toggleSelect(t.id) : cycleStatus(t.id))}
                    title={`${STATUS_LABEL[t.status]} — click to change, shift+click to select`}
                  >
                    <strong>{t.id}</strong>
                    <span>{t.seats} seats</span>
                    {t.note && <small>{t.note}</small>}
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Tables
