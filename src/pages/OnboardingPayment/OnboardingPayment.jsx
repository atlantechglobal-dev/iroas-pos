import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import './OnboardingPayment.css'

const RETURN_POLL_INTERVAL_MS = 2500
const RETURN_POLL_TIMEOUT_MS = 30_000

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
      if (result.alreadyPaid || result.payment?.paid || result.demo) {
        goToReview({
          userId: result.userId,
          professionalEmail: result.professionalEmail,
          payment: result.payment,
        })
        return
      }
      if (!result.payUrl) {
        throw new Error(
          'Payment could not be started — no checkout URL returned. Configure AddPay in Platform Admin → Payment settings.',
        )
      }
      window.location.href = result.payUrl
    } catch (err) {
      setError(err.message || 'Payment could not be started. Try again.')
      setPaying(false)
    }
  }

  const amount = info?.amount ?? 999
  const currency = String(info?.currency || 'ZAR').toUpperCase()
  const money = formatMoney(amount)
  const pendingPayment = Boolean(info?.payment?.pending)

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

  if (verifying) {
    return (
      <main className="ob-pay-page">
        <div className="ob-pay-shell">
          <div className="ob-pay-panel ob-pay-verify">
            <div className="ob-pay-spinner" aria-hidden="true" />
            <h1>Confirming your payment…</h1>
            <p className="ob-pay-sub">Please wait while we check with the bank.</p>
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

        <div className="ob-pay-panel">
          <p className="ob-pay-badge">Payment gateway</p>
          <h1>Complete your launch payment</h1>
          <p className="ob-pay-sub">
            Pay to submit <strong>{info?.restaurantName || 'your store'}</strong> for admin
            review. You’ll be taken to AddPay’s secure page. After payment you receive a welcome
            email with your User ID and professional email.
          </p>

          <div className="ob-pay-price">
            <span>Amount due</span>
            <strong>
              {money} <em>{currency}</em>
            </strong>
          </div>

          {!info?.addpayConfigured ? (
            <p className="ob-pay-note">
              AddPay is not configured — this will complete as a demo payment (no real charge).
              Admins can add credentials under Platform Admin → Payment settings.
            </p>
          ) : null}

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
              {paying ? 'Redirecting to checkout…' : `Pay ${money} securely`}
            </button>
            <p className="ob-pay-fine">
              Card and bank details are entered on AddPay’s page — never on IROAS. After payment,
              an admin is emailed to verify and approve your account.
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}

export default OnboardingPayment
