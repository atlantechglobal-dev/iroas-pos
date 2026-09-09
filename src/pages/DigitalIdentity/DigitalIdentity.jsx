import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import {
  formatStatus,
  isIdentityEditable,
  isIdentityUnlocked,
  PRODUCT_TYPE_LABELS,
} from '../../constants/digitalIdentity.js'
import './DigitalIdentity.css'

function statusClass(status) {
  if (!status || status === 'draft') return 'di-badge muted'
  if (status === 'submitted' || status === 'under_review' || status === 'needs_info') {
    return 'di-badge warn'
  }
  if (status === 'approved' || status === 'completed') return 'di-badge ok'
  if (status === 'rejected') return 'di-badge bad'
  return 'di-badge muted'
}

function DigitalIdentity() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [identity, setIdentity] = useState(null)
  const [products, setProducts] = useState([])
  const [events, setEvents] = useState([])
  const [confirmation, setConfirmation] = useState('')

  const load = () => {
    setLoading(true)
    api
      .getIdentity()
      .then((data) => {
        setIdentity(data.identity)
        setProducts(data.products || [])
        setEvents(data.events || [])
      })
      .catch((err) => toast.error(err.message || 'Unable to load Digital Identity.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const msg = sessionStorage.getItem('di_submit_message')
    if (msg) {
      setConfirmation(msg)
      sessionStorage.removeItem('di_submit_message')
    }
  }, [])

  const unlocked = isIdentityUnlocked(identity?.status)
  const editable = isIdentityEditable(identity?.status)

  const productMap = useMemo(() => {
    const map = {}
    for (const p of products) map[p.productType] = p
    return map
  }, [products])

  const ctaLabel = !identity
    ? 'Create Digital Identity Kit'
    : editable
      ? identity.status === 'draft'
        ? 'Continue form'
        : 'Update & resubmit'
      : 'View submission'

  return (
    <DashboardLayout pageClassName="digital-identity-page" activeNav="digital-identity">
      <div className="page-head">
        <div>
          <p className="eyebrow">IDENTITY</p>
          <h1>Digital Identity Kit</h1>
          <p className="page-desc">
            Submit your business information for any SME vertical. Our team validates it manually
            before Website, Digital Business Card, and Mobile Application onboarding unlock.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate(ROUTES.DIGITAL_IDENTITY_FORM)}
        >
          {ctaLabel}
        </button>
      </div>

      {confirmation ? (
        <div className="di-confirm" role="status">
          <strong>Submission received</strong>
          <p>{confirmation}</p>
        </div>
      ) : null}

      {loading ? (
        <p className="di-muted">Loading…</p>
      ) : (
        <>
          <section className="card di-status-card">
            <div className="di-status-row">
              <div>
                <p className="eyebrow">Current status</p>
                <h2>{identity?.businessName || 'No Digital Identity yet'}</h2>
                <p className="di-muted">
                  {identity?.referenceId
                    ? `Reference ${identity.referenceId}`
                    : 'Start the form to create your Digital Identity request.'}
                </p>
              </div>
              <span className={statusClass(identity?.status)}>
                {formatStatus(identity?.status || 'not_started')}
              </span>
            </div>

            {!unlocked && identity && !editable ? (
              <p className="di-lock-note">
                Please wait for internal approval before product onboarding becomes available.
              </p>
            ) : null}

            {identity?.status === 'needs_info' ? (
              <p className="di-lock-note warn">
                Additional information was requested. Please update your form and resubmit.
              </p>
            ) : null}

            {identity?.status === 'rejected' ? (
              <p className="di-lock-note bad">
                This submission was rejected. Update the form and resubmit when ready.
              </p>
            ) : null}

            {Array.isArray(identity?.assets) && identity.assets.length > 0 ? (
              <div className="di-assets">
                <h3>Finalized assets</h3>
                <ul>
                  {identity.assets.map((asset, i) => (
                    <li key={i}>
                      {asset.name || `Asset ${i + 1}`}
                      {asset.url ? (
                        <a href={asset.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Available products</h2>
                <span>
                  {unlocked
                    ? 'Reuse your approved Digital Identity — no re-entry of business details.'
                    : 'Unlocks after Digital Identity is approved.'}
                </span>
              </div>
            </div>

            <div className="di-product-grid">
              {['website', 'digital_business_card', 'mobile_app'].map((type) => {
                const product = productMap[type]
                const disabled = !unlocked
                const go = () => {
                  if (disabled) {
                    toast.info('Wait for Digital Identity approval first.')
                    return
                  }
                  if (type === 'website') navigate(ROUTES.RESTAURANT_SETUP)
                  else if (type === 'digital_business_card') navigate(ROUTES.DIGITAL_BUSINESS_CARD)
                  else navigate(ROUTES.MOBILE_APP)
                }
                return (
                  <button
                    key={type}
                    type="button"
                    className={`di-product-card ${disabled ? 'locked' : ''}`}
                    onClick={go}
                  >
                    <strong>{PRODUCT_TYPE_LABELS[type]}</strong>
                    <span>
                      {disabled
                        ? 'Locked until approval'
                        : formatStatus(product?.status || 'not_started')}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {events.length > 0 ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Status history</h2>
                  <span>Manual validation trail</span>
                </div>
              </div>
              <ol className="di-timeline">
                {events.map((e) => (
                  <li key={e.id}>
                    <strong>{formatStatus(e.newStatus)}</strong>
                    <span>
                      {e.createdAt}
                      {e.changedByName ? ` · ${e.changedByName}` : ''}
                    </span>
                    {e.note ? <p>{e.note}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}
    </DashboardLayout>
  )
}

export default DigitalIdentity
