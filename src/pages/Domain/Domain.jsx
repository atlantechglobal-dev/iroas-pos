import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import './Domain.css'

const SUGGESTIONS = [
  'trident',
  'trident-mumbai',
  'the-trident',
  'trident-kitchen',
  'eat-trident',
]

function Domain() {
  const navigate = useNavigate()

  const [subdomain, setSubdomain] = useState('s')
  const [customDomain, setCustomDomain] = useState('')
  const [saveLabel, setSaveLabel] = useState('Save & continue later')

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.subdomain) setSubdomain(restaurant.subdomain)
        if (restaurant.custom_domain) setCustomDomain(restaurant.custom_domain)
      })
      .catch(() => {})
  }, [])

  const cleanSubdomain = (value) =>
    value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')

  const handleSubdomainChange = (event) => {
    setSubdomain(cleanSubdomain(event.target.value))
  }

  const handleSuggestionClick = (domain) => {
    setSubdomain(domain)
  }

  const availableMessage = subdomain
    ? `✓ ${subdomain}.iroas.com is available`
    : 'Enter a subdomain'

  const browserAddress = subdomain
    ? `◉  https://${subdomain}.iroas.com`
    : '◉  https://s.iroas.com'

  const isEnabled = useMemo(
    () => subdomain.trim().length > 0 || customDomain.trim().length > 0,
    [subdomain, customDomain],
  )

  const handleSave = async () => {
    try {
      await api.updateDomain({ subdomain, customDomain })
      alert('Your progress has been saved.')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleContinue = async () => {
    if (subdomain.trim().length === 0 && customDomain.trim().length === 0) {
      alert('Please choose a web address first.')
      return
    }

    try {
      await api.updateDomain({ subdomain, customDomain })
      navigate('/brand')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="domain-page">
      {/* TOP HEADER */}
      <header className="top-header">
        <div className="header-left">
          <img
            src="/images/Logo9-1 1.svg"
            alt="IROAS"
            className="iroas-logo"
          />

          <div className="setup-time">
            <span className="clock-small">◷</span>
            About 2–3 minutes
          </div>
        </div>

        <div className="header-right">
          <div className="autosaved">
            <span className="save-dot"></span>
            Auto-saved
          </div>

          <button className="save-later" onClick={handleSave}>
            {saveLabel}
          </button>
        </div>
      </header>

      {/* PROGRESS NAVIGATION */}
      <nav className="progress-nav">
        <div className="step completed">
          <div className="step-icon">✓</div>

          <div className="step-text">
            <strong>Profile</strong>
            <span>Tell us about your place</span>
          </div>
        </div>

        <div className="step active">
          <div className="step-icon">
            <img src="/images/domain.png" alt="Domain" />
          </div>

          <div className="step-text">
            <strong>Domain</strong>
            <span>Pick your web address</span>
          </div>
        </div>

        <div className="step">
          <div className="step-icon">
            <img src="/images/brand.png" alt="Brand" />
          </div>

          <div className="step-text">
            <strong>Brand</strong>
            <span>Logo, colors & theme</span>
          </div>
        </div>

        <div className="step">
          <div className="step-icon">
            <img src="/images/qr.png" alt="Launch" />
          </div>

          <div className="step-text">
            <strong>Launch</strong>
            <span>QR & digital card</span>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-area">
        <div className="content-wrapper">
          {/* LEFT CARD */}
          <section className="domain-card">
            <div className="card-header">
              <div className="step-label">
                <span>
                  <img src="/images/domain.png" alt="" />
                </span>
                STEP 2 OF 4
              </div>

              <h1>Choose your restaurant's web address</h1>

              <p>
                Customers will use this link to discover your restaurant. Get
                a free IROAS subdomain or connect your own.
              </p>
            </div>

            <div className="card-body">
              {/* FREE SUBDOMAIN */}
              <div className="field-section">
                <label className="field-label">FREE IROAS SUBDOMAIN</label>

                <div className="subdomain-box">
                  <span className="protocol">https://</span>

                  <input
                    type="text"
                    autoComplete="off"
                    value={subdomain}
                    onChange={handleSubdomainChange}
                  />

                  <span className="domain-ending">.iroas.com</span>

                  <div className="availability">✓</div>
                </div>

                <div className="available-message">{availableMessage}</div>
              </div>

              {/* AI SUGGESTIONS */}
              <div className="suggestions-section">
                <div className="suggestions-title">
                  <span>
                    <img src="/images/security.svg" alt="" />
                  </span>
                  AI-GENERATED SUGGESTIONS
                </div>

                <div className="suggestions">
                  {SUGGESTIONS.map((domain) => (
                    <button
                      key={domain}
                      className={`suggestion ${
                        subdomain === domain ? 'selected' : ''
                      }`}
                      onClick={() => handleSuggestionClick(domain)}
                    >
                      {domain}.iroas.com
                    </button>
                  ))}
                </div>
              </div>

              {/* CUSTOM DOMAIN */}
              <div className="custom-domain-card">
                <div className="custom-icon">◉</div>

                <div className="custom-content">
                  <div className="custom-title">Already own a domain?</div>

                  <div className="custom-description">
                    Connect your custom domain anytime — we'll handle SSL and
                    DNS automatically.
                  </div>

                  <div className="custom-input">
                    <span className="custom-protocol">https://</span>

                    <input
                      type="text"
                      placeholder="yourrestaurant.com"
                      value={customDomain}
                      onChange={(event) =>
                        setCustomDomain(event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT PREVIEW */}
          <aside className="preview-area">
            <div className="browser-preview">
              <div className="browser-header">
                <div className="browser-dots">
                  <span className="red"></span>
                  <span className="yellow"></span>
                  <span className="green"></span>
                </div>

                <div className="browser-address">{browserAddress}</div>
              </div>

              <div className="website-preview">
                <div className="restaurant-avatar">T</div>

                <h2>trident</h2>

                <p>Indian · Mumbai</p>

                <button className="reserve-button">Reserve a table</button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* BOTTOM BAR */}
      <footer className="bottom-bar">
        <button
          className="back-button"
          onClick={() => navigate('/restaurant-setup')}
        >
          ← <span>Back</span>
        </button>

        <div className="page-indicator">Step 2 of 4 · Domain</div>

        <button
          className={`continue-button ${isEnabled ? 'enabled' : ''}`}
          onClick={handleContinue}
        >
          Continue <span>→</span>
        </button>
      </footer>
    </div>
  )
}

export default Domain
