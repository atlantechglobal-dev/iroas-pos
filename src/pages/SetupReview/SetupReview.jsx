import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { QrCodePreview, downloadQrPng } from '../../components/QrCodePreview.jsx'
import { restaurantHostname } from '../../utils/restaurantUrl.js'
import { guestSiteUrl, restaurantPublicSlug } from '../../utils/guestLinks.js'
import { useAuth } from '../../hooks/useAuth.js'
import { RESTAURANT_STATUS } from '../../constants/restaurantStatus.js'
import {
  businessCategoryFromRestaurant,
  getBusinessCopy,
} from '../../constants/businessCopy.js'
import './SetupReview.css'

const CHECKLIST = [
  'Profile completed',
  'Domain connected',
  'Branding applied',
  'QR generated',
]

const SIGN_IN_DELAY_MS = 6000

function SetupReview() {
  const { logout, setRestaurantStatus } = useAuth()
  const [restaurantName, setRestaurantName] = useState('')
  const [liveLink, setLiveLink] = useState('')
  const [hostname, setHostname] = useState('')
  const [category, setCategory] = useState('')
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
    }, SIGN_IN_DELAY_MS)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(timer)
    }
  }, [logout])

  const copy = getBusinessCopy(category)
  const displayName = restaurantName.trim() || copy.fallbackName

  const handlePreview = () => {
    if (liveLink) window.open(liveLink, '_blank')
  }

  const handleDownloadQR = async () => {
    if (!liveLink) return
    const slug = (hostname || displayName).split('.')[0] || 'business'
    await downloadQrPng(liveLink, `${slug}-QR.png`)
  }

  return (
    <main className="setup-review-page">
      <div className="setup-review-shell">
        <header className="setup-review-brand">
          <img src="/images/Logo9-1 1.svg" alt="IROAS" />
        </header>

        <div className="setup-review-panel">
          <p className="setup-review-badge">Awaiting approval</p>
          <h1 className="setup-review-title">{displayName} is in review</h1>
          <p className="setup-review-subtitle">
            Your digital identity is submitted. An admin will review it, then
            your site publishes automatically.
          </p>

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
            <button
              className="setup-review-ghost"
              type="button"
              onClick={handleDownloadQR}
              disabled={!liveLink}
            >
              Download QR
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default SetupReview
