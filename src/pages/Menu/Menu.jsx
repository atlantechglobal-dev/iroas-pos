import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import { deriveAccentShades, DEFAULT_ACCENT } from '../../lib/accentColor'
import './Menu.css'

const CATEGORIES = [
  { name: 'Starters', items: 12, status: 'Live', tint: 'tint-green' },
  { name: 'Mains', items: 24, status: 'Live', tint: 'tint-blue' },
  { name: 'Wood-fired Pizza', items: 9, status: 'Live', tint: 'tint-peach' },
  { name: 'Desserts', items: 7, status: 'Live', tint: 'tint-mint' },
  { name: 'Beverages', items: 18, status: 'Live', tint: 'tint-lime' },
  { name: 'Seasonal', items: 4, status: 'Draft', tint: 'tint-gray' },
]

const MAINS_ITEMS = [
  { name: 'Truffle Mushroom Risotto', price: '₹480', desc: 'Carnaroli rice, black truffle, parmesan crisp', prep: '18 min', stock: 'In stock', veg: true, tag: 'Chef', tagIcon: '🔥' },
  { name: 'Wood-Fired Margherita', price: '₹350', desc: 'San marzano tomato, fior di latte, basil', prep: '12 min', stock: 'In stock', veg: true, tag: 'Best', tagIcon: '⭐' },
  { name: 'Saffron Butter Chicken', price: '₹550', desc: 'Tandoor chicken, saffron tomato cream, fenugreek', prep: '20 min', stock: 'Low (3)', veg: false, tag: 'Chef', tagIcon: '🔥' },
  { name: 'Burrata & Heirloom Tomato', price: '₹400', desc: 'Apulian burrata, basil oil, sourdough', prep: '8 min', stock: 'In stock', veg: true, tag: 'Best', tagIcon: '⭐' },
]

const FILTERS = ['All', 'Veg', 'Non-veg', "Chef's special", 'Best seller']

function Menu() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
        if (restaurant.settings?.adminAccentColor) setAccentColor(restaurant.settings.adminAccentColor)
    }).catch(() => {})
  }, [])
const accentStyle = deriveAccentShades(accentColor)

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'

  const filteredItems = MAINS_ITEMS.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.trim().toLowerCase())
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Veg' && item.veg) ||
      (filter === 'Non-veg' && !item.veg) ||
      (filter === "Chef's special" && item.tag === 'Chef') ||
      (filter === 'Best seller' && item.tag === 'Best')
    return matchesQuery && matchesFilter
  })

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="menu-page" style={accentStyle}>
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'menu' ? 'active' : ''}`}
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
                <p className="eyebrow">Menu management</p>
                <h1>Menu</h1>
                <p className="page-desc">Organize categories, items, modifiers and availability. Drag to reorder. Publish updates instantly across channels.</p>
              </div>
              <div className="head-actions">
                <button className="btn btn-outline" type="button" onClick={() => alert('Preview — coming soon in this demo.')}>👁 Preview</button>
                <button className="btn btn-primary" type="button" onClick={() => alert('New item — coming soon in this demo.')}>+ New item</button>
              </div>
            </div>

            <div className="toolbar card">
              <div className="search-bar toolbar-search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                <input type="text" placeholder="Search items, descriptions, tags..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="filter-chips">
                {FILTERS.map((f) => (
                  <button key={f} type="button" className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
                <button className="chip filter-btn" type="button" onClick={() => alert('Filters — coming soon in this demo.')}>▤ Filters</button>
              </div>
            </div>

            <div className="section-head">
              <h2>Categories</h2>
              <button className="link-btn" type="button" onClick={() => alert('New category — coming soon in this demo.')}>+ New category</button>
            </div>

            <div className="category-grid">
              {CATEGORIES.map((cat) => (
                <div className="category-card" key={cat.name}>
                  <div className={`category-image ${cat.tint}`}>
                    <span className={`status-pill ${cat.status === 'Live' ? 'live' : 'draft'}`}>{cat.status}</span>
                  </div>
                  <div className="category-body">
                    <strong>{cat.name}</strong>
                    <small>{cat.items} items</small>
                    <div className="category-actions">
                      <button type="button" onClick={() => alert(`Edit ${cat.name} — coming soon in this demo.`)}>Edit</button>
                      <button type="button" className="icon-only" onClick={() => alert('Duplicate — coming soon in this demo.')}>⧉</button>
                      <button type="button" className="icon-only" onClick={() => alert('More options — coming soon in this demo.')}>⋯</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-head">
              <h2>Mains · {MAINS_ITEMS.length} items</h2>
              <span className="muted-note">Drag to reorder</span>
            </div>

            <div className="item-grid">
              {filteredItems.map((item) => (
                <div className="item-card" key={item.name}>
                  <div className="item-image">
                    <span className={`veg-dot ${item.veg ? 'veg' : 'nonveg'}`}>{item.veg ? '🟢' : '🔴'}</span>
                    <span className="item-tag">{item.tagIcon} {item.tag}</span>
                  </div>
                  <div className="item-body">
                    <div className="item-top"><strong>{item.name}</strong><span>{item.price}</span></div>
                    <p>{item.desc}</p>
                    <div className="item-foot">
                      <span>⏱ {item.prep}</span>
                      <span className={`stock-pill ${item.stock.startsWith('Low') ? 'low' : 'in'}`}>{item.stock}</span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && <p className="empty-note">No items match your search.</p>}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Menu
