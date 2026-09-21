import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import { PlatformSubnav } from './PlatformSubnav.jsx'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PlatformNotifications() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .adminFeed(50)
      .then(({ items: rows }) => setItems(rows || []))
      .catch((err) => {
        setItems([])
        toast.error(err.message || 'Unable to load feed.')
      })
      .finally(() => setLoading(false))
  }, [toast])

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-notifications"
      variant="admin"
      adminSubtitle="Platform alerts"
    >
      <div className="page-header">
        <div>
          <div className="page-label">SYSTEM</div>
          <h1>Notifications</h1>
          <p>Approvals, identity queue, and recent operator activity.</p>
        </div>
        <Link className="email-settings-link" to={ROUTES.PLATFORM_APPROVE}>
          Approve
        </Link>
      </div>

      <PlatformSubnav active="platform-notifications" />

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>Feed</h2>
            <span>{loading ? 'Loading…' : `${items.length} items`}</span>
          </div>
        </div>
        <div style={{ padding: '8px 18px 18px' }}>
          {items.map((item) => (
            <div className="audit-item" key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
              <img src="/images/noti.svg" alt="" />
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.body} · {formatWhen(item.createdAt)}
                </small>
              </div>
            </div>
          ))}
          {!loading && items.length === 0 ? (
            <p className="pa-empty">No platform alerts right now.</p>
          ) : null}
        </div>
      </section>
    </DashboardLayout>
  )
}

export default PlatformNotifications
