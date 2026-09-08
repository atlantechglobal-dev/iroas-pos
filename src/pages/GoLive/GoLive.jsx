import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { QrCodePreview, downloadQrPng } from '../../components/QrCodePreview.jsx'
import { restaurantHostname } from '../../utils/restaurantUrl.js'
import { guestSiteUrl, restaurantPublicSlug } from '../../utils/guestLinks.js'
import './GoLive.css'

const CHECKLIST = [
  'Profile completed',
  'Domain connected',
  'Branding applied',
  'QR generated',
]

function GoLive() {
  const navigate = useNavigate()
  const [restaurantName, setRestaurantName] = useState('')
  const [liveLink, setLiveLink] = useState('')
  const [hostname, setHostname] = useState('')

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        const host = restaurantHostname(restaurant)
        const slug = restaurantPublicSlug(restaurant, 'your-restaurant')
        if (host) setHostname(host)
        setLiveLink(guestSiteUrl(slug, 'website'))
      })
      .catch(() => {})
  }, [])

  const displayName = restaurantName.trim() || 'Your restaurant'

  const handleDashboard = () => {
    navigate('/dashboard')
  }

  const handlePreview = () => {
    if (liveLink) {
      window.open(liveLink, '_blank')
    }
  }

  const handleDownloadQR = async () => {
    if (!liveLink) return
    const slug = (hostname || displayName).split('.')[0] || 'restaurant'
    await downloadQrPng(liveLink, `${slug}-QR.png`)
  }

  return (
    <main className="go-live-page">
      <div className="go-live-content">
        <div className="icon-badge" aria-hidden="true">
          <img src="/images/cracker.svg" alt="Success icon" />
        </div>

        <h1 className="title">{displayName} is now live!</h1>

        <p className="subtitle">
          Your digital identity is set up and ready to greet guests. Welcome to
          <br />
          IROAS.
        </p>

        <section className="checklist-card" aria-label="Setup checklist">
          <ul className="checklist">
            {CHECKLIST.map((item) => (
              <li className="checklist-item" key={item}>
                <span className="check-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13L10 18L19 7"
                      stroke="#ffffff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="item-label">{item}</span>
                <span className="item-status">DONE</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="go-live-qr" aria-label="QR code preview">
          <QrCodePreview
            value={liveLink}
            size={200}
            alt={`${displayName} QR code`}
            emptyMessage="Set your web address to preview the QR code."
          />
          {hostname ? <p className="go-live-qr-host">{hostname}</p> : null}
        </section>

        <div className="actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleDashboard}
          >
            Go to dashboard
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12H19M19 12L13 6M19 12L13 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={handlePreview}
            disabled={!liveLink}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 3H21V10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 3L10 14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 14V19C19 20.1046 18.1046 21 17 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5H10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Preview website
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleDownloadQR}
            disabled={!liveLink}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3V15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 10L12 15L17 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 19H19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download QR kit
          </button>
        </div>
      </div>
    </main>
  )
}

export default GoLive
