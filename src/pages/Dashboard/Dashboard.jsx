import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import './Dashboard.css'

function generateSeries(n, base, amplitude) {
  return Array.from({ length: n }, (_, i) =>
    Math.round(
      base +
        amplitude * Math.sin(i / 3.1) +
        (i % 7 === 5 ? amplitude * 0.6 : 0) +
        (i % 7 === 6 ? amplitude * 0.35 : 0),
    ),
  )
}

const REVENUE_SERIES = {
  '7d': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [4200, 4600, 4100, 5300, 7200, 9800, 8700] },
  '30d': { labels: Array.from({ length: 30 }, (_, i) => `${i + 1}`), values: generateSeries(30, 6200, 2600) },
  '90d': { labels: Array.from({ length: 90 }, (_, i) => `${i + 1}`), values: generateSeries(90, 6800, 3000) },
}

const ORDER_HOURS = ['11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p']
const ORDER_COUNTS = [4, 12, 17, 7, 3, 5, 9, 15, 22, 26, 16, 12]

const RECENT_ORDERS = [
  { id: '#10428', status: 'Preparing', meta: 'Table 12 · Riya M. · 4 items', amount: '₹2,480', time: '2 min ago' },
  { id: '#10427', status: 'Ready', meta: 'Pickup · Arjun S. · 2 items', amount: '₹860', time: '5 min ago' },
  { id: '#10426', status: 'New', meta: 'Table 04 · Walk-in · 6 items', amount: '₹4,120', time: '8 min ago' },
  { id: '#10425', status: 'Completed', meta: 'Table 09 · Meera K. · 3 items', amount: '₹1,540', time: '14 min ago' },
  { id: '#10424', status: 'Accepted', meta: 'Delivery · Zomato · 5 items', amount: '₹2,180', time: '18 min ago' },
]

const RESERVATIONS = [
  { name: 'Aditi & Rohan', meta: 'T-08 · Anniversary', time: '7:30 PM', party: 2 },
  { name: 'Khanna family', meta: 'T-15 · High chair', time: '8:00 PM', party: 6 },
  { name: 'Vikram P.', meta: 'T-03 · Window seat', time: '8:45 PM', party: 4 },
  { name: 'Sara L.', meta: 'T-11 · —', time: '9:15 PM', party: 2 },
]

const POPULAR_ITEMS = [
  { rank: 1, name: 'Truffle Mushroom Risotto', tag: "Chef's pick", sold: 142, revenue: '₹68,160', trend: '+18%', up: true },
  { rank: 2, name: 'Wood-Fired Margherita', tag: 'Best seller', sold: 128, revenue: '₹44,800', trend: '+9%', up: true },
  { rank: 3, name: 'Saffron Butter Chicken', tag: 'Signature', sold: 96, revenue: '₹52,800', trend: '-4%', up: false },
  { rank: 4, name: 'Burrata & Heirloom Tomato', tag: 'New', sold: 74, revenue: '₹29,600', trend: '+22%', up: true },
]

const STAFF_SHIFT = [
  { name: 'Karan', role: 'Head Chef', status: 'On floor', dot: 'green' },
  { name: 'Priya', role: 'Server · S1', status: 'Serving T-12', dot: 'blue' },
  { name: 'Dev', role: 'Server · S2', status: 'Break', dot: 'yellow' },
  { name: 'Anita', role: 'Cashier', status: 'At POS', dot: 'green' },
]

const CHANNEL_MIX = [
  { name: 'Dine-in', amount: '₹69,363', pct: 54 },
  { name: 'Delivery', amount: '₹39,819', pct: 31 },
  { name: 'Pickup', amount: '₹19,268', pct: 15 },
]

const LOW_STOCK = [
  { name: 'Tiger prawns', meta: '2.1 kg · ~6 orders left', level: 'Critical' },
  { name: 'Burrata', meta: '8 pcs · ~8 orders left', level: 'Low' },
  { name: 'Alphonso pulp', meta: '1.4 L · ~12 drinks', level: 'Low' },
  { name: 'Truffle butter', meta: '300 g · ~15 naans', level: 'Watch' },
]

const FLOOR_STATUS = [
  'reserved', 'occupied', 'occupied', 'free', 'occupied', 'reserved',
  'occupied', 'cleaning', 'occupied', 'free', 'reserved', 'occupied',
  'occupied', 'occupied', 'reserved', 'occupied', 'occupied', 'occupied',
]

function buildAreaPath(values, width, height, padding = 6) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const stepX = (width - padding * 2) / (values.length - 1 || 1)

  const points = values.map((v, i) => {
    const x = padding + i * stepX
    const y = padding + (1 - (v - min) / range) * (height - padding * 2)
    return [x, y]
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1][0].toFixed(1)} ${height - padding} L ${points[0][0].toFixed(1)} ${height - padding} Z`

  return { linePath, areaPath }
}

function Dashboard() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [range, setRange] = useState('7d')

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
  const firstName = (currentUser?.name || 'there').split(' ')[0]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()

  const series = REVENUE_SERIES[range]
  const { linePath, areaPath } = useMemo(() => buildAreaPath(series.values, 600, 180), [series])

  const maxOrders = Math.max(...ORDER_COUNTS)

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) {
      navigate(item.route)
    } else {
      alert(`${item.label} — coming soon in this demo.`)
    }
  }

  return (
    <div className="dashboard-page">
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
            <span className="avatar-badge">{displayRestaurant.charAt(0).toUpperCase()}</span>
            <span className="restaurant-info">
              <strong>{displayRestaurant}</strong>
              <small>{restaurantStatus === 'live' ? 'Live' : 'Onboarding'}</small>
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
                    className={`nav-item ${item.key === 'dashboard' ? 'active' : ''}`}
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
                <button className="user-chip" type="button" onClick={() => setProfileOpen((prev) => !prev)}>
                  <span className="avatar-dark">{(currentUser?.name || 'A').charAt(0).toUpperCase()}</span>
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
                      <button type="button" onClick={() => { setProfileOpen(false); alert('Account settings — coming soon in this demo.') }}>
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

          <main className="content" id="top">
            <div className="page-head">
              <div>
                <p className="eyebrow">TODAY · {todayLabel}</p>
                <h1>{greeting}, {firstName}</h1>
                <p className="page-desc">
                  Here's how {displayRestaurant} is performing right now. Live data refreshes every 30 seconds.
                </p>
              </div>

              <div className="head-actions">
                <button className="btn btn-outline" type="button" onClick={() => alert('Range picker — coming soon in this demo.')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Last 7 days
                </button>
                <button className="btn btn-dark" type="button" onClick={() => alert('Daily report — coming soon in this demo.')}>
                  ✦ Daily report
                </button>
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="stat-cards">
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-ico">₹</span>
                  <span className="trend up">↗ +12.4%</span>
                </div>
                <div className="stat-number">₹1,28,450</div>
                <p className="stat-sub">Revenue today</p>
                <p className="stat-foot">vs. yesterday ₹1,14,300</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-ico">🧾</span>
                  <span className="trend up">↗ +8.1%</span>
                </div>
                <div className="stat-number">184</div>
                <p className="stat-sub">Orders today</p>
                <p className="stat-foot">63 dine-in · 84 delivery · 37 pickup</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-ico">👥</span>
                  <span className="trend up">↗ +3</span>
                </div>
                <div className="stat-number">27</div>
                <p className="stat-sub">Active reservations</p>
                <p className="stat-foot">9 arriving in next hour</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-ico">⏱</span>
                  <span className="trend up">75%</span>
                </div>
                <div className="stat-number">18 / 24</div>
                <p className="stat-sub">Tables occupied</p>
                <p className="stat-foot">Avg dwell 58 min</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-ico">💳</span>
                  <span className="trend down">↘ -1.2%</span>
                </div>
                <div className="stat-number">₹698</div>
                <p className="stat-sub">Avg. order value</p>
                <p className="stat-foot">Target ₹720</p>
              </div>
            </div>

            {/* CHARTS */}
            <div className="chart-row">
              <section className="card chart-card">
                <div className="card-head">
                  <div>
                    <h2>Revenue &amp; orders</h2>
                    <span>Rolling {range} performance</span>
                  </div>
                  <div className="range-toggle">
                    {['7d', '30d', '90d'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={range === r ? 'active' : ''}
                        onClick={() => setRange(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <svg className="area-chart" viewBox="0 0 600 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8bc53f" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#8bc53f" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#revenueFill)" />
                  <path d={linePath} fill="none" stroke="#8bc53f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {range === '7d' && (
                  <div className="chart-axis">
                    {series.labels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                )}
              </section>

              <section className="card bar-card">
                <div className="card-head">
                  <div>
                    <h2>Order trends</h2>
                    <span>Today by hour</span>
                  </div>
                </div>

                <div className="bar-chart">
                  {ORDER_COUNTS.map((count, i) => (
                    <div className="bar-col" key={ORDER_HOURS[i]}>
                      <div className="bar" style={{ height: `${(count / maxOrders) * 100}%` }} title={`${count} orders`} />
                    </div>
                  ))}
                </div>
                <div className="chart-axis">
                  {ORDER_HOURS.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
              </section>
            </div>

            {/* ORDERS + RESERVATIONS */}
            <div className="two-col-row">
              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Recent orders</h2>
                    <span>Live stream from POS &amp; delivery channels</span>
                  </div>
                  <button className="link-btn" type="button" onClick={() => alert('Orders — coming soon in this demo.')}>
                    View all
                  </button>
                </div>

                <ul className="order-list">
                  {RECENT_ORDERS.map((order) => (
                    <li key={order.id}>
                      <span className="order-id">{order.id.replace('#', '')}</span>
                      <div className="order-main">
                        <div className="order-top">
                          <span className={`status-pill status-${order.status.toLowerCase()}`}>{order.status}</span>
                        </div>
                        <p>{order.meta}</p>
                      </div>
                      <div className="order-side">
                        <strong>{order.amount}</strong>
                        <small>{order.time}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Tonight's reservations</h2>
                    <span>4 of {RESERVATIONS.length + 5} arriving next hour</span>
                  </div>
                  <button className="link-btn" type="button" onClick={() => alert('Reservations — coming soon in this demo.')}>
                    Calendar
                  </button>
                </div>

                <ul className="reservation-list">
                  {RESERVATIONS.map((r) => (
                    <li key={r.name}>
                      <span className="party-count">{r.party}</span>
                      <div className="reservation-main">
                        <strong>{r.name}</strong>
                        <p>{r.meta}</p>
                      </div>
                      <div className="reservation-side">
                        <strong>{r.time}</strong>
                        <small>CONFIRMED</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* MENU + STAFF */}
            <div className="two-col-row">
              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Popular menu items</h2>
                    <span>Top sellers this week</span>
                  </div>
                </div>

                <ul className="menu-list">
                  {POPULAR_ITEMS.map((item) => (
                    <li key={item.rank}>
                      <span className="rank-badge">{String(item.rank).padStart(2, '0')}</span>
                      <div className="menu-main">
                        <div className="menu-top">
                          <strong>{item.name}</strong>
                          <span className="tag-pill">{item.tag}</span>
                        </div>
                        <p>{item.sold} sold · {item.revenue}</p>
                      </div>
                      <span className={`menu-trend ${item.up ? 'up' : 'down'}`}>{item.trend}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Staff on shift</h2>
                    <span>Evening · 6:00 – 11:30 PM</span>
                  </div>
                </div>

                <ul className="staff-list">
                  {STAFF_SHIFT.map((person) => (
                    <li key={person.name}>
                      <span className="staff-avatar">{person.name.charAt(0)}</span>
                      <div className="staff-main">
                        <strong>{person.name}</strong>
                        <p>{person.role}</p>
                      </div>
                      <span className="staff-status">
                        <span className={`status-dot ${person.dot}`}></span>
                        {person.status}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="staff-footer">
                  <span>Kitchen avg. prep time:</span>
                  <strong>12 min</strong>
                </div>
              </section>
            </div>

            {/* CHANNEL MIX + STOCK + FLOOR */}
            <div className="three-col-row">
              <section className="card">
                <div className="card-head">
                  <div><h2>Channel mix</h2><span>Revenue share today</span></div>
                </div>

                <div className="channel-mix">
                  {CHANNEL_MIX.map((c) => (
                    <div className="channel-item" key={c.name}>
                      <div className="channel-labels">
                        <span>{c.name}</span>
                        <span>{c.amount} · {c.pct}%</span>
                      </div>
                      <div className="channel-track">
                        <div className="channel-fill" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card">
                <div className="card-head">
                  <div><h2>Low stock</h2><span>Auto-flagged from tonight's covers</span></div>
                </div>

                <ul className="stock-list">
                  {LOW_STOCK.map((item) => (
                    <li key={item.name}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.meta}</p>
                      </div>
                      <span className={`level-pill level-${item.level.toLowerCase()}`}>{item.level}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <div className="card-head">
                  <div><h2>Floor status</h2><span>{FLOOR_STATUS.length} tables · 48 covers</span></div>
                </div>

                <div className="floor-grid">
                  {FLOOR_STATUS.map((status, i) => (
                    <div
                      key={i}
                      className={`floor-cell floor-${status}`}
                      title={status}
                      onClick={() => alert(`Table ${i + 1} — ${status}`)}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>

                <div className="floor-legend">
                  <span><i className="dot floor-occupied" /> Occupied 11</span>
                  <span><i className="dot floor-reserved" /> Reserved 4</span>
                  <span><i className="dot floor-cleaning" /> Cleaning 1</span>
                  <span><i className="dot floor-free" /> Free 2</span>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
