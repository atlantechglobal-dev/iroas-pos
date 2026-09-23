import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/shared/lib/api'
import { QrCodePreview } from '@/shared/ui/QrCodePreview'
import { restaurantHostname } from '@/shared/utils/restaurantUrl'
import { guestSiteUrl, restaurantPublicSlug } from '@/shared/utils/guestLinks'
import { useAuth } from '@/shared/hooks/useAuth'
import { RESTAURANT_STATUS } from '@/shared/constants/restaurantStatus'
import { ROUTES } from '@/shared/constants/routes'
import {
  businessCategoryFromRestaurant,
  getBusinessCopy,
} from '@/shared/constants/businessCopy'
import '@/features/onboarding/SetupReview/SetupReview.css'

const CHECKLIST = [
  'Profile completed',
  'Domain connected',
  'Branding applied',
  'QR generated',
  'Payment received',
]

const SIGN_IN_DELAY_MS = 5000

function SetupReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const paymentState = location.state || {}
  const { logout, setRestaurantStatus } = useAuth()
  const [restaurantName, setRestaurantName] = useState(
    paymentState.restaurantName || '',
  )
  const [liveLink, setLiveLink] = useState('')
  const [hostname, setHostname] = useState('')
  const [category, setCategory] = useState('')
  const [userId, setUserId] = useState(paymentState.userId || '')
  const [professionalEmail, setProfessionalEmail] = useState(
    paymentState.professionalEmail || '',
  )
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(SIGN_IN_DELAY_MS / 1000))

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        const host = restaurantHostname(restaurant)
        const slug = restaurantPublicSlug(restaurant, 'your-restaurant')
        if (host) setHostname(host)
        setLiveLink(guestSiteUrl(slug, 'website'))
        setCategory(businessCategoryFromRestaurant(restaurant))
        if (restaurant.status === RESTAURANT_STATUS.PENDING_APPROVAL) {
          setRestaurantStatus(RESTAURANT_STATUS.PENDING_APPROVAL)
        }
      })
      .catch(() => {})

    api
      .getOnboardingPayment()
      .then((data) => {
        if (data.userId) setUserId(data.userId)
        if (data.professionalEmail) setProfessionalEmail(data.professionalEmail)
      })
      .catch(() => {})
  }, [setRestaurantStatus])

  useEffect(() => {
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((SIGN_IN_DELAY_MS - (Date.now() - startedAt)) / 1000),
      )
      setSecondsLeft(remaining)
    }, 200)
    const timer = window.setTimeout(() => {
      logout()
      navigate(ROUTES.LOGIN, { replace: true })
    }, SIGN_IN_DELAY_MS)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(timer)
    }
  }, [logout, navigate])

  const copy = getBusinessCopy(category)
  const displayName = restaurantName.trim() || copy.fallbackName
  const fromPayment = Boolean(paymentState.fromPayment || paymentState.alreadyPaid)

  const handlePreview = () => {
    if (liveLink) window.open(liveLink, '_blank')
  }

  const goSignIn = () => {
    logout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <main className="setup-review-page">
      <div className="setup-review-shell">
        <header className="setup-review-brand">
          <img src="/images/Logo9-1 1.svg" alt="IROAS" />
        </header>

        <div className="setup-review-panel">
          <p className="setup-review-badge">
            {fromPayment ? 'Payment successful · Awaiting approval' : 'Awaiting approval'}
          </p>
          <h1 className="setup-review-title">{displayName} is in review</h1>
          <p className="setup-review-subtitle">
            {fromPayment
              ? 'Thanks for your payment. Your store is submitted for admin review. A welcome email with your User ID is on the way.'
              : 'Your digital identity is submitted. An admin will review it, then your site publishes automatically.'}
          </p>

          {userId || professionalEmail ? (
            <div className="setup-review-creds">
              {userId ? (
                <div>
                  <span>User ID</span>
                  <strong>{userId}</strong>
                </div>
              ) : null}
              {professionalEmail ? (
                <div>
                  <span>Professional email</span>
                  <strong>{professionalEmail}</strong>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className="setup-review-timer"
            role="status"
            aria-live="polite"
          >
            <div className="setup-review-timer-track">
              <div
                className="setup-review-timer-fill"
                style={{ animationDuration: `${SIGN_IN_DELAY_MS}ms` }}
              />
            </div>
            <p className="setup-review-timer-copy">
              Taking you to sign in in <strong>{secondsLeft}s</strong>
            </p>
          </div>

          <section className="setup-review-card" aria-label="Setup checklist">
            <ul className="setup-review-list">
              {CHECKLIST.map((item) => (
                <li key={item}>
                  <span className="setup-review-check" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 13L10 18L19 7"
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="setup-review-item">{item}</span>
                  <span className="setup-review-done">Done</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="setup-review-qr" aria-label="QR code preview">
            <QrCodePreview
              value={liveLink}
              size={168}
              alt={`${displayName} QR code`}
              emptyMessage="Set your web address to preview the QR code."
              blurred
              blurMessage="Make a payment first"
            />
            {hostname ? <p className="setup-review-host">{hostname}</p> : null}
          </section>

          <div className="setup-review-actions">
            <button
              className="setup-review-ghost"
              type="button"
              onClick={handlePreview}
              disabled={!liveLink}
            >
              Preview website
            </button>
            <button className="setup-review-ghost" type="button" onClick={goSignIn}>
              Go to sign in
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default SetupReview
