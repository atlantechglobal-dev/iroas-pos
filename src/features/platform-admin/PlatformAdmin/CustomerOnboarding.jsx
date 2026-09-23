import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { TenantReviewDrawer } from '@/shared/ui/admin/TenantReviewDrawer'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { platformAccountApproveProfilePath } from '@/shared/constants/routes'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

const PIPELINE = [
  {
    id: 'pending_approval',
    label: 'Awaiting',
    hint: 'New signups on Account approve',
    tone: 'approve',
  },
  {
    id: 'onboarding',
    label: 'In setup',
    hint: 'Still finishing the wizard',
    tone: 'setup',
  },
  {
    id: 'all',
    label: 'All pipeline',
    hint: 'Setup + awaiting',
    tone: 'all',
  },
]

const STATUS_LABEL = {
  onboarding: 'Onboarding',
  pending_approval: 'Awaiting approval',
  live: 'Active',
  rejected: 'Rejected',
}

const STATUS_CLASS = {
  onboarding: 'trial-status',
  pending_approval: 'past-status',
  live: 'active-status',
  rejected: 'suspended-status',
}

function CustomerOnboarding() {
  const toast = useToast()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('onboarding')
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [tenants, setTenants] = useState([])
  const [pipelineStats, setPipelineStats] = useState({ setup: 0, awaiting: 0 })
  const [loading, setLoading] = useState(true)
  const [reviewId, setReviewId] = useState(null)

  const loadPipelineStats = () => {
    Promise.all([api.adminTenants('', 'onboarding'), api.adminTenants('', 'pending_approval')])
      .then(([setupRes, awaitingRes]) => {
        setPipelineStats({
          setup: (setupRes.tenants || []).length,
          awaiting: (awaitingRes.tenants || []).length,
        })
      })
      .catch(() => {})
  }

  const loadList = () => {
    setLoading(true)
    const statusParam = filter === 'all' ? '' : filter
    api
      .adminTenants(debounced, statusParam)
      .then(({ tenants: rows }) => {
        const list = rows || []
        if (filter === 'all') {
          setTenants(
            list.filter((t) => t.status === 'onboarding' || t.status === 'pending_approval'),
          )
        } else {
          setTenants(list)
        }
      })
      .catch((err) => {
        setTenants([])
        toast.error(err.message || 'Unable to load onboarding queue.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPipelineStats()
  }, [])

  useEffect(() => {
    loadList()
  }, [debounced, filter])

  const reload = () => {
    loadPipelineStats()
    loadList()
  }

  const counts = useMemo(
    () => ({
      setup: pipelineStats.setup,
      awaiting: pipelineStats.awaiting,
      total: pipelineStats.setup + pipelineStats.awaiting,
      shown: tenants.length,
    }),
    [pipelineStats, tenants.length],
  )

  const openApproveProfile = (id) => {
    navigate(platformAccountApproveProfilePath(id))
  }

  const openReview = (id) => {
    setReviewId(id)
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-customer-onboarding"
      variant="admin"
      adminSubtitle="Onboarding pipeline"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Customer onboarding</h1>
          <p>
            Track restaurants still <strong>In setup</strong> or <strong>Awaiting</strong> account
            approval. Use <strong>Account approve</strong> for new Create Account signups.
          </p>
        </div>
      </div>

      <div className="pa-pipeline-tabs" role="tablist" aria-label="Onboarding filters">
        {PIPELINE.map((item) => {
          const count =
            item.id === 'pending_approval'
              ? counts.awaiting
              : item.id === 'onboarding'
                ? counts.setup
                : counts.total
          const active = filter === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pa-pipeline-tab tone-${item.tone}${active ? ' is-active' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              <span className="pa-pipeline-tab-top">
                <strong>{item.label}</strong>
                <em>{count}</em>
              </span>
              <small>{item.hint}</small>
            </button>
          )
        })}
      </div>

      <div className="pa-pipeline-search">
        <input
          type="search"
          placeholder="Search business or owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search onboarding list"
        />
      </div>

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>
              {filter === 'onboarding'
                ? 'In setup'
                : filter === 'pending_approval'
                  ? 'Awaiting approval'
                  : 'All pipeline'}
            </h2>
            <span>
              {loading
                ? 'Loading…'
                : `${counts.shown} shown · ${
                    filter === 'onboarding'
                      ? 'still completing the wizard'
                      : filter === 'pending_approval'
                        ? 'open Account approve profile'
                        : 'setup + awaiting mixed'
                  }`}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="pa-empty">Loading pipeline…</p>
        ) : tenants.length === 0 ? (
          <p className="pa-empty">No customers in this stage.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>BUSINESS</th>
                  <th>OWNER</th>
                  <th>PLAN</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((row) => {
                  const canApprove =
                    row.status === 'pending_approval' && row.awaitingAccountApproval
                  return (
                    <tr
                      key={row.id}
                      className="tenant-row"
                      onClick={() => (canApprove ? openApproveProfile(row.id) : openReview(row.id))}
                    >
                      <td>
                        <div className="tenant-business">
                          <span className="tenant-avatar" aria-hidden="true">
                            {(row.name || 'B').charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <strong>{row.name || 'Untitled business'}</strong>
                            <small>
                              {row.subdomain ? `${row.subdomain}.iroas.com` : 'No domain yet'}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{row.owner_name || '—'}</strong>
                        <small>{row.owner_email || ''}</small>
                      </td>
                      <td>
                        <span className="pa-plan-chip">{String(row.plan || 'starter')}</span>
                      </td>
                      <td>
                        <span className={`status ${STATUS_CLASS[row.status] || 'trial-status'}`}>
                          {STATUS_LABEL[row.status] || row.status}
                        </span>
                      </td>
                      <td>
                        <div
                          className="tenant-actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {canApprove ? (
                            <button
                              type="button"
                              className="pa-approve-btn"
                              onClick={() => openApproveProfile(row.id)}
                            >
                              Open Account approve
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="pa-view-btn"
                              onClick={() => openReview(row.id)}
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reviewId ? (
        <TenantReviewDrawer
          tenantId={reviewId}
          onClose={() => setReviewId(null)}
          onChanged={() => {
            setReviewId(null)
            reload()
          }}
        />
      ) : null}
    </DashboardLayout>
  )
}

export default CustomerOnboarding
