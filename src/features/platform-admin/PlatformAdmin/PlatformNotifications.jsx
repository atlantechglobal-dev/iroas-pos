import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'approval', label: 'Approvals' },
  { key: 'identity', label: 'Identity' },
  { key: 'audit', label: 'Activity' },
]

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

function formatRelative(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return formatWhen(iso)
}

function humanTitle(item) {
  if (item.type === 'approval') return item.title
  if (item.type === 'identity') return item.title
  const action = String(item.title || '').toLowerCase()
  const map = {
    'plans.update': 'Plan updated',
    'plans.create': 'Plan created',
    'plans.delete': 'Plan deleted',
    'tenant.approve': 'Tenant approved',
    'tenant.reject': 'Tenant rejected',
    'flags.update': 'Feature flags updated',
    'email.settings': 'Email settings saved',
    'payment.settings': 'Payment settings saved',
  }
  if (map[action]) return map[action]
  if (action.includes('.')) {
    return action
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' · ')
  }
  return item.title || 'Platform event'
}

function typeMeta(type) {
  if (type === 'approval') {
    return { label: 'Approval', tone: 'amber', letter: 'A' }
  }
  if (type === 'identity') {
    return { label: 'Identity', tone: 'sky', letter: 'I' }
  }
  return { label: 'Activity', tone: 'slate', letter: '·' }
}

function PlatformNotifications() {
  const toast = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = () => {
    setLoading(true)
    api
      .adminFeed(50)
      .then(({ items: rows }) => setItems(rows || []))
      .catch((err) => {
        setItems([])
        toast.error(err.message || 'Unable to load feed.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const out = { all: items.length, approval: 0, identity: 0, audit: 0 }
    for (const item of items) {
      if (out[item.type] !== undefined) out[item.type] += 1
    }
    return out
  }, [items])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((item) => item.type === filter)
  }, [items, filter])

  const openItem = (item) => {
    if (item.type === 'approval' && item.meta?.tenantId) {
      navigate(`${ROUTES.PLATFORM_ACCOUNT_APPROVE}/${item.meta.tenantId}`)
      return
    }
    if (item.type === 'identity') {
      navigate(ROUTES.PLATFORM_IDENTITIES)
      return
    }
    if (item.type === 'audit') {
      navigate(ROUTES.PLATFORM_AUDIT)
    }
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page platform-notifications-page"
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
        <div className="platform-admin-actions">
          <button type="button" className="email-settings-link" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link className="new-tenant" to={ROUTES.PLATFORM_ACCOUNT_APPROVE}>
            Open account approve
          </Link>
        </div>
      </div>

      <div className="pa-notif-stats">
        <div className="pa-notif-stat">
          <strong>{counts.approval}</strong>
          <span>Awaiting approval</span>
        </div>
        <div className="pa-notif-stat">
          <strong>{counts.identity}</strong>
          <span>Identity queue</span>
        </div>
        <div className="pa-notif-stat">
          <strong>{counts.audit}</strong>
          <span>Operator activity</span>
        </div>
      </div>

      <section className="pa-notif-card">
        <header className="pa-notif-card-head">
          <div>
            <h2>Activity feed</h2>
            <p>{loading ? 'Loading…' : `${filtered.length} of ${items.length} events`}</p>
          </div>
          <div className="pa-notif-filters" role="tablist" aria-label="Filter notifications">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={filter === f.key ? 'is-active' : ''}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <em>{counts[f.key] ?? 0}</em>
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="pa-notif-empty">
            <p>Loading platform alerts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="pa-notif-empty">
            <span className="pa-notif-empty-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V13L20 17H4L6 13V8Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <strong>No notifications</strong>
            <p>
              {filter === 'all'
                ? 'You’re all caught up. New approvals and operator actions will appear here.'
                : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase() || 'items'} right now.`}
            </p>
            {filter === 'approval' ? (
              <Link className="new-tenant" to={ROUTES.PLATFORM_ACCOUNT_APPROVE}>
                Go to account approve
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="pa-notif-list">
            {filtered.map((item) => {
              const meta = typeMeta(item.type)
              const actionable =
                (item.type === 'approval' && item.meta?.tenantId) ||
                item.type === 'identity' ||
                item.type === 'audit'
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`pa-notif-item tone-${meta.tone}${actionable ? ' is-clickable' : ''}`}
                    onClick={() => openItem(item)}
                    disabled={!actionable}
                  >
                    <span className="pa-notif-badge" aria-hidden="true">
                      {meta.letter}
                    </span>
                    <span className="pa-notif-copy">
                      <span className="pa-notif-top">
                        <strong>{humanTitle(item)}</strong>
                        <span className={`pa-notif-chip tone-${meta.tone}`}>{meta.label}</span>
                      </span>
                      <small>{item.body || 'Platform event'}</small>
                      <em>{formatRelative(item.createdAt)}</em>
                    </span>
                    {actionable ? (
                      <span className="pa-notif-go" aria-hidden="true">
                        →
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </DashboardLayout>
  )
}

export default PlatformNotifications
