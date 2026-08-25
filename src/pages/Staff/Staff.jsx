import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import './Staff.css'

const ROLES = ['Owner', 'Manager', 'Chef', 'Cashier', 'Waiter', 'Kitchen Staff']

const DIRECTORY = [
  { initials: 'KM', name: 'Karan Mehta', role: 'Head Chef', hours: '12:00 – 23:00', attendance: 96, rating: 4.8, status: 'On floor', dot: 'green' },
  { initials: 'PS', name: 'Priya Shah', role: 'Server', hours: '17:00 – 23:30', attendance: 92, rating: 4.6, status: 'Serving T-12', dot: 'blue' },
  { initials: 'DI', name: 'Dev Iyer', role: 'Server', hours: '17:00 – 23:30', attendance: 88, rating: 4.3, status: 'On break', dot: 'yellow' },
  { initials: 'AR', name: 'Anita Rao', role: 'Cashier', hours: '10:00 – 19:00', attendance: 99, rating: 4.9, status: 'At POS', dot: 'green' },
  { initials: 'RV', name: 'Rahul Verma', role: 'Kitchen', hours: '10:00 – 19:00', attendance: 81, rating: 4.1, status: 'Off shift', dot: 'gray' },
  { initials: 'SK', name: 'Sneha K.', role: 'Manager', hours: '12:00 – 23:30', attendance: 97, rating: 4.7, status: 'Floor walk', dot: 'blue' },
]

function Staff() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [activeRole, setActiveRole] = useState('Owner')
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
    }).catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const filtered = DIRECTORY.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="staff-page">
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'staff' ? 'active' : ''}`}
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
                <p className="eyebrow">People</p>
                <h1>Staff</h1>
                <p className="page-desc">Directory, roles, schedules and performance for every team member.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => alert('Invite member — coming soon in this demo.')}>+ Invite member</button>
            </div>

            <div className="stat-cards">
              <div className="stat-card"><span>Total staff</span><strong>{DIRECTORY.length * 4}</strong></div>
              <div className="stat-card"><span>On shift now</span><strong>{DIRECTORY.filter((p) => p.dot !== 'gray').length}</strong></div>
              <div className="stat-card"><span>Avg. attendance</span><strong>{Math.round(DIRECTORY.reduce((s, p) => s + p.attendance, 0) / DIRECTORY.length)}%</strong></div>
              <div className="stat-card"><span>Avg. rating</span><strong>{(DIRECTORY.reduce((s, p) => s + p.rating, 0) / DIRECTORY.length).toFixed(1)} ★</strong></div>
            </div>

            <div className="card roles-card">
              <h2>Roles</h2>
              <span className="muted-note">Tap a role to edit permissions</span>
              <div className="role-chips">
                {ROLES.map((r) => (
                  <button key={r} type="button" className={`chip ${activeRole === r ? 'active' : ''}`}
                    onClick={() => setActiveRole(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="card directory-card">
              <div className="directory-head">
                <div>
                  <h2>Directory</h2>
                  <span className="muted-note">{filtered.length} of {DIRECTORY.length} shown</span>
                </div>
                <input className="directory-search" type="text" placeholder="Search staff..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>

              <ul className="staff-list">
                {filtered.map((p) => (
                  <li key={p.name}>
                    <span className="staff-avatar">{p.initials}</span>
                    <div className="staff-main">
                      <strong>{p.name}</strong>
                      <p>{p.role}</p>
                    </div>
                    <div className="staff-hours">{p.hours}</div>
                    <div className="staff-metric">{p.attendance}%</div>
                    <div className="staff-metric rating">{p.rating} ★</div>
                    <div className="staff-status"><span className={`status-dot ${p.dot}`} />{p.status}</div>
                  </li>
                ))}
                {filtered.length === 0 && <p className="empty-note">No staff match your search.</p>}
              </ul>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Staff
