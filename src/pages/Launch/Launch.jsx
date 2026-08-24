import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import './Launch.css'

const LIVE_LINK = 'https://trident--kitchen.iroas.com'

function Launch() {
  const navigate = useNavigate()

  const [toast, setToast] = useState('')
  const [launched, setLaunched] = useState(false)

  const showMessage = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 2200)
  }

  const copyRestaurantLink = () => {
    navigator.clipboard
      .writeText(LIVE_LINK)
      .then(() => showMessage('Link copied!'))
      .catch(() => showMessage('Unable to copy link'))
  }

  const handleOpenLink = () => {
    window.open(LIVE_LINK, '_blank')
  }

  const handleDownloadQR = () => {
    const link = document.createElement('a')
    link.href = '/images/trident qr.svg'
    link.download = 'trident-restaurant-QR.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrintQR = () => {
    window.print()
  }

  const handleShareQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Trident Restaurant',
          text: 'Visit our restaurant',
          url: LIVE_LINK,
        })
      } catch {
        // share cancelled
      }
    } else {
      copyRestaurantLink()
      showMessage('Link copied — sharing is not supported here.')
    }
  }

  const handleLaunch = async () => {
    try {
      await api.launch()
      setLaunched(true)
      showMessage('Your restaurant has been launched!')

      setTimeout(() => {
        navigate('/go-live')
      }, 1200)
    } catch (err) {
      showMessage(err.message)
    }
  }

  return (
    <div className="launch-page">
      {/* TOP HEADER */}
      <header className="top-header">
        <div className="brand-logo">
          <img src="/images/Logo9-1 1.svg" alt="IROAS" />
        </div>

        <div className="time-info">◷ &nbsp;About 2–3 minutes</div>

        <div className="header-right">
          <span className="autosave">
            <span className="green-dot"></span>
            Auto-saved
          </span>

          <button className="save-btn">Save & continue later</button>
        </div>
      </header>

      {/* PROGRESS STEPS */}
      <nav className="steps">
        <div className="step completed">
          <div className="step-icon">✓</div>
          <div>
            <strong>Profile</strong>
            <small>Tell us about your place</small>
          </div>
        </div>

        <div className="step completed">
          <div className="step-icon">✓</div>
          <div>
            <strong>Domain</strong>
            <small>Pick your web address</small>
          </div>
        </div>

        <div className="step completed">
          <div className="step-icon">✓</div>
          <div>
            <strong>Brand</strong>
            <small>Logo, colors & theme</small>
          </div>
        </div>

        <div className="step active">
          <div className="step-icon">
            <img src="/images/qr.png" alt="Launch" />
          </div>
          <div>
            <strong>Launch</strong>
            <small>QR & digital card</small>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-container">
        {/* LEFT CARD */}
        <section className="launch-card">
          <div className="card-heading">
            <div className="step-label">✣ STEP 4 OF 4</div>

            <h1>Your digital restaurant is ready</h1>

            <p>
              Print your QR code, share your link, and welcome your first
              guests.
            </p>
          </div>

          {/* LIVE LINK */}
          <div className="link-section">
            <div className="link-icon">
              <img src="/images/website icon.svg" alt="" />
            </div>

            <div className="link-content">
              <span>YOUR LIVE LINK</span>
              <strong>{LIVE_LINK}</strong>
            </div>

            <button className="link-action" onClick={copyRestaurantLink}>
              <img src="/images/copy.svg" alt="" />
            </button>

            <button className="link-action" onClick={handleOpenLink}>
              <img src="/images/arrow.svg" alt="" />
            </button>
          </div>

          {/* ACTION BUTTONS */}
          <div className="action-buttons">
            <button className="action-card" onClick={handleDownloadQR}>
              <span className="action-icon">⇩</span>
              <span>Download QR</span>
            </button>

            <button className="action-card" onClick={handlePrintQR}>
              <span className="action-icon">▣</span>
              <span>Print QR</span>
            </button>

            <button className="action-card" onClick={handleShareQR}>
              <span className="action-icon">♧</span>
              <span>Share QR</span>
            </button>

            <button className="action-card" onClick={copyRestaurantLink}>
              <span className="action-icon">□</span>
              <span>Copy link</span>
            </button>
          </div>

          {/* REAL LIFE PREVIEW */}
          <div className="preview-title">HOW IT LOOKS IN REAL LIFE</div>

          <div className="real-life-grid">
            <div className="real-card">
              <div className="real-image">
                <img src="/images/trident qr.svg" alt="Restaurant Code" />
                <span>trident</span>
              </div>

              <div className="real-label">Table tent</div>
            </div>

            <div className="real-card">
              <div className="real-image">
                <img src="/images/trident qr.svg" alt="Restaurant Code" />
                <span>trident</span>
              </div>

              <div className="real-label">Sticker</div>
            </div>

            <div className="real-card">
              <div className="real-image">
                <img src="/images/trident qr.svg" alt="Restaurant Code" />
                <span>trident</span>
              </div>

              <div className="real-label">Business card</div>
            </div>

            <div className="real-card">
              <div className="real-image poster">
                <img src="/images/trident qr.svg" alt="Restaurant QR code" />
                <span>trident</span>
              </div>

              <div className="real-label">Poster</div>
            </div>
          </div>
        </section>

        {/* PHONE PREVIEW */}
        <section className="phone-area">
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-top">
                <span>9:41</span>
                <div className="dynamic-island"></div>
                <span>▯</span>
              </div>

              <div className="restaurant-logo">T</div>

              <h2>trident</h2>

              <p className="restaurant-location">Indian · Mumbai</p>

              <div className="phone-qr">
                <img src="/images/trident qr.svg" alt="Restaurant QR" />
              </div>

              <div className="qr-bottom-content">
                <div className="qr-link">trident-kitchen.iroas.com</div>

                <div className="qr-actions">
                  <button
                    className="qr-action"
                    title="Download"
                    onClick={handleDownloadQR}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M12 3v12"></path>
                      <path d="M7 10l5 5 5-5"></path>
                      <path d="M5 21h14"></path>
                    </svg>
                  </button>

                  <button
                    className="qr-action"
                    title="Share"
                    onClick={handleShareQR}
                  >
                    <svg viewBox="0 0 24 24">
                      <circle cx="18" cy="5" r="2"></circle>
                      <circle cx="6" cy="12" r="2"></circle>
                      <circle cx="18" cy="19" r="2"></circle>
                      <path d="M8 11l8-5"></path>
                      <path d="M8 13l8 5"></path>
                    </svg>
                  </button>

                  <button
                    className="qr-action"
                    title="Copy"
                    onClick={copyRestaurantLink}
                  >
                    <svg viewBox="0 0 24 24">
                      <rect x="9" y="9" width="11" height="11" rx="2"></rect>
                      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* BOTTOM BAR */}
      <footer className="bottom-bar">
        <button className="back-btn" onClick={() => navigate('/brand')}>
          ← &nbsp;Back
        </button>

        <div className="step-counter">Step 4 of 4 · Launch</div>

        <button
          className="launch-btn"
          style={launched ? { background: '#45bd6c', color: 'white' } : undefined}
          onClick={handleLaunch}
        >
          {launched ? '✓ Restaurant launched!' : '✣  Launch my restaurant'}
        </button>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default Launch
