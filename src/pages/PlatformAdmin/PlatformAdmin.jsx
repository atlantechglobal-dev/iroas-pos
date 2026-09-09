import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { TenantReviewDrawer } from '../../components/admin/TenantReviewDrawer.jsx'
import './PlatformAdmin.css'

const INITIAL_FLAGS = [
  {
    key: 'kds_v2',
    description: 'New kitchen display layout · 38% of tenants',
    enabled: true,
  },
  {
    key: 'ai_menu_copy',
    description: 'AI-written dish descriptions · Beta cohort',
    enabled: true,
  },
  {
    key: 'table_merge',
    description: 'Merge & split tables on the floor · All tenants',
    enabled: true,
  },
  {
    key: 'loyalty_wallet',
    description: 'Stored-value customer wallet · Internal only',
    enabled: false,
  },
  {
    key: 'whatsapp_alerts',
    description: 'Order updates over WhatsApp · 12% of tenants',
    enabled: false,
  },
]

const SYSTEM_HEALTH = [
  { label: 'API', status: 'p95 128 ms · 0 errors', dot: 'green' },
  { label: 'Order pipeline', status: 'queue depth 4', dot: 'green' },
  {
    label: 'Payments webhook',
    status: '1 retry in last hour',
    dot: 'green',
  },
  { label: 'POS bridge', status: '1 tenant degraded', dot: 'yellow' },
]

const AUDIT_LOG = [
  {
    text: 'Suspended tenant Kaapi Club',
    meta: 'you@iroas.io · 12 min ago',
  },
  {
    text: 'Enabled flag ai_menu_copy for Bao Republic',
    meta: 'ops@iroas.io · 2 hr ago',
  },
  {
    text: 'Upgraded Nomad Pizzeria to Growth',
    meta: 'you@iroas.io · yesterday',
  },
  {
    text: 'Issued credit note ₹1,999 to Coast & Co.',
    meta: 'billing@iroas.io · 2 days ago',
  },
]

const STATUS_CLASS = {
  live: 'active-status',
  onboarding: 'trial-status',
  pending_approval: 'past-status',
  rejected: 'suspended-status',
}

const STATUS_LABEL = {
  live: 'Active',
  onboarding: 'Onboarding',
  pending_approval: 'Awaiting approval',
  rejected: 'Rejected',
}

const TENANT_FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending_approval', label: 'Awaiting' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'live', label: 'Live' },
  { id: 'rejected', label: 'Rejected' },
]

function PlatformAdmin() {
  const toast = useToast()

  const [tenantSearch, setTenantSearch] = useState('')
  const debouncedSearch = useDebounce(tenantSearch, 250)
  const [flags, setFlags] = useState(INITIAL_FLAGS)
  const [tenants, setTenants] = useState([])
  const [stats, setStats] = useState(null)
  const [reviewTenantId, setReviewTenantId] = useState(null)
  const [tenantFilter, setTenantFilter] = useState('')

  const loadTenants = (search = debouncedSearch, status = tenantFilter) => {
    api
      .adminTenants(search, status)
      .then(({ tenants }) => setTenants(tenants))
      .catch(() => setTenants([]))
  }

  useEffect(() => {
    loadTenants()
    api
      .adminStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  useEffect(() => {
    loadTenants(debouncedSearch, tenantFilter)
  }, [debouncedSearch, tenantFilter])

  const toggleFlag = (key) => {
    setFlags((prev) =>
      prev.map((flag) =>
        flag.key === key ? { ...flag, enabled: !flag.enabled } : flag,
      ),
    )
  }

  const handleImpersonate = (name) => {
    toast.info(`Impersonating ${name}`)
  }

  const refreshTenants = () => {
    loadTenants(debouncedSearch, tenantFilter)
    api.adminStats().then(setStats).catch(() => {})
  }

  const STATS = stats
    ? [
        { title: '▣   Active tenants', number: stats.activeTenants, small: 'currently live' },
        { title: '⌁   Onboarding', number: stats.onboardingTenants, small: 'in setup' },
        {
          title: '◐   Pending approval',
          number: stats.pendingApprovals ?? 0,
          small: 'awaiting review',
        },
        {
          title: '⊘   Rejected',
          number: stats.rejectedTenants ?? 0,
          small: 'sent back',
        },
      ]
    : []

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-admin"
      variant="admin"
      adminSubtitle={stats ? `${stats.totalTenants} tenants` : 'All tenants'}
    >
          {/* PAGE HEADER */}
          <div className="page-header">
            <div>
              <div className="page-label">PLATFORM</div>

              <h1>Platform Admin</h1>

              <p>
                Operator-only view across every restaurant on IROAS: tenants,
                plans, feature rollout and system health.
              </p>
            </div>

            <button
              className="new-tenant"
              onClick={() => toast.info('New tenant flow is not available yet.')}
            >
              <img src="/images/new.svg" alt="New tenant" />
              <span>New tenant</span>
            </button>
          </div>

          {/* STAT CARDS */}
          <div className="stats-grid">
            {STATS.map((stat) => (
              <div className="stat-card" key={stat.title}>
                <div className="stat-title">{stat.title}</div>
                <div className="stat-number">{stat.number}</div>
                <div className="stat-small">{stat.small}</div>
              </div>
            ))}
          </div>

          {/* TENANTS */}
          <section className="tenants-card">
            <div className="card-header">
              <div>
                <h2>Tenants</h2>
                <span>{tenants.length} shown · review before publish</span>
              </div>

              <div className="tenant-toolbar">
                <div className="tenant-filters">
                  {TENANT_FILTERS.map((filter) => (
                    <button
                      key={filter.id || 'all'}
                      type="button"
                      className={`tenant-filter ${tenantFilter === filter.id ? 'is-active' : ''}`}
                      onClick={() => setTenantFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={tenantSearch}
                  onChange={(event) => setTenantSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>BUSINESS</th>
                    <th>OWNER</th>
                    <th>PLAN</th>
                    <th>SUBMITTED</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {tenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="tenant-row"
                      onClick={() => setReviewTenantId(tenant.id)}
                    >
                      <td>
                        <div className="tenant-business">
                          <span className="tenant-avatar" aria-hidden="true">
                            {(tenant.name || 'B').charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <strong>{tenant.name || 'Untitled business'}</strong>
                            <small>{tenant.city || 'No city set'}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{tenant.owner_name}</strong>
                        <small>{tenant.owner_email}</small>
                      </td>
                      <td>{tenant.plan}</td>
                      <td>
                        {tenant.submitted_at
                          ? new Date(tenant.submitted_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>
                        <span className={`status ${STATUS_CLASS[tenant.status] || 'trial-status'}`}>
                          {STATUS_LABEL[tenant.status] || tenant.status}
                        </span>
                      </td>
                      <td>
                        <div className="tenant-actions" onClick={(event) => event.stopPropagation()}>
                          <button
                            className="impersonate"
                            type="button"
                            onClick={() => setReviewTenantId(tenant.id)}
                          >
                            {tenant.status === 'pending_approval' ? 'Review' : 'View'}
                          </button>
                          {tenant.status !== 'pending_approval' && (
                            <button
                              className="impersonate"
                              type="button"
                              onClick={() =>
                                handleImpersonate(tenant.name || tenant.owner_name)
                              }
                            >
                              Impersonate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                        No tenants match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* BOTTOM */}
          <div className="bottom-grid">
            {/* FEATURE FLAGS */}
            <section className="feature-card">
              <div className="feature-header">
                <h2>Feature flags</h2>
                <span>Gradual rollout across tenants</span>
              </div>

              {flags.map((flag) => (
                <div className="feature-row" key={flag.key}>
                  <div className="flag-icon">⚑</div>

                  <div className="feature-info">
                    <strong>{flag.key}</strong>
                    <small>{flag.description}</small>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={flag.enabled}
                      onChange={() => toggleFlag(flag.key)}
                    />
                    <span></span>
                  </label>
                </div>
              ))}
            </section>

            {/* RIGHT COLUMN */}
            <div className="right-column">
              {/* SYSTEM HEALTH */}
              <div className="side-card system-health">
                <h2>System health</h2>

                {SYSTEM_HEALTH.map((item) => (
                  <div className="health-item" key={item.label}>
                    <div className="health-left">
                      <img
                        src="/images/db.svg"
                        className="health-icon"
                        alt=""
                      />
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.status}</p>
                      </div>
                    </div>
                    <span className={`status-dot ${item.dot}`}></span>
                  </div>
                ))}
              </div>

              {/* AUDIT TRAIL */}
              <section className="small-card audit-card">
                <h2>Audit trail</h2>
                <p>Operator actions</p>

                {AUDIT_LOG.map((entry) => (
                  <div className="audit-item" key={entry.text}>
                    <img src="/images/audit.svg" alt="icon" />
                    <div>
                      <strong>{entry.text}</strong>
                      <small>{entry.meta}</small>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </div>
          {reviewTenantId ? (
            <TenantReviewDrawer
              tenantId={reviewTenantId}
              onClose={() => setReviewTenantId(null)}
              onChanged={refreshTenants}
            />
          ) : null}
    </DashboardLayout>
  )
}

export default PlatformAdmin
