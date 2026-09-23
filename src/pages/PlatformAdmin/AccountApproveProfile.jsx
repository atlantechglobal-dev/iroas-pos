import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'
import './AccountApprove.css'

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

  const isSignupWaiting = Boolean(tenant?.awaitingAccountApproval)
  const isWaiting = Boolean(isSignupWaiting && tenant?.status === 'pending_approval')

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
          <p>Approve this Create Account signup to email a login link and unlock onboarding.</p>
        </div>
        <button type="button" className="pa-view-btn" onClick={goBack}>
          ← Back to Account approve
        </button>
      </div>

      {loading ? <p className="pa-empty">Loading…</p> : null}

      {!loading && !tenant ? <p className="pa-empty">Account not found.</p> : null}

      {!loading && tenant ? (
        <div className="aa-detail">
          {isWaiting ? (
            <div className="aa-banner">
              <strong>
                {isSignupWaiting ? 'New signup awaiting approval' : 'Paid · awaiting approval'}
              </strong>
              {isSignupWaiting
                ? `Approving emails ${tenant.owner?.email || tenant.email || 'the owner'} and unlocks onboarding.`
                : `Approving publishes the store and emails ${tenant.owner?.email || tenant.email || 'the owner'}. Dashboard unlocks after this.`}
            </div>
          ) : (
            <div className="aa-banner">
              <strong>
                {tenant.status === 'rejected'
                  ? 'Rejected'
                  : tenant.status === 'live'
                    ? 'Published & live'
                    : 'Account approved'}
              </strong>
              {tenant.status === 'rejected'
                ? tenant.rejectionReason || 'Owner was asked to update details.'
                : `Reviewed · ${formatWhen(tenant.reviewedAt)}`}
            </div>
          )}

          <section className="aa-detail-card">
            <h2>{tenant.name || 'Untitled business'}</h2>
            <dl className="aa-detail-rows">
              <div>
                <dt>Owner</dt>
                <dd>{tenant.owner?.name || '—'}</dd>
              </div>
              <div>
                <dt>Login email</dt>
                <dd>{tenant.owner?.email || tenant.email || '—'}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{tenant.owner?.phone || tenant.phone || '—'}</dd>
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
                <dt>Signed up</dt>
                <dd>{formatWhen(tenant.submittedAt || tenant.createdAt)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{tenant.status?.replace(/_/g, ' ') || '—'}</dd>
              </div>
            </dl>
          </section>

          {isWaiting ? (
            <div className="aa-detail-actions">
              <button
                type="button"
                className="pa-approve-btn"
                disabled={busy === 'approve'}
                onClick={approve}
              >
                {busy === 'approve' ? 'Approving…' : 'Approve & send login email'}
              </button>
              <button type="button" className="pa-view-btn" onClick={() => setRejectOpen(true)}>
                Reject
              </button>
            </div>
          ) : null}

          {rejectOpen ? (
            <section className="aa-detail-card">
              <h2>Reject account</h2>
              <textarea
                className="aa-reject"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Tell the owner what to fix…"
                rows={4}
              />
              <div className="aa-detail-actions" style={{ marginTop: 12 }}>
                <button type="button" className="pa-view-btn" onClick={() => setRejectOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="pa-approve-btn"
                  style={{ background: '#b42318', color: '#fff' }}
                  disabled={busy === 'reject'}
                  onClick={reject}
                >
                  {busy === 'reject' ? 'Sending…' : 'Confirm reject'}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default AccountApproveProfile
