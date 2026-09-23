import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'
import '@/features/platform-admin/PlatformAdmin/AccountApprove.css'

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

function statusTone(status, isWaiting) {
  if (isWaiting) return 'waiting'
  if (status === 'rejected') return 'rejected'
  if (status === 'live') return 'live'
  return 'approved'
}

function statusLabel(status, isWaiting) {
  if (isWaiting) return 'Awaiting approval'
  if (!status) return 'Unknown'
  return String(status).replace(/_/g, ' ')
}

function AccountApproveProfile() {
  const { tenantId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const goBack = () => navigate(ROUTES.PLATFORM_ACCOUNT_APPROVE)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.adminTenant(tenantId)
      setTenant(data.tenant || null)
    } catch (err) {
      setTenant(null)
      toast.error(err.message || 'Unable to load account.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tenantId])

  const isWaiting = Boolean(
    tenant?.awaitingAccountApproval && tenant?.status === 'pending_approval',
  )
  const isSignupWaiting = isWaiting

  const approve = async () => {
    setBusy('approve')
    try {
      const data = await api.adminApproveTenant(tenantId, {})
      setTenant(data.tenant || null)
      toast.success(
        `Approved — login email sent to ${tenant?.owner?.email || tenant?.email || 'owner'}.`,
      )
    } catch (err) {
      toast.error(err.message || 'Unable to approve.')
    } finally {
      setBusy('')
    }
  }

  const reject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Add a short reason for the owner.')
      return
    }
    setBusy('reject')
    try {
      const data = await api.adminRejectTenant(tenantId, rejectReason.trim())
      setTenant(data.tenant || null)
      setRejectOpen(false)
      toast.success('Account rejected.')
    } catch (err) {
      toast.error(err.message || 'Unable to reject.')
    } finally {
      setBusy('')
    }
  }

  const ownerName = tenant?.owner?.name || '—'
  const ownerEmail = tenant?.owner?.email || tenant?.email || '—'
  const ownerPhone = tenant?.owner?.phone || tenant?.phone || '—'
  const businessName = tenant?.name || 'Untitled business'
  const initial = String(businessName).charAt(0).toUpperCase() || 'B'
  const tone = statusTone(tenant?.status, isWaiting)

  return (
    <DashboardLayout
      pageClassName="platform-admin-page account-approve-page"
      activeNav="platform-account-approve"
      variant="admin"
      adminSubtitle="Account approval"
    >
      <div className="page-header pa-approve-profile-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Account approval</h1>
          <p>Review this signup, then approve to send a login email and unlock onboarding.</p>
        </div>
        <button type="button" className="pa-view-btn" onClick={goBack}>
          ← Back to list
        </button>
      </div>

      {loading ? <p className="pa-empty">Loading…</p> : null}
      {!loading && !tenant ? <p className="pa-empty">Account not found.</p> : null}

      {!loading && tenant ? (
        <div className="aa-detail-layout">
          <aside className="aa-identity-card">
            <div className="aa-identity-top">
              <span className="aa-avatar" aria-hidden="true">
                {initial}
              </span>
              <div className="aa-identity-copy">
                <h2>{businessName}</h2>
                <p>{ownerName}</p>
                <span className={`aa-status-pill tone-${tone}`}>
                  {statusLabel(tenant.status, isWaiting)}
                </span>
              </div>
            </div>

            <ul className="aa-identity-facts">
              <li>
                <em>Login email</em>
                <strong>{ownerEmail}</strong>
              </li>
              <li>
                <em>Mobile</em>
                <strong>{ownerPhone}</strong>
              </li>
              <li>
                <em>Category</em>
                <strong>{tenant.businessCategory || '—'}</strong>
              </li>
              <li>
                <em>City</em>
                <strong>{tenant.city || '—'}</strong>
              </li>
            </ul>

            {isWaiting ? (
              <div className="aa-identity-actions">
                <button
                  type="button"
                  className="pa-approve-btn"
                  disabled={busy === 'approve'}
                  onClick={approve}
                >
                  {busy === 'approve' ? 'Approving…' : 'Approve & send login email'}
                </button>
                <button
                  type="button"
                  className="pa-view-btn"
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </button>
              </div>
            ) : null}
          </aside>

          <div className="aa-detail-main">
            {isWaiting ? (
              <div className="aa-banner tone-waiting">
                <strong>
                  {isSignupWaiting ? 'New signup awaiting approval' : 'Paid · awaiting approval'}
                </strong>
                <span>
                  {isSignupWaiting
                    ? `Approving emails ${ownerEmail} and unlocks onboarding for this business.`
                    : `Approving publishes the store and emails ${ownerEmail}. Dashboard unlocks after this.`}
                </span>
              </div>
            ) : (
              <div
                className={`aa-banner tone-${tenant.status === 'rejected' ? 'rejected' : 'ok'}`}
              >
                <strong>
                  {tenant.status === 'rejected'
                    ? 'Rejected'
                    : tenant.status === 'live'
                      ? 'Published & live'
                      : 'Account approved'}
                </strong>
                <span>
                  {tenant.status === 'rejected'
                    ? tenant.rejectionReason || 'Owner was asked to update details.'
                    : `Reviewed · ${formatWhen(tenant.reviewedAt)}`}
                </span>
              </div>
            )}

            <section className="aa-detail-card">
              <div className="aa-detail-card-head">
                <h3>Application details</h3>
                <span>Signed up {formatWhen(tenant.submittedAt || tenant.createdAt)}</span>
              </div>
              <dl className="aa-detail-grid">
                <div>
                  <dt>Business</dt>
                  <dd>{businessName}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{ownerName}</dd>
                </div>
                <div>
                  <dt>Login email</dt>
                  <dd>{ownerEmail}</dd>
                </div>
                <div>
                  <dt>Mobile</dt>
                  <dd>{ownerPhone}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{tenant.businessCategory || '—'}</dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>{tenant.city || '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={`aa-status-pill tone-${tone}`}>
                      {statusLabel(tenant.status, isWaiting)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Signed up</dt>
                  <dd>{formatWhen(tenant.submittedAt || tenant.createdAt)}</dd>
                </div>
              </dl>
            </section>

            {rejectOpen ? (
              <section className="aa-detail-card aa-reject-card">
                <div className="aa-detail-card-head">
                  <h3>Reject account</h3>
                  <span>This reason is sent to the owner</span>
                </div>
                <textarea
                  className="aa-reject"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Tell the owner what to fix…"
                  rows={4}
                />
                <div className="aa-detail-actions">
                  <button type="button" className="pa-view-btn" onClick={() => setRejectOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="aa-reject-confirm"
                    disabled={busy === 'reject'}
                    onClick={reject}
                  >
                    {busy === 'reject' ? 'Sending…' : 'Confirm reject'}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default AccountApproveProfile
