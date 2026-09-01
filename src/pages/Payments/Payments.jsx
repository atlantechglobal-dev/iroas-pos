import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import { deriveAccentShades, DEFAULT_ACCENT } from '../../lib/accentColor'
import './Payments.css'

const TRANSACTIONS = [
  { txn: 'TXN-58812', order: '#10428', name: 'Rhea Menon', meta: 'Delivery · 2 min ago', method: 'UPI · GPay', amount: '₹2,480', status: 'Captured' },
  { txn: 'TXN-58811', order: '#10427', name: 'Kabir Shah', meta: 'Pickup · 5 min ago', method: 'Card · Visa ••42', amount: '₹860', status: 'Captured' },
  { txn: 'TXN-58809', order: '#10424', name: 'Table 07', meta: 'Dine-in · 22 min ago', method: 'Cash', amount: '₹1,240', status: 'Captured' },
  { txn: 'TXN-58805', order: '#10419', name: 'Anita Desai', meta: 'Delivery · 48 min ago', method: 'UPI · PhonePe', amount: '₹1,690', status: 'Partly refunded' },
  { txn: 'TXN-58801', order: '#10411', name: 'Farhan Q.', meta: 'Pickup · 1 hr ago', method: 'Card · MC ••08', amount: '₹540', status: 'Refunded' },
  { txn: 'TXN-58796', order: '#10406', name: 'Table 12', meta: 'Dine-in · 2 hr ago', method: 'Card · Amex ••11', amount: '₹3,120', status: 'Pending' },
  { txn: 'TXN-58788', order: '#10399', name: 'Ishaan V.', meta: 'Delivery · 3 hr ago', method: 'Wallet · Paytm', amount: '₹2,180', status: 'Failed' },
]

const TABS = ['Transactions', 'Refunds', 'Settlements', 'Disputes']

function Payments() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
  const [tab, setTab] = useState('Transactions')
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
        if (restaurant.settings?.adminAccentColor) setAccentColor(restaurant.settings.adminAccentColor)
    }).catch(() => {})
  }, [])
const accentStyle = deriveAccentShades(accentColor)

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const filtered = TRANSACTIONS.filter((t) =>
    `${t.txn} ${t.order} ${t.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }
  const handleRefund = (txn) => alert(`Refund ${txn} — coming soon in this demo.`)

  return (
    <div className="payments-page" style={accentStyle}>
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'payments' ? 'active' : ''}`}
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
                <p className="eyebrow">Finance</p>
                <h1>Payments & refunds</h1>
                <p className="page-desc">Every transaction, refund, payout and dispute across dine-in, delivery and pickup.</p>
              </div>
              <button className="btn btn-outline" type="button" onClick={() => alert('Export statement — coming soon in this demo.')}>⇩ Export statement</button>
            </div>

            <div className="stat-cards">
              <div className="stat-card"><span>Gross volume · today</span><strong>₹1,28,450</strong></div>
              <div className="stat-card"><span>Net after fees</span><strong>₹1,23,716</strong></div>
              <div className="stat-card"><span>Refunds · today</span><strong>₹860</strong></div>
              <div className="stat-card"><span>Effective fee</span><strong>3.68%</strong></div>
              <div className="stat-card"><span>Open disputes</span><strong>2</strong></div>
            </div>

            <div className="tab-row">
              <div className="tabs">
                {TABS.map((t) => (
                  <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>
              <input className="txn-search" type="text" placeholder="Search order, guest, txn..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <div className="card">
              {tab === 'Transactions' ? (
                <>
                  <h2>Transactions</h2>
                  <span className="muted-note">{filtered.length} shown · all channels</span>
                  <ul className="txn-list">
                    {filtered.map((t) => (
                      <li key={t.txn}>
                        <div className="txn-main">
                          <strong>{t.txn} · {t.order}</strong>
                          <p>{t.name} · {t.meta}</p>
                        </div>
                        <div className="txn-method">{t.method}</div>
                        <div className="txn-amount">{t.amount}</div>
                        <span className={`status-pill status-${t.status.toLowerCase().replace(/\s+/g, '-')}`}>{t.status}</span>
                        <button
                          className="refund-btn"
                          type="button"
                          disabled={t.status === 'Refunded' || t.status === 'Failed'}
                          onClick={() => handleRefund(t.txn)}
                        >
                          ↩ Refund
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h2>{tab}</h2>
                  <p className="muted-note">{tab} view — coming soon in this demo.</p>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Payments
