import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import './OnboardingPayment.css'

const METHODS = [
  {
    id: 'upi',
    label: 'UPI',
    hint: 'GPay · PhonePe · Paytm',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7 4h2l3 9 1.5-4.5h2.2L18 16h-2l-1.2-3.5L13 20H11L8 11 6.8 16H5L7 4zm10.5 0H21v2h-2.2l-1.5 4h2.1v2h-2.8L15 16h-2.2l2.7-12z"
        />
      </svg>
    ),
  },
  {
    id: 'card',
    label: 'Card',
    hint: 'Visa · Mastercard · RuPay',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4H4V6h16v2zm0 4v6H4v-6h16z"
        />
      </svg>
    ),
  },
  {
    id: 'netbanking',
    label: 'Net banking',
    hint: 'All major banks',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3L2 8v2h20V8L12 3zm-7 8v6H3v2h18v-2h-2v-6h-2v6h-4v-6H9v6H5v-6H3z"
        />
      </svg>
    ),
  },
]

function formatMoney(amount) {
  const n = Math.round(Number(amount) || 0)
  return `R${n.toLocaleString('en-ZA')}`
}

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

  const amount = info?.amount ?? 999
  const currency = String(info?.currency || 'ZAR').toUpperCase()
  const plan = String(info?.plan || 'starter')
  const money = formatMoney(amount)

  if (loading) {
    return (
      <main className="ob-pay-page">
        <div className="ob-pay-loading-wrap">
          <div className="ob-pay-spinner" aria-hidden="true" />
          <p>Preparing secure checkout…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="ob-pay-page">
      <div className="ob-pay-bg" aria-hidden="true" />
      <div className="ob-pay-shell">
        <header className="ob-pay-brand">
          <img src="/images/Logo9-1 1.svg" alt="IROAS" />
          <span>Secure launch checkout</span>
        </header>

        <div className="ob-pay-layout">
          <aside className="ob-pay-order">
            <p className="ob-pay-kicker">Order summary</p>
            <h1 className="ob-pay-store">{info?.restaurantName || 'Your store'}</h1>
            <p className="ob-pay-order-sub">
              Submit for admin review. You’ll get a welcome email with your User ID and
              professional address.
            </p>

            <div className="ob-pay-price">
              <span>Amount due</span>
              <strong>
                {money}
                <small>{currency}</small>
              </strong>
            </div>

            <ul className="ob-pay-meta">
              <li>
                <span>Plan</span>
                <strong>{plan.charAt(0).toUpperCase() + plan.slice(1)}</strong>
              </li>
              <li>
                <span>User ID</span>
                <strong>{info?.userId || '—'}</strong>
              </li>
              <li>
                <span>Professional email</span>
                <strong className="ob-pay-email">{info?.professionalEmail || '—'}</strong>
              </li>
            </ul>

            <div className="ob-pay-trust">
              <span>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
                  />
                </svg>
                Encrypted checkout
              </span>
              <span>No real charge in demo</span>
            </div>
          </aside>

          <section className="ob-pay-panel">
            <header className="ob-pay-panel-head">
              <h2>Payment method</h2>
              <p>Choose how you’d like to pay for launch.</p>
            </header>

            <form className="ob-pay-form" onSubmit={pay}>
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
                    <span className="ob-pay-method-ico">{m.icon}</span>
                    <span className="ob-pay-method-copy">
                      <strong>{m.label}</strong>
                      <em>{m.hint}</em>
                    </span>
                    <span className="ob-pay-method-check" aria-hidden="true" />
                  </button>
                ))}
              </div>

              <div className="ob-pay-fields">
                {method === 'upi' ? (
                  <label className="ob-pay-field">
                    <span>UPI ID</span>
                    <input required placeholder="name@upi" autoComplete="off" />
                  </label>
                ) : null}

                {method === 'card' ? (
                  <div className="ob-pay-card-fields">
                    <label className="ob-pay-field">
                      <span>Card number</span>
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
                        <span>Expiry</span>
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
                        <span>CVV</span>
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
                    <span>Select bank</span>
                    <select required defaultValue="">
                      <option value="" disabled>
                        Choose your bank
                      </option>
                      <option>HDFC Bank</option>
                      <option>ICICI Bank</option>
                      <option>SBI</option>
                      <option>Axis Bank</option>
                    </select>
                  </label>
                ) : null}
              </div>

              {error ? (
                <p className="ob-pay-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="ob-pay-submit" disabled={paying}>
                {paying ? (
                  <>
                    <span className="ob-pay-btn-spin" aria-hidden="true" />
                    Processing payment…
                  </>
                ) : (
                  <>Pay {money} securely</>
                )}
              </button>

              <p className="ob-pay-fine">
                Demo gateway for launch — no real charge. After payment, an admin is notified to
                verify and approve your account.
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}

export default OnboardingPayment
