import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import './Orders.css'

const INITIAL_COLUMNS = [
  {
    key: 'new', label: 'New', tint: 'blue',
    orders: [
      { id: '#10428', meta: 'Table 12 · Riya M.', items: ['2x Margherita', '1x Risotto', '2x Lemonade'], total: '₹2,480', time: '2 min', high: true },
      { id: '#10429', meta: 'Pickup · Aman G.', items: ['1x Butter chicken', '2x Naan'], total: '₹820', time: '30 sec' },
    ],
  },
  {
    key: 'accepted', label: 'Accepted', tint: 'green',
    orders: [
      { id: '#10424', meta: 'Delivery · Zomato', items: ['5x Mixed grill platter'], total: '₹2,180', time: '18 min' },
    ],
  },
  {
    key: 'preparing', label: 'Preparing', tint: 'yellow',
    orders: [
      { id: '#10422', meta: 'Table 04', items: ['6x Tapas selection'], total: '₹4,120', time: '6 min left' },
      { id: '#10421', meta: 'Delivery · Swiggy', items: ['2x Pasta arrabiata'], total: '₹720', time: '3 min left' },
    ],
  },
  {
    key: 'ready', label: 'Ready', tint: 'green',
    orders: [
      { id: '#10419', meta: 'Pickup · Arjun S.', items: ['2x Pizza slice'], total: '₹860', time: '14 min' },
    ],
  },
  {
    key: 'completed', label: 'Completed', tint: 'gray',
    orders: [
      { id: '#10415', meta: 'Table 09 · Meera K.', items: ['3x Thali'], total: '₹1,540', time: 'done' },
    ],
  },
]

function Orders() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [columns, setColumns] = useState(INITIAL_COLUMNS)

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
    }).catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'

  const advanceOrder = (colIndex, orderId) => {
    if (colIndex >= columns.length - 1) return
    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, orders: [...c.orders] }))
      const idx = next[colIndex].orders.findIndex((o) => o.id === orderId)
      if (idx === -1) return prev
      const [order] = next[colIndex].orders.splice(idx, 1)
      next[colIndex + 1].orders.unshift(order)
      return next
    })
  }

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="orders-page">
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'incoming-orders' ? 'active' : ''}`}
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
                <p className="eyebrow">Live kitchen</p>
                <h1>Orders</h1>
                <p className="page-desc">Move orders across stages as they're picked up. Real-time sync with POS, delivery partners and kitchen displays.</p>
              </div>
              <div className="head-actions">
                <button className="btn btn-outline" type="button" onClick={() => alert('Filter — coming soon in this demo.')}>▤ Filter</button>
                <button className="btn btn-primary" type="button" onClick={() => alert('New order — coming soon in this demo.')}>+ New order</button>
              </div>
            </div>

            <div className="board">
              {columns.map((col, colIndex) => (
                <div className="board-col" key={col.key}>
                  <div className="col-head">
                    <span className={`col-count tint-${col.tint}`}>{col.orders.length}</span>
                    <strong>{col.label}</strong>
                    <button type="button" className="col-more" onClick={() => alert('Column options — coming soon in this demo.')}>⋯</button>
                  </div>

                  <div className="col-body">
                    {col.orders.map((order) => (
                      <div className="order-card" key={order.id}>
                        <div className="order-card-top">
                          <strong>{order.id}</strong>
                          {order.high && <span className="high-pill">High</span>}
                        </div>
                        <p className="order-meta">{order.meta}</p>
                        <ul>
                          {order.items.map((it) => <li key={it}>{it}</li>)}
                        </ul>
                        <div className="order-card-foot">
                          <strong>{order.total}</strong>
                          <span>⏱ {order.time}</span>
                        </div>
                        {colIndex < columns.length - 1 && (
                          <button type="button" className="advance-btn" onClick={() => advanceOrder(colIndex, order.id)}>
                            Move to {columns[colIndex + 1].label} →
                          </button>
                        )}
                      </div>
                    ))}
                    {col.orders.length === 0 && <p className="empty-col">No orders</p>}
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

export default Orders
