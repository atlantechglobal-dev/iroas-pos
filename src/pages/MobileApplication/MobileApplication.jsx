import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import { formatStatus, isIdentityUnlocked } from '../../constants/digitalIdentity.js'
import '../DigitalIdentity/DigitalIdentity.css'

function MobileApplication() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [prefill, setPrefill] = useState({})
  const [product, setProduct] = useState(null)
  const [events, setEvents] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [extras, setExtras] = useState({
    platforms: 'iOS & Android',
    features: '',
    pushNotifications: true,
    notes: '',
  })

  useEffect(() => {
    Promise.all([api.getIdentity(), api.getProduct('mobile_app')])
      .then(([identityData, productData]) => {
        setUnlocked(isIdentityUnlocked(identityData.identity?.status))
        setPrefill(productData.prefill || {})
        setProduct(productData.product)
        setEvents(productData.events || [])
        if (productData.product?.payload?.extras) {
          setExtras((prev) => ({ ...prev, ...productData.product.payload.extras }))
        }
      })
      .catch((err) => toast.error(err.message || 'Unable to load mobile application request.'))
      .finally(() => setLoading(false))
  }, [])

  const setExtra = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setExtras((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const data = await api.requestProduct('mobile_app', { extras })
      setProduct(data.product)
      setEvents(data.events || [])
      toast.success('Mobile application request submitted for review.')
    } catch (err) {
      toast.error(err.message || 'Unable to submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout pageClassName="mobile-app-page" activeNav="mobile-app">
      <div className="page-head">
        <div>
          <p className="eyebrow">PRODUCTS</p>
          <h1>Mobile Application</h1>
          <p className="page-desc">
            Reuses your approved Digital Identity. Add app-specific requirements, then our team
            reviews and progresses development.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => navigate(ROUTES.DIGITAL_IDENTITY)}>
          Back to Digital Identity
        </button>
      </div>

      {loading ? (
        <p className="di-muted">Loading…</p>
      ) : !unlocked ? (
        <div className="card">
          <p className="di-lock-note">
            Your Digital Identity must be approved before you can request a Mobile Application.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(ROUTES.DIGITAL_IDENTITY)}>
            Go to Digital Identity
          </button>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>From Digital Identity</h2>
                <span>Auto-populated — no need to re-enter</span>
              </div>
              <span className="di-badge ok">{formatStatus(product?.status || 'not_started')}</span>
            </div>
            <div className="di-grid">
              <label>
                Business name
                <input value={prefill.businessName || ''} readOnly />
              </label>
              <label>
                Contact person
                <input value={prefill.contactPerson || ''} readOnly />
              </label>
              <label>
                Phone
                <input value={prefill.phone || ''} readOnly />
              </label>
              <label>
                Email
                <input value={prefill.email || ''} readOnly />
              </label>
            </div>
          </section>

          <section className="card">
            <h2>Mobile app requirements</h2>
            <div className="di-grid">
              <label>
                Platforms
                <input value={extras.platforms} onChange={setExtra('platforms')} />
              </label>
              <label>
                Key features
                <input
                  value={extras.features}
                  onChange={setExtra('features')}
                  placeholder="Ordering, bookings, loyalty…"
                />
              </label>
              <label className="full">
                Additional notes
                <textarea rows={3} value={extras.notes} onChange={setExtra('notes')} />
              </label>
            </div>
            <div className="di-check-row">
              <label>
                <input
                  type="checkbox"
                  checked={!!extras.pushNotifications}
                  onChange={setExtra('pushNotifications')}
                />
                Include push notifications
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || (product && !['not_started', 'rejected'].includes(product.status))}
            >
              {submitting
                ? 'Submitting…'
                : product && !['not_started', 'rejected'].includes(product.status)
                  ? 'Request already submitted'
                  : 'Submit mobile app request'}
            </button>
          </section>

          {events.length > 0 ? (
            <section className="card">
              <h2>Request history</h2>
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

export default MobileApplication
