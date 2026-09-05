import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { MESSAGES } from '../../constants/messages.js'
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
  const toast = useToast()
  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))

  const [filter, setFilter] = useState('All')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [feed, setFeed] = useState(FEED)
  const [routing, setRouting] = useState(ROUTING)

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


  
  return (
    <DashboardLayout pageClassName="notifications-page" activeNav="notifications">
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
    </DashboardLayout>
  )
}

export default Notifications
