import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import './Reviews.css'

const BREAKDOWN = [
  { stars: 5, pct: 64 },
  { stars: 4, pct: 22 },
  { stars: 3, pct: 8 },
  { stars: 2, pct: 4 },
  { stars: 1, pct: 2 },
]

const INITIAL_REVIEWS = [
  { name: 'Aarav S.', source: 'Google', time: '2h ago', rating: 5, text: 'Truffle risotto was sublime. Service warm and unhurried. Will return for the wood-fired pizza.', tone: 'Positive' },
  { name: 'Meera K.', source: 'Zomato', time: 'Yesterday', rating: 4, text: 'Beautiful ambience and great food. Slight delay during peak hours but staff handled it well.', tone: 'Positive' },
  { name: 'Ritika P.', source: 'Swiggy', time: '2d ago', rating: 2, text: 'Delivery took 70 minutes and the pasta was cold. Disappointed.', tone: 'Negative' },
  { name: 'Karan G.', source: 'Google', time: '3d ago', rating: 5, text: 'Burrata starter was a 10/10. Cocktails are inventive and reasonably priced.', tone: 'Positive' },
]

function Reviews() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [profileOpen, setProfileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [reviews, setReviews] = useState(INITIAL_REVIEWS)
  const [replying, setReplying] = useState(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    api.getRestaurant().then(({ restaurant }) => {
      if (restaurant.name) setRestaurantName(restaurant.name)
      setRestaurantStatus(restaurant.status)
    }).catch(() => {})
  }, [])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'

  const submitReply = (name) => {
    if (!replyText.trim()) return
    setReviews((prev) => prev.map((r) => (r.name === name ? { ...r, reply: replyText.trim() } : r)))
    setReplying(null)
    setReplyText('')
  }

  const handleLogout = () => { clearSession(); navigate('/login') }
  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) navigate(item.route)
    else alert(`${item.label} — coming soon in this demo.`)
  }

  return (
    <div className="reviews-page">
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
                  <a href="#top" key={item.key} className={`nav-item ${item.key === 'reviews' ? 'active' : ''}`}
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
                <p className="eyebrow">Reputation</p>
                <h1>Reviews</h1>
                <p className="page-desc">What guests are saying across Google, Zomato, Swiggy and direct channels.</p>
              </div>
            </div>

            <div className="review-grid">
              <section className="card rating-card">
                <span className="muted-note">Overall rating</span>
                <div className="rating-big">4.7<span>/ 5</span></div>
                <div className="stars">{'★★★★★'}</div>
                <span className="muted-note">From 1,284 reviews</span>

                <div className="breakdown">
                  {BREAKDOWN.map((b) => (
                    <div className="breakdown-row" key={b.stars}>
                      <span>{b.stars}</span>
                      <div className="breakdown-track"><div className="breakdown-fill" style={{ width: `${b.pct}%` }} /></div>
                      <span>{b.pct}%</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card reviews-card">
                <h2>Latest reviews</h2>
                <span className="muted-note">Reply directly from here</span>

                <ul className="review-list">
                  {reviews.map((r) => (
                    <li key={r.name}>
                      <div className="review-top">
                        <div>
                          <strong>{r.name}</strong>
                          <span className="review-meta"> · {r.source} · {r.time}</span>
                        </div>
                        <span className={`tone-pill ${r.tone === 'Positive' ? 'positive' : 'negative'}`}>{r.tone}</span>
                      </div>
                      <div className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                      <p>{r.text}</p>

                      {r.reply && <div className="review-reply"><strong>Your reply:</strong> {r.reply}</div>}

                      {replying === r.name ? (
                        <div className="reply-box">
                          <input type="text" placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} autoFocus />
                          <button type="button" onClick={() => submitReply(r.name)}>Send</button>
                          <button type="button" className="cancel" onClick={() => { setReplying(null); setReplyText('') }}>Cancel</button>
                        </div>
                      ) : (
                        <button className="reply-btn" type="button" onClick={() => setReplying(r.name)}>
                          ↩ Reply
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Reviews
