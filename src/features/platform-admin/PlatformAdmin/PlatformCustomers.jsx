import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
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

function PlatformCustomers() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .adminTenants(debounced)
      .then(({ tenants: rows }) => setTenants(rows || []))
      .catch((err) => {
        setTenants([])
        toast.error(err.message || 'Unable to load customers.')
      })
      .finally(() => setLoading(false))
  }, [debounced, toast])

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
      pageClassName="platform-admin-page"
      activeNav="platform-customers"
      variant="admin"
      adminSubtitle="All customers"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Customers</h1>
          <p>
            Restaurant owners and businesses across IROAS — contact details, plan, and account
            status.
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
          <div className="pa-toolbar" style={{ margin: 0 }}>
            <input
              type="search"
              placeholder="Search name, email, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="pa-empty">Loading customers…</p>
        ) : tenants.length === 0 ? (
          <p className="pa-empty">No customers match this search.</p>
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
