import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import './OnboardingPayment.css'

const RETURN_POLL_INTERVAL_MS = 2500
const RETURN_POLL_TIMEOUT_MS = 30_000

function OnboardingPayment() {
  const navigate = useNavigate()
  const { setRestaurantStatus } = useAuth()
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const pollTimer = useRef(null)
  const pollDeadline = useRef(0)

  const isReturning = new URLSearchParams(window.location.search).get('paid') === 'return'

  const goToReview = (data) => {
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

  const checkStatus = (isPoll = false) => {
    return api
      .getOnboardingPayment()
      .then((data) => {
        setInfo(data)
        if (data.status) setRestaurantStatus(data.status)
        if (data.paid) {
          if (pollTimer.current) clearTimeout(pollTimer.current)
          goToReview(data)
          return true
        }
        if (isPoll && Date.now() < pollDeadline.current) {
          pollTimer.current = setTimeout(() => checkStatus(true), RETURN_POLL_INTERVAL_MS)
        } else if (isPoll) {
          setVerifying(false)
          setError(
            'Still confirming your payment with the bank. This can take a minute — refresh this page shortly, or contact support with your reference if it persists.',
          )
        }
        return false
      })
      .catch((err) => {
        if (!isPoll) setError(err.message || 'Unable to load payment details.')
      })
  }

  useEffect(() => {
    setLoading(true)
    checkStatus().finally(() => setLoading(false))

    if (isReturning) {
      setVerifying(true)
      pollDeadline.current = Date.now() + RETURN_POLL_TIMEOUT_MS
      pollTimer.current = setTimeout(() => checkStatus(true), RETURN_POLL_INTERVAL_MS)
    }

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pay = async (event) => {
    event.preventDefault()
    if (paying) return
    setPaying(true)
    setError('')
    try {
      const result = await api.completeOnboardingPayment({})
      if (result.alreadyPaid) {
        goToReview(result)
        return
      }
      if (!result.payUrl) {
        throw new Error('Payment could not be started. Try again.')
      }
      // Full navigation to AddPay's own hosted checkout — we never see or
      // handle card/UPI details ourselves.
      window.location.href = result.payUrl
    } catch (err) {
      setError(err.message || 'Payment could not be started. Try again.')
      setPaying(false)
    }
  }

  const amount = info?.amount ?? 999
  const currency = String(info?.currency || 'ZAR').toUpperCase()
  const plan = String(info?.plan || 'starter')
  const money = formatMoney(amount)
  const pendingPayment = Boolean(info?.payment?.pending)

  if (loading) {
    return (
      <main className="ob-pay-page">
        <p className="ob-pay-loading">Preparing secure checkout…</p>
      </main>
    )
  }

  if (verifying) {
    return (
      <main className="ob-pay-page">
        <div className="ob-pay-loading-wrap">
          <div className="ob-pay-spinner" aria-hidden="true" />
          <p>Confirming your payment…</p>
          {error ? (
            <>
              <p className="ob-pay-error" role="alert">
                {error}
              </p>
              <button type="button" className="ob-pay-submit" onClick={() => checkStatus()}>
                Check again
              </button>
            </>
          ) : null}
        </div>
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
                </svg>
                Encrypted checkout
              </span>
              <span>Processed securely by AddPay</span>
            </div>
          </aside>

          <section className="ob-pay-panel">
            <header className="ob-pay-panel-head">
              <h2>Pay to submit for review</h2>
              <p>
                You’ll be taken to AddPay’s secure page to complete payment by card, UPI, or
                EFT.
              </p>
            </header>

            <form className="ob-pay-form" onSubmit={pay}>
              {pendingPayment ? (
                <p className="ob-pay-note">
                  A previous attempt didn’t complete — you can try again below.
                </p>
              ) : null}

              {error ? (
                <p className="ob-pay-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="ob-pay-submit" disabled={paying}>
                {paying ? (
                  <>
                    <span className="ob-pay-btn-spin" aria-hidden="true" />
                    Redirecting to checkout…
                  </>
                ) : (
                  <>Pay {money} securely</>
                )}
              </button>

              <p className="ob-pay-fine">
                After payment, an admin is notified to verify and approve your account.
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
