import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { HorizontalDragScroll } from '../../components/HorizontalDragScroll.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { TenantReviewDrawer } from '../../components/admin/TenantReviewDrawer.jsx'
import { ROUTES } from '../../constants/routes.js'
import '../Dashboard/Dashboard.css'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

const EMPTY_STATS = {
  activeTenants: 0,
  onboardingTenants: 0,
  pendingApprovals: 0,
  rejectedTenants: 0,
  totalTenants: 0,
  identityPending: 0,
}

const STATUS_PILL = {
  live: { label: 'Live', className: 'status-ready' },
  pending_approval: { label: 'Awaiting', className: 'status-preparing' },
  onboarding: { label: 'Onboarding', className: 'status-new' },
  rejected: { label: 'Rejected', className: 'status-completed' },
}

function formatRelative(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function PlatformAdmin() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [tenants, setTenants] = useState([])
  const [pending, setPending] = useState([])
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewTenantId, setReviewTenantId] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.adminStats(),
      api.adminHealth().catch(() => null),
      api.adminTenants('', ''),
      api.adminTenants('', 'pending_approval'),
      api.adminFeed(8).catch(() => ({ items: [] })),
    ])
      .then(([statsData, healthData, allTenants, pendingTenants, feedData]) => {
        setStats(statsData)
        setHealth(healthData)
        setTenants(allTenants?.tenants || [])
        setPending(pendingTenants?.tenants || [])
        setFeed(feedData?.items || [])
      })
      .catch(() => {
        setStats(EMPTY_STATS)
        setTenants([])
        setPending([])
        toast.error('Unable to load dashboard.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const displayStats = stats || EMPTY_STATS
  const firstName = (user?.name || 'Admin').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()

  const planMix = useMemo(() => {
    const counts = { starter: 0, growth: 0, enterprise: 0, other: 0 }
    for (const t of tenants) {
      const key = String(t.plan || 'starter').toLowerCase()
      if (key.includes('enter')) counts.enterprise += 1
      else if (key.includes('growth') || key === 'pro') counts.growth += 1
      else if (key.includes('start')) counts.starter += 1
      else counts.other += 1
    }
    const total = Math.max(tenants.length, 1)
    return [
      { name: 'Starter', count: counts.starter, pct: Math.round((counts.starter / total) * 100) },
      { name: 'Growth', count: counts.growth, pct: Math.round((counts.growth / total) * 100) },
      { name: 'Enterprise', count: counts.enterprise, pct: Math.round((counts.enterprise / total) * 100) },
    ]
  }, [tenants])

  const topLive = useMemo(() => {
    return tenants
      .filter((t) => t.status === 'live')
      .slice(0, 4)
      .map((t, i) => ({
        rank: String(i + 1).padStart(2, '0'),
        name: t.name || 'Untitled',
        tag: t.plan || 'Starter',
        meta: [t.city, t.owner_email].filter(Boolean).join(' · ') || 'Live tenant',
        id: t.id,
      }))
  }, [tenants])

  const attention = useMemo(() => {
    const items = []
    if ((displayStats.pendingApprovals || 0) > 0) {
      items.push({
        name: 'Tenant approvals',
        meta: `${displayStats.pendingApprovals} restaurants waiting to go live`,
        level: 'Critical',
        levelClass: 'level-critical',
        to: ROUTES.PLATFORM_APPROVE,
      })
    }
    if ((displayStats.identityPending || 0) > 0) {
      items.push({
        name: 'Identity review',
        meta: `${displayStats.identityPending} Digital IDs need moderation`,
        level: 'Low',
        levelClass: 'level-low',
        to: ROUTES.PLATFORM_IDENTITIES,
      })
    }
    const pay = (health?.checks || []).find((c) => c.key === 'payment')
    if (pay && !pay.ok) {
      items.push({
        name: 'Payment settings',
        meta: 'Launch payments not configured',
        level: 'Watch',
        levelClass: 'level-watch',
        to: ROUTES.PLATFORM_SETTINGS_PAYMENT,
      })
    }
    const email = (health?.checks || []).find((c) => c.key === 'email')
    if (email && !email.ok) {
      items.push({
        name: 'Email settings',
        meta: 'Transactional email not configured',
        level: 'Watch',
        levelClass: 'level-watch',
        to: ROUTES.PLATFORM_SETTINGS_EMAIL,
      })
    }
    if (!items.length) {
      items.push({
        name: 'All clear',
        meta: 'No critical platform alerts right now',
        level: 'Watch',
        levelClass: 'level-watch',
        to: ROUTES.PLATFORM_NOTIFICATIONS,
      })
    }
    return items.slice(0, 4)
  }, [displayStats, health])

  const statusGrid = useMemo(() => {
    const cells = []
    const sample = tenants.slice(0, 18)
    for (let i = 0; i < 18; i += 1) {
      const t = sample[i]
      let kind = 'free'
      if (t?.status === 'live') kind = 'occupied'
      else if (t?.status === 'pending_approval') kind = 'reserved'
      else if (t?.status === 'onboarding') kind = 'cleaning'
      else if (t?.status === 'rejected') kind = 'free'
      cells.push({ n: i + 1, kind, id: t?.id })
    }
    return cells
  }, [tenants])

  const statusCounts = useMemo(
    () => ({
      live: tenants.filter((t) => t.status === 'live').length,
      pending: tenants.filter((t) => t.status === 'pending_approval').length,
      onboarding: tenants.filter((t) => t.status === 'onboarding').length,
      other: tenants.filter((t) => !['live', 'pending_approval', 'onboarding'].includes(t.status))
        .length,
    }),
    [tenants],
  )

  return (
    <DashboardLayout
      pageClassName="dashboard-page platform-admin-page"
      activeNav="platform-admin"
      variant="admin"
      adminSubtitle={loading ? 'Loading…' : `${displayStats.totalTenants || 0} tenants`}
      searchPlaceholder="Search tenants, owners, plans…"
    >
      <div className="page-head">
        <div>
          <p className="eyebrow">PLATFORM · {todayLabel}</p>
          <h1>
            {greeting}, {firstName}
          </h1>
          <p className="page-desc">
            Here&apos;s how the IROAS platform is doing right now — tenants, approvals, and
            system health.
          </p>
        </div>

        <div className="head-actions">
          <Link className="btn btn-outline" to={ROUTES.PLATFORM_SETTINGS}>
            Settings
          </Link>
          <Link className="btn btn-dark" to={ROUTES.PLATFORM_APPROVE}>
            ✦ Approve
            {(displayStats.pendingApprovals || 0) > 0
              ? ` (${displayStats.pendingApprovals})`
              : ''}
          </Link>
        </div>
      </div>

      <HorizontalDragScroll className="stat-cards">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">▣</span>
            <span className="trend up">Live</span>
          </div>
          <div className="stat-number">{loading ? '—' : displayStats.activeTenants}</div>
          <p className="stat-sub">Live tenants</p>
          <p className="stat-foot">Published & taking customers</p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">⌁</span>
            <span className="trend up">Setup</span>
          </div>
          <div className="stat-number">{loading ? '—' : displayStats.onboardingTenants}</div>
          <p className="stat-sub">In onboarding</p>
          <p className="stat-foot">Still completing the wizard</p>
        </div>

        <button
          type="button"
          className="stat-card"
          style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
          onClick={() => navigate(ROUTES.PLATFORM_APPROVE)}
        >
          <div className="stat-top">
            <span className="stat-ico">◐</span>
            <span className="trend up">Review</span>
          </div>
          <div className="stat-number">{loading ? '—' : displayStats.pendingApprovals ?? 0}</div>
          <p className="stat-sub">Awaiting approval</p>
          <p className="stat-foot">Click to open Approve</p>
        </button>

        <button
          type="button"
          className="stat-card"
          style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
          onClick={() => navigate(ROUTES.PLATFORM_IDENTITIES)}
        >
          <div className="stat-top">
            <span className="stat-ico">✦</span>
            <span className="trend up">IDs</span>
          </div>
          <div className="stat-number">{loading ? '—' : displayStats.identityPending ?? 0}</div>
          <p className="stat-sub">Identity queue</p>
          <p className="stat-foot">Digital IDs to moderate</p>
        </button>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">⊘</span>
            <span className="trend down">{displayStats.rejectedTenants ? 'Sent back' : 'Clear'}</span>
          </div>
          <div className="stat-number">{loading ? '—' : displayStats.rejectedTenants ?? 0}</div>
          <p className="stat-sub">Rejected</p>
          <p className="stat-foot">Need owner changes</p>
        </div>
      </HorizontalDragScroll>

      <div className="two-col-row">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Pending approvals</h2>
              <span>Restaurants waiting for you to publish</span>
            </div>
            <button
              className="link-btn"
              type="button"
              onClick={() => navigate(ROUTES.PLATFORM_APPROVE)}
            >
              View all
            </button>
          </div>

          <ul className="order-list">
            {pending.slice(0, 5).map((tenant) => {
              const pill = STATUS_PILL[tenant.status] || STATUS_PILL.onboarding
              return (
                <li
                  key={tenant.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setReviewTenantId(tenant.id)}
                >
                  <span className="order-id">
                    {(tenant.name || 'T').charAt(0).toUpperCase()}
                  </span>
                  <div className="order-main">
                    <div className="order-top">
                      <span className={`status-pill ${pill.className}`}>{pill.label}</span>
                    </div>
                    <p>
                      {tenant.name || 'Untitled'} · {tenant.owner_name || tenant.owner_email || '—'}
                    </p>
                  </div>
                  <div className="order-side">
                    <strong>{tenant.plan || 'Starter'}</strong>
                    <small>{formatRelative(tenant.submitted_at)}</small>
                  </div>
                </li>
              )
            })}
            {!loading && pending.length === 0 ? (
              <li>
                <div className="order-main">
                  <div className="order-top">
                    <span className="status-pill status-ready">Clear</span>
                  </div>
                  <p>No applications awaiting approval.</p>
                </div>
              </li>
            ) : null}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Platform activity</h2>
              <span>
                {feed.length ? `${feed.length} recent events` : 'No recent events yet'}
              </span>
            </div>
            <button
              className="link-btn"
              type="button"
              onClick={() => navigate(ROUTES.PLATFORM_NOTIFICATIONS)}
            >
              All
            </button>
          </div>

          <ul className="reservation-list">
            {feed.length === 0 && !loading ? (
              <li>
                <div className="reservation-main">
                  <strong>No activity yet</strong>
                  <p>Approvals, identity updates, and operator actions show here.</p>
                </div>
              </li>
            ) : null}
            {feed.slice(0, 5).map((item) => (
              <li key={item.id}>
                <span className="party-count">
                  {item.type === 'approval' ? 'A' : item.type === 'identity' ? 'I' : '·'}
                </span>
                <div className="reservation-main">
                  <strong>{item.title}</strong>
                  <p>{item.body || 'Platform event'}</p>
                </div>
                <div className="reservation-side">
                  <strong>{formatRelative(item.createdAt)}</strong>
                  <small>{String(item.type || 'event').toUpperCase()}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="two-col-row">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Live tenants</h2>
              <span>Recently published businesses</span>
            </div>
            <button
              className="link-btn"
              type="button"
              onClick={() => navigate(ROUTES.PLATFORM_CUSTOMERS)}
            >
              Directory
            </button>
          </div>

          <ul className="menu-list">
            {topLive.map((item) => (
              <li
                key={item.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setReviewTenantId(item.id)}
              >
                <span className="rank-badge">{item.rank}</span>
                <div className="menu-main">
                  <div className="menu-top">
                    <strong>{item.name}</strong>
                    <span className="tag-pill">{item.tag}</span>
                  </div>
                  <p>{item.meta}</p>
                </div>
                <span className="menu-trend up">Live</span>
              </li>
            ))}
            {!loading && topLive.length === 0 ? (
              <li>
                <div className="menu-main">
                  <div className="menu-top">
                    <strong>No live tenants yet</strong>
                  </div>
                  <p>Approved restaurants will appear here.</p>
                </div>
              </li>
            ) : null}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>System health</h2>
              <span>Platform services</span>
            </div>
            <button
              className="link-btn"
              type="button"
              onClick={() => navigate(ROUTES.PLATFORM_SETTINGS)}
            >
              Settings
            </button>
          </div>

          <ul className="staff-list">
            {(health?.checks || []).map((check) => (
              <li key={check.key}>
                <span className="staff-avatar">{check.label.charAt(0)}</span>
                <div className="staff-main">
                  <strong>{check.label}</strong>
                  <p>{check.status}</p>
                </div>
                <div className="staff-status">
                  <span className={`status-dot ${check.ok ? 'green' : 'yellow'}`} />
                  {check.ok ? 'Healthy' : 'Needs setup'}
                </div>
              </li>
            ))}
            {!loading && !(health?.checks || []).length ? (
              <li>
                <div className="staff-main">
                  <strong>Health unavailable</strong>
                  <p>Could not load platform checks.</p>
                </div>
              </li>
            ) : null}
          </ul>

          <div className="staff-footer">
            <span>
              Total tenants: <strong>{displayStats.totalTenants || 0}</strong>
            </span>
            <span>
              Rejected: <strong>{displayStats.rejectedTenants || 0}</strong>
            </span>
          </div>
        </section>
      </div>

      <div className="three-col-row">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Plan mix</h2>
              <span>Share across tenants</span>
            </div>
          </div>
          <div className="channel-mix">
            {planMix.map((row) => (
              <div key={row.name}>
                <div className="channel-labels">
                  <span>{row.name}</span>
                  <span>
                    {row.count} · {row.pct}%
                  </span>
                </div>
                <div className="channel-track">
                  <div className="channel-fill" style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Needs attention</h2>
              <span>Auto-flagged from platform status</span>
            </div>
          </div>
          <ul className="stock-list">
            {attention.map((item) => (
              <li
                key={item.name}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(item.to)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.meta}</p>
                </div>
                <span className={`level-pill ${item.levelClass}`}>{item.level}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Tenant snapshot</h2>
              <span>
                {tenants.length} shown · {statusCounts.live} live
              </span>
            </div>
          </div>
          <div className="floor-grid">
            {statusGrid.map((cell) => (
              <button
                key={cell.n}
                type="button"
                className={`floor-cell floor-${cell.kind}`}
                title={cell.id ? `Tenant #${cell.id}` : 'Empty'}
                onClick={() => cell.id && setReviewTenantId(cell.id)}
              >
                {cell.n}
              </button>
            ))}
          </div>
          <div className="floor-legend">
            <span>
              <i className="dot floor-occupied" /> Live {statusCounts.live}
            </span>
            <span>
              <i className="dot floor-reserved" /> Awaiting {statusCounts.pending}
            </span>
            <span>
              <i className="dot floor-cleaning" /> Setup {statusCounts.onboarding}
            </span>
            <span>
              <i className="dot floor-free" /> Other {statusCounts.other}
            </span>
          </div>
        </section>
      </div>

      {reviewTenantId ? (
        <TenantReviewDrawer
          tenantId={reviewTenantId}
          onClose={() => setReviewTenantId(null)}
          onChanged={load}
        />
      ) : null}
    </DashboardLayout>
  )
}

export default PlatformAdmin
