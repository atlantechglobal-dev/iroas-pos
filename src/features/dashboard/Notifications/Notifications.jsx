import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useAuth } from '@/shared/hooks/useAuth'
import { api } from '@/shared/lib/api'
import '@/features/dashboard/Notifications/Notifications.css'

const FILTERS = ['All', 'Identity', 'Products', 'Orders', 'Bookings', 'Payments', 'Reviews', 'Inventory', 'Staff']

function formatRelative(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  return new Date(iso).toLocaleDateString()
}

function Notifications() {
  const { isAdmin } = useAuth()

  const [filter, setFilter] = useState('All')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [feed, setFeed] = useState([])

  useEffect(() => {
    api
      .getNotifications()
      .then(({ notifications }) => {
        const mapped = (notifications || []).map((n) => ({
          id: n.id,
          icon: n.type === 'product' ? '📱' : '✦',
          type: n.type === 'product' ? 'Products' : 'Identity',
          title: n.title,
          meta: n.body || '',
          time: formatRelative(n.createdAt),
          unread: !n.read,
          api: true,
        }))
        setFeed(mapped)
      })
      .catch(() => {})
  }, [])

  const unreadCount = feed.filter((f) => f.unread).length

  const filtered = feed.filter((f) => {
    if (unreadOnly && !f.unread) return false
    if (filter === 'All') return true
    return f.type === filter
  })

  const markAllRead = () => {
    const ids = feed.filter((f) => f.api && f.unread).map((f) => f.id)
    if (ids.length) {
      api.markNotificationsRead(ids).catch(() => {})
    }
    setFeed((prev) => prev.map((f) => ({ ...f, unread: false })))
  }

  return (
    <DashboardLayout
      pageClassName="notifications-page"
      activeNav={isAdmin ? 'platform-notifications' : 'notifications'}
      variant={isAdmin ? 'admin' : 'owner'}
      adminSubtitle="Platform alerts"
    >
      <div className="page-head">
        <div>
          <p className="eyebrow">System</p>
          <h1>Notifications</h1>
          <p className="page-desc">
            A single inbox for Digital Identity, products, orders, bookings, payments, reviews and
            stock — with per-channel routing.
          </p>
        </div>
        <button className="btn btn-outline" type="button" onClick={markAllRead}>
          ✓ Mark all read
        </button>
      </div>

      <div className="two-col">
        <section className="card feed-card">
          <div className="filter-row">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
            <label className="unread-toggle">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              Unread only ({unreadCount})
            </label>
          </div>

          <ul className="feed-list">
            {filtered.map((f, i) => (
              <li key={f.id || i} className={f.unread ? 'unread' : ''}>
                <span className="feed-ico">{f.icon}</span>
                <div className="feed-main">
                  <strong>
                    {f.title}
                    {f.unread && <span className="unread-dot" />}
                  </strong>
                  <p>{f.meta}</p>
                </div>
                <span className="feed-time">{f.time}</span>
              </li>
            ))}
            {filtered.length === 0 && <p className="empty-note">Nothing here.</p>}
          </ul>
        </section>

      </div>
    </DashboardLayout>
  )
}

export default Notifications
