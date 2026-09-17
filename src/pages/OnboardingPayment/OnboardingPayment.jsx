import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import './OnboardingPayment.css'

const METHODS = [
  { id: 'upi', label: 'UPI', hint: 'GPay · PhonePe · Paytm' },
  { id: 'card', label: 'Card', hint: 'Visa · Mastercard · RuPay' },
  { id: 'netbanking', label: 'Net banking', hint: 'All major banks' },
]

function OnboardingPayment() {
  const navigate = useNavigate()
  const { setRestaurantStatus } = useAuth()
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState('upi')
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .getOnboardingPayment()
      .then((data) => {
        if (cancelled) return
        setInfo(data)
        if (data.status) setRestaurantStatus(data.status)
        if (data.paid) {
          navigate(ROUTES.SETUP_REVIEW, {
            replace: true,
            state: {
              fromPayment: true,
              alreadyPaid: true,
              userId: data.userId,
              professionalEmail: data.professionalEmail,
              payment: data.payment,
            },
          })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load payment details.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate, setRestaurantStatus])

  const pay = async (event) => {
    event.preventDefault()
    if (paying) return
    setPaying(true)
    setError('')
    try {
      const result = await api.completeOnboardingPayment({ method })
      navigate(ROUTES.SETUP_REVIEW, {
        replace: true,
        state: {
          fromPayment: true,
          userId: result.userId,
          professionalEmail: result.professionalEmail,
          ownerEmail: result.ownerEmail,
          restaurantName: result.restaurantName,
          payment: result.payment,
        },
      })
    } catch (err) {
      setError(err.message || 'Payment failed. Try again.')
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <main className="ob-pay-page">
        <p className="ob-pay-loading">Preparing secure checkout…</p>
      </main>
    )
  }

  return (
    <main className="ob-pay-page">
      <div className="ob-pay-shell">
        <header className="ob-pay-brand">
          <img src="/images/Logo9-1 1.svg" alt="IROAS" />
        </header>

        <div className="ob-pay-panel">
          <p className="ob-pay-badge">Payment gateway</p>
          <h1>Complete your launch payment</h1>
          <p className="ob-pay-sub">
            Pay to submit <strong>{info?.restaurantName || 'your store'}</strong> for admin
            review. After payment you receive a welcome email with your User ID and
            professional email.
          </p>

          <div className="ob-pay-summary">
            <div>
              <span>Plan</span>
              <strong>{String(info?.plan || 'starter').toUpperCase()}</strong>
            </div>
            <div>
              <span>User ID</span>
              <strong>{info?.userId || '—'}</strong>
            </div>
            <div>
              <span>Professional email</span>
              <strong>{info?.professionalEmail || '—'}</strong>
            </div>
            <div className="ob-pay-amount">
              <span>Amount due</span>
              <strong>₹{info?.amount ?? 999}</strong>
            </div>
          </div>

          <form className="ob-pay-form" onSubmit={pay}>
            <p className="ob-pay-label">Pay with</p>
            <div className="ob-pay-methods" role="radiogroup" aria-label="Payment method">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={method === m.id}
                  className={`ob-pay-method${method === m.id ? ' is-selected' : ''}`}
                  onClick={() => setMethod(m.id)}
                >
                  <strong>{m.label}</strong>
                  <span>{m.hint}</span>
                </button>
              ))}
            </div>

            {method === 'upi' ? (
              <label className="ob-pay-field">
                UPI ID
                <input required placeholder="name@upi" autoComplete="off" />
              </label>
            ) : null}
            {method === 'card' ? (
              <div className="ob-pay-card-fields">
                <label className="ob-pay-field">
                  Card number
                  <input
                    required
                    name="cardNumber"
                    placeholder="XXXX XXXX XXXX XXXX"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    maxLength={19}
                  />
                </label>
                <div className="ob-pay-card-row">
                  <label className="ob-pay-field">
                    Expiry
                    <input
                      required
                      name="cardExpiry"
                      placeholder="MM/YY"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      maxLength={5}
                    />
                  </label>
                  <label className="ob-pay-field">
                    CVV
                    <input
                      required
                      name="cardCvv"
                      placeholder="•••"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                      type="password"
                    />
                  </label>
                </div>
              </div>
            ) : null}
            {method === 'netbanking' ? (
              <label className="ob-pay-field">
                Bank
                <select required defaultValue="">
                  <option value="" disabled>
                    Select bank
                  </option>
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>SBI</option>
                  <option>Axis Bank</option>
                </select>
              </label>
            ) : null}

            {error ? (
              <p className="ob-pay-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="ob-pay-submit" disabled={paying}>
              {paying ? 'Processing…' : `Pay ₹${info?.amount ?? 999} securely`}
            </button>
            <p className="ob-pay-fine">
              Demo gateway for launch — no real charge. Admin is emailed to verify and approve
              your account.
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}

export default OnboardingPayment
