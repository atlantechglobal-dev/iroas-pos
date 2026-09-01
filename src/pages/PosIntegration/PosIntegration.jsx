import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import { deriveAccentShades, DEFAULT_ACCENT } from '../../lib/accentColor'
import './PosIntegration.css'

const PROVIDERS = [
  { name: 'Petpooja', desc: "Full menu + order sync, India's most used POS", status: 'Connected', action: 'Configure' },
  { name: 'Square', desc: 'Card terminal and catalog sync', status: 'Available', action: 'Connect' },
  { name: 'Toast', desc: 'Orders, checks and tips sync', status: 'Available', action: 'Connect' },
  { name: 'Posist', desc: 'Enterprise multi-outlet POS', status: 'Available', action: 'Connect' },
  { name: 'Zomato / Swiggy', desc: 'Aggregator order ingestion', status: 'Connected', action: 'Configure' },
  { name: 'Custom webhook', desc: 'Push orders to your own endpoint', status: 'Configured', action: 'Configure' },
]

const DEVICES = [
  { name: 'Kitchen KOT printer', meta: 'Epson TM-T82 · 192.168.1.24', online: true },
  { name: 'Bar KOT printer', meta: 'Epson TM-T82 · 192.168.1.25', online: true },
  { name: 'Counter bill printer', meta: 'TVS RP 3160 · USB', online: true },
  { name: 'Card terminal', meta: 'Pine Labs · Bluetooth', online: false },
]

const ACTIVITY = [
  { text: 'Pushed 14 menu items to Petpooja', time: '2 min ago', ok: true },
  { text: 'Pulled 3 aggregator orders from Swiggy', time: '18 min ago', ok: true },
  { text: 'Retried KOT print for order #10412', time: '44 min ago', ok: true },
  { text: 'Card terminal heartbeat missed', time: '1 hr ago', ok: false },
  { text: 'Full catalog sync completed (62 items)', time: '3 hr ago', ok: true },
]

const RULES = [
  { key: 'twoWay', label: 'Two-way menu sync', desc: 'Keep prices and availability identical in both systems', on: true },
  { key: 'autoAccept', label: 'Auto-accept POS orders', desc: 'Orders from POS skip the accept step in IROAS', on: true },
  { key: 'printKot', label: 'Print KOT on accept', desc: 'Fire kitchen tickets the moment an order is accepted', on: true },
  { key: 'pushPayments', label: 'Push payments to POS', desc: 'Online payments recorded as POS tenders', on: false },
  { key: 'syncTables', label: 'Sync table state', desc: 'Occupied / free status mirrors your floor plan', on: true },
]

function PosIntegration() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
  const [rules, setRules] = useState(RULES)

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
        if (restaurant.settings?.adminAccentColor) setAccentColor(restaurant.settings.adminAccentColor)
    }).catch(() => {})
  }, [])
const accentStyle = deriveAccentShades(accentColor)

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'

  const toggleRule = (key) => {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, on: !r.on } : r)))
  }

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="pos-page" style={accentStyle}>
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'pos' ? 'active' : ''}`}
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
                <p className="eyebrow">System</p>
                <h1>POS Integration</h1>
                <p className="page-desc">Connect your point-of-sale, printers and terminals so orders, menu and payments stay in sync.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => alert('Sync started — demo only, no real POS is connected.')}>⟳ Sync now</button>
            </div>

            <div className="stat-cards">
              <div className="stat-card"><span>📶 Connection</span><strong className="ok">Healthy</strong></div>
              <div className="stat-card"><span>⇅ Last sync</span><strong>2 min ago</strong></div>
              <div className="stat-card"><span>⊞ Items in sync</span><strong>62 / 62</strong></div>
              <div className="stat-card"><span>⚠ Failed jobs · 24h</span><strong>1</strong></div>
            </div>

            <div className="two-col">
              <section className="card">
                <h2>Providers</h2>
                <span className="muted-note">One primary POS, unlimited aggregators</span>
                <div className="provider-grid">
                  {PROVIDERS.map((p) => (
                    <div className="provider-card" key={p.name}>
                      <div className="provider-top">
                        <strong>{p.name}</strong>
                        <span className={`status-pill status-${p.status.toLowerCase()}`}>{p.status}</span>
                      </div>
                      <p>{p.desc}</p>
                      <button type="button" onClick={() => alert(`${p.action} ${p.name} — coming soon in this demo.`)}>
                        {p.action === 'Configure' ? '⚙' : '⇗'} {p.action}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="side-col">
                <section className="card">
                  <h2>Devices</h2>
                  <span className="muted-note">Printers &amp; terminals on this floor</span>
                  <ul className="device-list">
                    {DEVICES.map((d) => (
                      <li key={d.name}>
                        <span className="device-ico">🖨</span>
                        <div className="device-main">
                          <strong>{d.name}</strong>
                          <p>{d.meta}</p>
                        </div>
                        <span className={`device-status ${d.online ? 'online' : 'offline'}`}>
                          <span className="dot" /> {d.online ? 'Online' : 'Offline'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button className="add-device-btn" type="button" onClick={() => alert('Add device — coming soon in this demo.')}>+ Add device</button>
                </section>

                <section className="card">
                  <h2>Sync activity</h2>
                  <ul className="activity-list">
                    {ACTIVITY.map((a) => (
                      <li key={a.text}>
                        <span className={`activity-ico ${a.ok ? 'ok' : 'warn'}`}>{a.ok ? '✓' : '⟳'}</span>
                        <div>
                          <strong>{a.text}</strong>
                          <p>{a.time}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>

            <section className="card rules-card">
              <h2>Sync rules</h2>
              <span className="muted-note">Applies to the primary POS connection</span>
              {rules.map((r) => (
                <div className="rule-row" key={r.key}>
                  <div>
                    <strong>{r.label}</strong>
                    <p>{r.desc}</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={r.on} onChange={() => toggleRule(r.key)} />
                    <span className="slider"></span>
                  </label>
                </div>
              ))}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default PosIntegration
