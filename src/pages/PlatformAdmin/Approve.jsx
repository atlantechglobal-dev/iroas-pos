import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { platformApproveProfilePath } from '../../constants/routes.js'
import { PlatformSubnav } from './PlatformSubnav.jsx'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

const TABS = [
  { id: 'pending_approval', label: 'Waiting', hint: 'Need your decision' },
  { id: 'live', label: 'Approved', hint: 'Already published' },
]

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function reviewerLine(row) {
  const name = row.reviewer_name || row.reviewer_email
  if (!name) return 'Approved by an admin'
  if (row.reviewer_name && row.reviewer_email) {
    return `Approved by ${row.reviewer_name} (${row.reviewer_email})`
  }
  return `Approved by ${name}`
}

function Approve() {
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending_approval')
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [tenants, setTenants] = useState([])
  const [counts, setCounts] = useState({ waiting: 0, approved: 0 })
  const [loading, setLoading] = useState(true)

  const loadCounts = () => {
    Promise.all([api.adminTenants('', 'pending_approval'), api.adminTenants('', 'live')])
      .then(([waitingRes, liveRes]) => {
        setCounts({
          waiting: (waitingRes.tenants || []).length,
          approved: (liveRes.tenants || []).length,
        })
      })
      .catch(() => {})
  }

  const loadList = () => {
    setLoading(true)
    api
      .adminTenants(debounced, tab)
      .then(({ tenants: rows }) => setTenants(rows || []))
      .catch((err) => {
        setTenants([])
        toast.error(err.message || 'Unable to load Approve list.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCounts()
  }, [])

  useEffect(() => {
    loadList()
  }, [debounced, tab])

  const openProfile = (id) => {
    navigate(platformApproveProfilePath(id))
  }

  const isWaiting = tab === 'pending_approval'

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-approve"
      variant="admin"
      adminSubtitle="Approve restaurants"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Approve</h1>
          <p>
            Review waiting restaurants, or open already approved profiles to see who published them.
          </p>
        </div>
      </div>

      <PlatformSubnav active="platform-approve" />

      <div className="pa-pipeline-tabs" role="tablist" aria-label="Approve filters">
        {TABS.map((item) => {
          const count = item.id === 'pending_approval' ? counts.waiting : counts.approved
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pa-pipeline-tab tone-${item.id === 'live' ? 'all' : 'approve'}${
                active ? ' is-active' : ''
              }`}
              onClick={() => setTab(item.id)}
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
          placeholder={isWaiting ? 'Search waiting list…' : 'Search approved…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search Approve list"
        />
      </div>

      <section className="pa-approve-panel">
        <div className="pa-approve-panel-head">
          <div>
            <h2>{isWaiting ? 'Waiting for decision' : 'Already approved'}</h2>
            <p>
              {loading
                ? 'Loading…'
                : tenants.length
                  ? `${tenants.length} restaurant${tenants.length === 1 ? '' : 's'}`
                  : isWaiting
                    ? 'Nothing waiting for approval'
                    : 'No approved restaurants yet'}
            </p>
          </div>
          {isWaiting && tenants.length > 0 ? (
            <span className="pa-approve-panel-badge">{tenants.length} to approve</span>
          ) : null}
        </div>

        {loading ? (
          <p className="pa-empty">Loading…</p>
        ) : tenants.length === 0 ? (
          <p className="pa-empty">
            {isWaiting
              ? 'No restaurants awaiting approval right now.'
              : 'Approved restaurants will appear here.'}
          </p>
        ) : (
          <div className="pa-approve-list">
            {tenants.map((row) => (
              <article key={row.id} className="pa-approve-card">
                <div className="pa-approve-card-main">
                  <span className="tenant-avatar" aria-hidden="true">
                    {(row.name || 'B').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="pa-approve-card-title">
                      <strong>{row.name || 'Untitled business'}</strong>
                      <span className={`status ${isWaiting ? 'past-status' : 'active-status'}`}>
                        {isWaiting ? 'Awaiting approval' : 'Approved & live'}
                      </span>
                    </div>
                    <p>
                      {row.owner_name || '—'} · {row.owner_email || 'No email'}
                    </p>
                    <p className="pa-approve-card-meta">
                      {isWaiting ? (
                        <>
                          {row.subdomain ? `${row.subdomain}.iroas.com` : 'No domain yet'}
                          {' · '}
                          Plan {String(row.plan || 'starter')}
                          {' · '}
                          Submitted {formatWhen(row.submitted_at)}
                        </>
                      ) : (
                        <>
                          {reviewerLine(row)}
                          {' · '}
                          {formatWhen(row.reviewed_at || row.launched_at)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="pa-approve-card-actions">
                  <button
                    type="button"
                    className={isWaiting ? 'pa-approve-btn' : 'pa-view-btn'}
                    onClick={() => openProfile(row.id)}
                  >
                    {isWaiting ? 'Open profile' : 'View approval'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}

export default Approve
