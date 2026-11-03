import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { OnboardingChip } from '@/shared/ui/setup-progress/SetupProgress'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

const STATUS_LABEL = {
  live: 'Active',
  onboarding: 'Onboarding',
  pending_approval: 'Awaiting approval',
  rejected: 'Rejected',
}

const STATUS_CLASS = {
  live: 'active-status',
  onboarding: 'trial-status',
  pending_approval: 'past-status',
  rejected: 'suspended-status',
}

const LIST_TITLE = {
  live: 'Live tenants',
  onboarding: 'In onboarding',
  rejected: 'Rejected accounts',
  pending_approval: 'Awaiting approval',
}

function PlatformCustomers() {
  const toast = useToast()
  const [params] = useSearchParams()
  const status = params.get('status') || ''
  const [search, setSearch] = useState(() => params.get('q') || '')
  const debounced = useDebounce(search, 250)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSearch(params.get('q') || '')
  }, [params])

  useEffect(() => {
    setLoading(true)
    api
      .adminTenants(debounced, status)
      .then(({ tenants: rows }) => setTenants(rows || []))
      .catch((err) => {
        setTenants([])
        toast.error(err.message || 'Unable to load customers.')
      })
      .finally(() => setLoading(false))
  }, [debounced, status, toast])

  const stats = useMemo(() => {
    const owners = new Set(tenants.map((t) => t.owner_email || t.owner_name).filter(Boolean))
    return {
      businesses: tenants.length,
      owners: owners.size,
      live: tenants.filter((t) => t.status === 'live').length,
    }
  }, [tenants])

  return (
    <DashboardLayout
      pageClassName="platform-admin-page platform-customers-page"
      activeNav="platform-customers"
      variant="admin"
      adminSubtitle="All customers"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>{LIST_TITLE[status] || 'Customers'}</h1>
          <p>
            {status === 'live'
              ? 'Published businesses that are live on IROAS.'
              : status === 'rejected'
                ? 'Accounts sent back to the owner.'
                : 'Restaurant owners and businesses across IROAS — contact details, plan, and account status.'}
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Businesses</div>
          <div className="stat-number">{stats.businesses}</div>
          <div className="stat-small">in this list</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Owners</div>
          <div className="stat-number">{stats.owners}</div>
          <div className="stat-small">unique emails</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Live</div>
          <div className="stat-number">{stats.live}</div>
          <div className="stat-small">published</div>
        </div>
      </div>

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>Customer directory</h2>
            <span>{loading ? 'Loading…' : `${tenants.length} shown`}</span>
          </div>
          <label className="dir-search">
            <span className="dir-search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search name, email, city…"
              aria-label="Search customer directory"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p className="pa-empty">Loading customers…</p>
        ) : tenants.length === 0 ? (
          <p className="pa-empty">
            {search.trim()
              ? 'No customers match this search.'
              : status === 'rejected'
                ? 'No rejected accounts.'
                : status === 'live'
                  ? 'No live tenants.'
                  : 'No customers in this list.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Setup</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name || '—'}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {[row.city, row.country].filter(Boolean).join(', ') || '—'}
                      </div>
                    </td>
                    <td>{row.owner_name || '—'}</td>
                    <td>{row.owner_email || '—'}</td>
                    <td>{String(row.plan || 'starter')}</td>
                    <td>
                      <span className={STATUS_CLASS[row.status] || 'trial-status'}>
                        {STATUS_LABEL[row.status] || row.status}
                      </span>
                    </td>
                    <td>
                      <OnboardingChip done={row.onboardingDone} total={row.onboardingTotal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}

export default PlatformCustomers
