import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { platformAccountApproveProfilePath } from '../../constants/routes.js'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'
import './AccountApprove.css'

const TABS = [
  { id: 'waiting', label: 'Waiting', hint: 'New signups to approve' },
  { id: 'approved', label: 'Approved', hint: 'Setup unlocked' },
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

function AccountApprove() {
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState('waiting')
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [tenants, setTenants] = useState([])
  const [counts, setCounts] = useState({ waiting: 0, approved: 0 })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [confirmRow, setConfirmRow] = useState(null)

  const loadCounts = () => {
    Promise.all([
      api.adminTenants('', 'waiting', 'account'),
      api.adminTenants('', 'approved', 'account'),
    ])
      .then(([waitingRes, approvedRes]) => {
        setCounts({
          waiting: (waitingRes.tenants || []).length,
          approved: (approvedRes.tenants || []).length,
        })
      })
      .catch(() => {})
  }

  const loadList = () => {
    setLoading(true)
    api
      .adminTenants(debounced, tab, 'account')
      .then(({ tenants: rows }) => setTenants(rows || []))
      .catch((err) => {
        setTenants([])
        toast.error(err.message || 'Unable to load account approvals.')
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
    navigate(platformAccountApproveProfilePath(id))
  }

  const requestApprove = (row) => {
    setConfirmRow(row)
  }

  const closeConfirm = () => {
    if (busyId) return
    setConfirmRow(null)
  }

  const confirmApprove = async () => {
    if (!confirmRow) return
    const row = confirmRow
    const email = row.owner_email || row.restaurant_email || 'the owner'
    setBusyId(row.id)
    try {
      await api.adminApproveTenant(row.id, {})
      setConfirmRow(null)
      toast.success(`Approved — login email sent to ${email}.`)
      loadCounts()
      loadList()
    } catch (err) {
      toast.error(err.message || 'Unable to approve.')
    } finally {
      setBusyId('')
    }
  }

  const isWaiting = tab === 'waiting'
  const confirmEmail =
    confirmRow?.owner_email || confirmRow?.restaurant_email || 'the owner'
  const confirmName = confirmRow?.name || 'this account'
  const confirmBusy = Boolean(confirmRow && busyId === confirmRow.id)

  return (
    <DashboardLayout
      pageClassName="platform-admin-page account-approve-page"
      activeNav="platform-account-approve"
      variant="admin"
      adminSubtitle="Account approvals"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
            <h1>Account approve</h1>
            <p>
              Review Create Account signups. Approving sends email and unlocks onboarding — no other
              approval steps.
            </p>
        </div>
      </div>

      <div className="pa-pipeline-tabs" role="tablist" aria-label="Account approve filters">
        {TABS.map((item) => {
          const count = item.id === 'waiting' ? counts.waiting : counts.approved
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pa-pipeline-tab tone-${item.id === 'approved' ? 'all' : 'approve'}${
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
          placeholder={isWaiting ? 'Search new signups…' : 'Search approved accounts…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search account approve list"
        />
      </div>

      <section className="pa-approve-panel aa-panel">
        <div className="pa-approve-panel-head">
          <div>
            <h2>{isWaiting ? 'New accounts waiting' : 'Accounts approved'}</h2>
            <p>
              {loading
                ? 'Loading…'
                : tenants.length
                  ? `${tenants.length} account${tenants.length === 1 ? '' : 's'}`
                  : isWaiting
                    ? 'No new signups waiting'
                    : 'No approved accounts yet'}
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
              ? 'No Create Account submissions awaiting approval.'
              : 'Approved accounts will appear here after you unlock setup.'}
          </p>
        ) : (
          <div className="aa-list">
            {tenants.map((row) => (
              <article key={row.id} className="aa-card">
                <div className="aa-card-main">
                  <span className="tenant-avatar" aria-hidden="true">
                    {(row.name || 'A').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="pa-approve-card-title">
                      <strong>{row.name || 'Untitled business'}</strong>
                      <span className={`status ${isWaiting ? 'past-status' : 'active-status'}`}>
                        {isWaiting
                          ? row.awaitingAccountApproval
                            ? 'New signup'
                            : 'Paid · awaiting approve'
                          : 'Approved'}
                      </span>
                    </div>
                    <p className="aa-owner">
                      {row.owner_name || '—'} · {row.owner_email || row.restaurant_email || 'No email'}
                    </p>
                    <div className="aa-meta-grid">
                      <span>
                        <em>Category</em>
                        {row.businessCategory || '—'}
                      </span>
                      <span>
                        <em>City</em>
                        {row.city || '—'}
                      </span>
                      <span>
                        <em>Mobile</em>
                        {row.owner_phone || row.restaurant_phone || '—'}
                      </span>
                      <span>
                        <em>{isWaiting ? 'Signed up' : 'Approved'}</em>
                        {formatWhen(
                          isWaiting
                            ? row.submitted_at || row.created_at
                            : row.accountApprovedAt || row.reviewed_at,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="aa-card-actions">
                  <button type="button" className="pa-view-btn" onClick={() => openProfile(row.id)}>
                    {isWaiting ? 'Review' : 'View'}
                  </button>
                  {isWaiting ? (
                    <button
                      type="button"
                      className="pa-approve-btn"
                      disabled={busyId === row.id}
                      onClick={() => requestApprove(row)}
                    >
                      {busyId === row.id ? 'Approving…' : 'Approve & email'}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {confirmRow
        ? createPortal(
            <div className="aa-confirm-overlay" role="presentation">
              <button
                type="button"
                className="aa-confirm-backdrop"
                aria-label="Close"
                onClick={closeConfirm}
              />
              <div
                className="aa-confirm-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="aa-confirm-title"
              >
                <p className="aa-confirm-kicker">Account approve</p>
                <h3 id="aa-confirm-title">Approve this signup?</h3>
                <p className="aa-confirm-body">
                  Unlock onboarding for <strong>{confirmName}</strong>. A login email will be sent
                  to <strong>{confirmEmail}</strong>.
                </p>
                <dl className="aa-confirm-meta">
                  <div>
                    <dt>Business</dt>
                    <dd>{confirmName}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{confirmRow.owner_name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{confirmEmail}</dd>
                  </div>
                  {confirmRow.city ? (
                    <div>
                      <dt>City</dt>
                      <dd>{confirmRow.city}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="aa-confirm-actions">
                  <button
                    type="button"
                    className="aa-confirm-cancel"
                    onClick={closeConfirm}
                    disabled={confirmBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="aa-confirm-submit"
                    onClick={confirmApprove}
                    disabled={confirmBusy}
                  >
                    {confirmBusy ? 'Approving…' : 'Approve & send email'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </DashboardLayout>
  )
}

export default AccountApprove
