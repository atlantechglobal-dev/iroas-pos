import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/shared/lib/api'
import { useAuth } from '@/shared/hooks/useAuth'
import { ROUTES } from '@/shared/constants/routes'
import { formatPlanPrice } from '@/shared/constants/plans'
import { ownerLiveHomePath } from '@/shared/constants/restaurantStatus'
import { prefetchRoutes } from '@/shared/lib/routePrefetch'
import '@/features/onboarding/OnboardingPayment/OnboardingPayment.css'

const RETURN_POLL_INTERVAL_MS = 2500
const RETURN_POLL_TIMEOUT_MS = 45_000

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '—'
  if (digits.startsWith('27') && digits.length >= 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  if (digits.length > 8) return `+${digits}`
  return digits
}

function OnboardingPayment() {
  const navigate = useNavigate()
  const { setRestaurantStatus, setOnboardingPaid, businessCategory, setBusinessCategory } = useAuth()
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [verifying, setVerifying] = useState(false)
  const pollTimer = useRef(null)
  const pollDeadline = useRef(0)

  const isReturning = new URLSearchParams(window.location.search).get('paid') === 'return'

  const goAfterPayment = (data) => {
    if (data?.status) setRestaurantStatus(data.status)
    else setRestaurantStatus('live')
    setOnboardingPaid(true)
    const category = data?.category || businessCategory || ''
    if (category && setBusinessCategory) setBusinessCategory(category)
    const home = ownerLiveHomePath(category)
    prefetchRoutes([home === ROUTES.DASHBOARD ? 'dashboard' : 'digitalBusinessCard'])
    navigate(home, { replace: true })
  }

  const applyInfo = (data) => {
    setInfo(data)
    if (data.status) setRestaurantStatus(data.status)
    const plans = Array.isArray(data.plans) ? data.plans : []
    const current = String(data.plan || '').toLowerCase()
    const preferred =
      plans.find((p) => p.id === current)?.id ||
      plans.find((p) => p.popular)?.id ||
      plans[0]?.id ||
      ''
    setSelectedPlanId((prev) => prev || preferred)
  }

  const checkStatus = (isPoll = false) => {
    return api
      .getOnboardingPayment()
      .then((data) => {
        applyInfo(data)
        if (data.paid) {
          if (pollTimer.current) clearTimeout(pollTimer.current)
          goAfterPayment(data)
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

  const plans = Array.isArray(info?.plans) ? info.plans : []
  const selected =
    plans.find((p) => p.id === selectedPlanId) || plans.find((p) => p.popular) || plans[0] || null
  const amount = selected ? Number(selected.priceZar) || 0 : Number(info?.amount) || 0
  const money = formatPlanPrice(amount)
  const pendingPayment = Boolean(info?.payment?.pending)

  const pay = async (event) => {
    event.preventDefault()
    if (paying) return
    if (!selected?.id) {
      setError('Select a launch plan to continue.')
      return
    }
    setPaying(true)
    setError('')
    try {
      const result = await api.completeOnboardingPayment({ planId: selected.id })
      if (result.alreadyPaid || result.payment?.paid || result.demo) {
        goAfterPayment({
          ...result,
          status: result.status || 'live',
          category: result.category || info?.category || businessCategory,
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
            <p className="ob-pay-sub">
              Please wait while we check with AddPay. This page also re-queries the gateway if the
              bank webhook is delayed.
            </p>
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
      <div className="ob-pay-shell ob-pay-shell-wide">
        <header className="ob-pay-brand">
          <img src="/images/Logo9-1 1.svg" alt="IROAS" />
          <span>Choose your launch plan</span>
        </header>

        <section className="ob-pay-account">
          <p className="ob-pay-kicker-light">Your account</p>
          <h1>{info?.restaurantName || 'Your business'}</h1>
          <p className="ob-pay-account-sub">
            Same details from Create account — confirm, pick a plan, then pay to submit for review.
          </p>
          <dl className="ob-pay-account-grid">
            <div>
              <dt>Name</dt>
              <dd>{info?.ownerName || '—'}</dd>
            </div>
            <div>
              <dt>Work email</dt>
              <dd>{info?.ownerEmail || '—'}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{formatPhone(info?.ownerPhone)}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{info?.city || '—'}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{info?.category || '—'}</dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd>{info?.userId || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="ob-pay-plans-block">
          <div className="ob-pay-plans-head">
            <h2>Subscription plans</h2>
            <p>Same packages from Platform Admin → Plans. Amounts are one-time launch fees in ZAR.</p>
          </div>

          {!plans.length ? (
            <p className="ob-pay-error" role="alert">
              No plans are available yet. Ask an admin to add plans under Platform Admin → Plans.
            </p>
          ) : (
            <div className="ob-pay-plans-grid">
              {plans.map((plan) => {
                const active = selected?.id === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    className={`ob-pay-plan-card${active ? ' is-selected' : ''}${
                      plan.popular ? ' is-popular' : ''
                    }`}
                    onClick={() => setSelectedPlanId(plan.id)}
                    aria-pressed={active}
                  >
                    {plan.popular ? <span className="ob-pay-plan-badge">Popular</span> : null}
                    <p className="ob-pay-plan-id">{plan.id}</p>
                    <h3>{plan.name}</h3>
                    <p className="ob-pay-plan-tag">{plan.tagline || '—'}</p>
                    <div className="ob-pay-plan-price">
                      <strong>{formatPlanPrice(plan.priceZar)}</strong>
                      <span>{plan.billing || 'one-time launch'} · ZAR</span>
                    </div>
                    <ul>
                      {(plan.features || []).length ? (
                        (plan.features || []).map((feature) => <li key={feature}>{feature}</li>)
                      ) : (
                        <li className="is-muted">No features listed</li>
                      )}
                    </ul>
                    <span className="ob-pay-plan-select">
                      {active ? 'Selected' : 'Select plan'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="ob-pay-panel ob-pay-checkout">
          <div className="ob-pay-panel-head">
            <h2>Pay to submit for review</h2>
            <p>
              {info?.addpayConfigured
                ? 'You’ll be taken to AddPay’s secure page to complete payment by card, UPI, or EFT.'
                : 'AddPay is not configured yet — continue will mark a demo payment so onboarding can proceed.'}
            </p>
          </div>

          <div className="ob-pay-checkout-summary">
            <span>Selected plan</span>
            <strong>
              {selected?.name || '—'} · {money}
            </strong>
          </div>

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

          <form className="ob-pay-form" onSubmit={pay}>
            <button
              type="submit"
              className="ob-pay-submit"
              disabled={paying || !selected}
            >
              {paying
                ? info?.addpayConfigured
                  ? 'Redirecting to checkout…'
                  : 'Completing demo payment…'
                : info?.addpayConfigured
                  ? `Pay ${money} securely`
                  : `Continue with ${money} (demo)`}
            </button>
            <p className="ob-pay-fine">
              After payment your QRs unlock and you can open your workspace.
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}

export default OnboardingPayment
