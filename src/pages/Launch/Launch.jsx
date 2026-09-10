import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { QrCodePreview, downloadQrPng, qrDataUrl } from '../../components/QrCodePreview.jsx'
import { restaurantHostname } from '../../utils/restaurantUrl.js'
import { cardPublicUrl, guestSiteUrl, restaurantPublicSlug } from '../../utils/guestLinks.js'
import { ROUTES } from '../../constants/routes.js'
import OnboardingProgress from '../../components/onboarding/OnboardingProgress.jsx'
import {
  businessCategoryFromRestaurant,
  getBusinessCopy,
  locationPreviewLine,
} from '../../constants/businessCopy.js'
import './Launch.css'

function Launch() {
  const navigate = useNavigate()
  const [continuing, setContinuing] = useState(false)

  const [toast, setToast] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [domain, setDomain] = useState('')
  const [slug, setSlug] = useState('your-restaurant')
  const [primaryColor, setPrimaryColor] = useState('#F97316')
  const [secondaryColor, setSecondaryColor] = useState('#F0F72A')
  const [accentColor, setAccentColor] = useState('#BDB8A4')
  const [category, setCategory] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const qrCache = useRef('')

  const copy = getBusinessCopy(category)

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        if (restaurant.cuisine) setCuisine(restaurant.cuisine)
        if (restaurant.city) setCity(restaurant.city)
        if (restaurant.address) setAddress(restaurant.address)
        if (restaurant.primary_color) setPrimaryColor(restaurant.primary_color)
        if (restaurant.secondary_color) setSecondaryColor(restaurant.secondary_color)
        if (restaurant.accent_color) setAccentColor(restaurant.accent_color)
        setCategory(businessCategoryFromRestaurant(restaurant))
        if (restaurant.status) setRestaurantStatus(restaurant.status)

        const host = restaurantHostname(restaurant)
        if (host) setDomain(host)
        setSlug(restaurantPublicSlug(restaurant, 'your-restaurant'))
      })
      .catch(() => {})
  }, [])

  const displayName = restaurantName.trim() || copy.fallbackName
  const previewInitial = restaurantName.trim()
    ? restaurantName.trim().charAt(0).toUpperCase()
    : 'R'

  const hasDomain = Boolean(domain)
  const hostname = domain || 'yourbusiness.iroas.com'
  const marketingLink = hasDomain ? `https://${hostname}` : ''
  const LIVE_LINK = guestSiteUrl(slug, 'website') || marketingLink
  const businessCardLink = cardPublicUrl(slug)
  const mapQuery = address.trim() || city.trim()
  const locationLink = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : ''
  const mapEmbedLink = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
    : ''

  useEffect(() => {
    if (!LIVE_LINK) {
      qrCache.current = ''
      return
    }
    qrDataUrl(LIVE_LINK, { width: 300 }).then((url) => {
      qrCache.current = url
    })
  }, [LIVE_LINK])

  const showMessage = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 2200)
  }

  const copyRestaurantLink = () => {
    if (!LIVE_LINK) {
      showMessage('Set your web address first')
      return
    }
    navigator.clipboard
      .writeText(LIVE_LINK)
      .then(() => showMessage('Link copied!'))
      .catch(() => showMessage('Unable to copy link'))
  }

  const handleOpenLink = () => {
    if (!LIVE_LINK) {
      showMessage('Set your web address first')
      return
    }
    window.open(LIVE_LINK, '_blank')
  }

  const handleDownloadQR = async (qrUrl = LIVE_LINK, fileName = `${hostname.split('.')[0]}-QR.png`) => {
    if (!qrUrl) {
      showMessage('Add the required details first')
      return
    }
    try {
      await downloadQrPng(qrUrl, fileName)
    } catch {
      showMessage('Unable to download QR')
    }
  }

  const escapeHtml = (value) =>
    value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char])

  const handlePrintQR = async (qrUrl = LIVE_LINK, label = displayName, linkLabel = hostname) => {
    if (!qrUrl) {
      showMessage('Add the required details first')
      return
    }

    const qrSrc = await qrDataUrl(qrUrl, { width: 300 })
    const printWindow = window.open('', '_blank', 'width=420,height=640')

    if (!printWindow) {
      window.print()
      return
    }

    const safeName = escapeHtml(label)
    const safeHost = escapeHtml(linkLabel)

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safeName} — QR Code</title>
          <style>
            body {
              font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont,
                "Segoe UI", Arial, sans-serif;
              text-align: center;
              padding: 56px 24px;
              color: #17171a;
            }
            img { width: 260px; height: 260px; }
            h1 { font-size: 22px; font-weight: 800; margin: 24px 0 4px; }
            p { color: #8b8b8f; font-size: 14px; margin: 0; }
          </style>
        </head>
        <body>
          <img src="${qrSrc}" alt="${safeName} QR code" />
          <h1>${safeName}</h1>
          <p>${safeHost}</p>
        </body>
      </html>
    `)
    printWindow.document.close()

    const triggerPrint = () => {
      printWindow.focus()
      printWindow.print()
    }

    const img = printWindow.document.querySelector('img')
    if (img && !img.complete) {
      img.onload = triggerPrint
      img.onerror = triggerPrint
    } else {
      triggerPrint()
    }

    printWindow.onafterprint = () => printWindow.close()
  }

  const handleShareQR = async (qrUrl = LIVE_LINK, label = displayName) => {
    if (!qrUrl) {
      showMessage('Add the required details first')
      return
    }

    const canNativeShare = typeof navigator.share === 'function'

    try {
      if (canNativeShare && navigator.canShare) {
        const dataUrl = await qrDataUrl(qrUrl, { width: 300 })
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const file = new File([blob], `${label.replace(/\s+/g, '-').toLowerCase()}-QR.png`, {
          type: 'image/png',
        })

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: label,
            text: `Scan to visit ${label}`,
            files: [file],
          })
          return
        }
      }

      if (canNativeShare) {
        await navigator.share({
          title: label,
          text: `Visit ${label}`,
          url: qrUrl,
        })
        return
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return
    }

    navigator.clipboard
      .writeText(qrUrl)
      .then(() => showMessage('Link copied — sharing is not supported here.'))
      .catch(() => showMessage('Unable to copy link'))
    showMessage('Link copied — sharing is not supported here.')
  }

  const handleContinue = async () => {
    if (continuing) return
    setContinuing(true)
    try {
      await api.launch()
      navigate(ROUTES.SETUP_REVIEW, { replace: true })
    } catch (err) {
      showMessage(err.message)
      setContinuing(false)
    }
  }

  return (
    <div className="launch-page">
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
        </div>
      </header>

      <nav className="steps static-progress" aria-hidden="true">
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
      <OnboardingProgress className="steps dynamic-progress" compact />

      <main className="main-container">
        <section className="launch-card">
          <div className="card-heading">
            <div className="step-label">STEP 4 OF 4</div>

            <h1>Your digital {copy.noun} is ready</h1>

            <p>
              Print your QR code, share your link, then launch to send your
              profile for admin review.
            </p>
          </div>

          <div className="link-section">
            <div className="link-icon">
              <img src="/images/website icon.svg" alt="" />
            </div>

            <div className="link-content">
              <span>YOUR WEB ADDRESS</span>
              <strong>{LIVE_LINK || hostname}</strong>
            </div>

            <button className="link-action" onClick={copyRestaurantLink}>
              <img src="/images/copy.svg" alt="" />
            </button>

            <button className="link-action" onClick={handleOpenLink}>
              <img src="/images/arrow.svg" alt="" />
            </button>
          </div>

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

          <div className="preview-title">HOW IT LOOKS IN REAL LIFE</div>

          <div className="real-life-grid">
            <div className="real-card">
              <div className="real-image">
                <QrCodePreview value={LIVE_LINK} size={120} alt={`${displayName} QR code`} />
                <span>{displayName}</span>
              </div>
              <div className="real-label">Table tent</div>
            </div>

            <div className="real-card">
              <div className="real-image">
                <QrCodePreview value={LIVE_LINK} size={120} alt={`${displayName} QR code`} />
                <span>{displayName}</span>
              </div>
              <div className="real-label">Sticker</div>
            </div>

            <div className="real-card">
              <div className="real-image">
                <QrCodePreview value={LIVE_LINK} size={120} alt={`${displayName} QR code`} />
                <span>{displayName}</span>
              </div>
              <div className="real-label">Business card</div>
            </div>

            <div className="real-card">
              <div className="real-image poster">
                <QrCodePreview value={LIVE_LINK} size={120} alt={`${displayName} QR code`} />
                <span>{displayName}</span>
              </div>
              <div className="real-label">Poster</div>
            </div>
          </div>
          <section className="qr-card-grid" aria-label="QR codes">
            <article
              className="qr-card"
              style={{ '--qr-card-primary': primaryColor, '--qr-card-secondary': secondaryColor, '--qr-card-accent': accentColor }}
            >
              <div className="qr-card-heading">
                <span className="qr-card-icon">ID</span>
                <div>
                  <span>BUSINESS ID</span>
                  <strong>{displayName}</strong>
                </div>
              </div>
              <QrCodePreview value={businessCardLink} size={164} alt={`${displayName} business ID QR code`} />
              <p>Scan to open the digital business card.</p>
              <div className="qr-icon-actions" aria-label="Business ID QR actions">
                <button type="button" onClick={() => handleDownloadQR(businessCardLink, `${displayName}-business-id-QR.png`)} aria-label="Download business ID QR" title="Download QR"><img src="/images/download qr.svg" alt="" /></button>
                <button type="button" onClick={() => handleShareQR(businessCardLink, `${displayName} business ID`)} aria-label="Share business ID QR" title="Share QR"><img src="/images/share qr.svg" alt="" /></button>
                <button type="button" onClick={() => handlePrintQR(businessCardLink, `${displayName} business ID`, businessCardLink)} aria-label="Print business ID QR" title="Print QR"><img src="/images/print qr.svg" alt="" /></button>
              </div>
            </article>

            <article
              className="qr-card location-qr-card"
              style={{ '--qr-card-primary': primaryColor, '--qr-card-secondary': secondaryColor, '--qr-card-accent': accentColor }}
            >
              <div className="qr-card-heading">
                <span className="qr-card-icon">⌖</span>
                <div>
                  <span>BUSINESS LOCATION</span>
                  <strong>{mapQuery || 'Add your address in Profile'}</strong>
                </div>
              </div>
              {mapEmbedLink ? <iframe className="location-map" src={mapEmbedLink} title={`${displayName} location map`} loading="lazy" /> : null}
              <QrCodePreview value={locationLink} size={110} alt={`${displayName} location QR code`} emptyMessage="Add an address in Profile to create a location QR." />
              {locationLink ? <a href={locationLink} target="_blank" rel="noreferrer">Open in Google Maps</a> : null}
              <div className="qr-icon-actions" aria-label="Business location QR actions">
                <button type="button" disabled={!locationLink} onClick={() => handleDownloadQR(locationLink, `${displayName}-location-QR.png`)} aria-label="Download business location QR" title="Download QR"><img src="/images/download qr.svg" alt="" /></button>
                <button type="button" disabled={!locationLink} onClick={() => handleShareQR(locationLink, `${displayName} location`)} aria-label="Share business location QR" title="Share QR"><img src="/images/share qr.svg" alt="" /></button>
                <button type="button" disabled={!locationLink} onClick={() => handlePrintQR(locationLink, `${displayName} location`, mapQuery)} aria-label="Print business location QR" title="Print QR"><img src="/images/print qr.svg" alt="" /></button>
              </div>
            </article>

            <article
              className="qr-card website-qr-card"
              style={{ '--qr-card-primary': primaryColor, '--qr-card-secondary': secondaryColor, '--qr-card-accent': accentColor }}
            >
              <div className="qr-card-heading">
                <span className="qr-card-icon">⌁</span>
                <div>
                  <span>WEBSITE QR</span>
                  <strong>{hostname}</strong>
                </div>
              </div>
              <QrCodePreview value={LIVE_LINK} size={164} alt={`${displayName} website QR code`} />
              <div className="qr-icon-actions" aria-label="Website QR actions">
                <button type="button" onClick={() => handleDownloadQR(LIVE_LINK)} aria-label="Download website QR" title="Download QR"><img src="/images/download qr.svg" alt="" /></button>
                <button type="button" onClick={() => handleShareQR(LIVE_LINK, `${displayName} website`)} aria-label="Share website QR" title="Share QR"><img src="/images/share qr.svg" alt="" /></button>
                <button type="button" onClick={() => handlePrintQR(LIVE_LINK, `${displayName} website`, hostname)} aria-label="Print website QR" title="Print QR"><img src="/images/print qr.svg" alt="" /></button>
              </div>
            </article>
          </section>
        </section>

        <section className="phone-area">
          <div className="phone">
            <div
              className="phone-screen"
              style={{ background: secondaryColor, color: accentColor }}
            >
              <div className="phone-top">
                <span>9:41</span>
                <div className="dynamic-island"></div>
                <span>▯</span>
              </div>

              <div className="restaurant-logo" style={{ background: primaryColor }}>
                {previewInitial}
              </div>

              <h2>{displayName}</h2>

              <p className="restaurant-location">
                {locationPreviewLine(copy, cuisine, city)}
              </p>

              <div className="phone-qr">
                <QrCodePreview value={LIVE_LINK} size={180} alt={`${displayName} QR code`} />
              </div>

              <div className="qr-bottom-content">
                <div className="qr-link">{hostname}</div>
                <p className="preview-note">Preview · goes live after approval</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bottom-bar">
        <button className="back-btn" onClick={() => navigate('/brand')}>
          ← &nbsp;Back
        </button>

        <div className="step-counter">Step 4 of 4 · Launch</div>

        <button className="launch-btn" disabled={continuing} onClick={handleContinue}>
          {continuing
            ? 'Submitting…'
            : restaurantStatus === 'rejected'
              ? 'Resubmit for review'
              : 'Launch'}
        </button>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default Launch
