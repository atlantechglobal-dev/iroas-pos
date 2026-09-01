import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import Select from '../../components/Select'
import './Domain.css'

const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')

function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildSuggestions(name, city) {
  const base = slugify(name || '')
  if (!base) return []

  const citySlug = slugify(city || '')

  const extras = [
    citySlug ? `${base}-${citySlug}` : null,
    `the-${base}`,
    `${base}-kitchen`,
    `eat-${base}`,
    `${base}-dine`,
    `${base}-eats`,
    `${base}-table`,
  ].filter(Boolean)

  // base name-slug always leads; the rest are shuffled for variety on every visit
  const unique = [...new Set(extras)]

  return [base, ...shuffle(unique)].slice(0, 5)
}

const DOMAIN_SUFFIXES = ['.iroas.com', '.iroas.co.za']

function Domain() {
  const navigate = useNavigate()

  const [restaurantName, setRestaurantName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [city, setCity] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [domainSuffix, setDomainSuffix] = useState('.iroas.com')
  const [customDomain, setCustomDomain] = useState('')
  const [mode, setMode] = useState('subdomain')
  const [saveLabel, setSaveLabel] = useState('Save & continue later')

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        if (restaurant.cuisine) setCuisine(restaurant.cuisine)
        if (restaurant.city) setCity(restaurant.city)
        if (restaurant.subdomain) setSubdomain(restaurant.subdomain)
        if (restaurant.domain_suffix) setDomainSuffix(restaurant.domain_suffix)
        if (restaurant.custom_domain) {
          setCustomDomain(restaurant.custom_domain)
          setMode('custom')
        }
      })
      .catch(() => {})
  }, [])

  const suggestions = useMemo(
    () => buildSuggestions(restaurantName, city),
    [restaurantName, city],
  )

  const cleanSubdomain = (value) =>
    value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')

  const handleSubdomainChange = (event) => {
    setSubdomain(cleanSubdomain(event.target.value))
  }

  const handleSuggestionClick = (domain) => {
    setSubdomain(domain)
  }

  const suggestedPlaceholder = slugify(restaurantName || '') || 'yourrestaurant'

  const availableMessage = subdomain
    ? `✓ ${subdomain}${domainSuffix} is available`
    : 'Enter a subdomain'

  const browserAddress =
    mode === 'custom' && customDomain
      ? `◉  https://${customDomain}`
      : subdomain
        ? `◉  https://${subdomain}${domainSuffix}`
        : `◉  https://${suggestedPlaceholder}${domainSuffix}`

  const previewLetter = restaurantName.trim()
    ? restaurantName.trim().charAt(0).toUpperCase()
    : 'R'

  const isEnabled = useMemo(
    () =>
      mode === 'custom'
        ? customDomain.trim().length > 0
        : subdomain.trim().length > 0,
    [mode, subdomain, customDomain],
  )

  const buildPayload = () => ({
    subdomain: mode === 'subdomain' ? subdomain : null,
    domainSuffix,
    customDomain: mode === 'custom' ? customDomain : null,
  })

  const handleSave = async () => {
    try {
      await api.updateDomain(buildPayload())
      alert('Your progress has been saved.')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleContinue = async () => {
    if (isEnabled === false) {
      alert(
        mode === 'custom'
          ? 'Please enter your domain first.'
          : 'Please choose a subdomain first.',
      )
      return
    }

    try {
      await api.updateDomain(buildPayload())
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
              {/* MODE TOGGLE */}
              <div className="mode-toggle">
                <button
                  type="button"
                  className={`mode-option ${mode === 'subdomain' ? 'active' : ''}`}
                  onClick={() => setMode('subdomain')}
                >
                  <strong>Free IROAS subdomain</strong>
                  <span>Get an address with an IROAS handle attached</span>
                </button>

                <button
                  type="button"
                  className={`mode-option ${mode === 'custom' ? 'active' : ''}`}
                  onClick={() => setMode('custom')}
                >
                  <strong>Connect my own domain</strong>
                  <span>Use a domain you already own — no IROAS handle</span>
                </button>
              </div>

              {mode === 'subdomain' ? (
                <>
                  {/* FREE SUBDOMAIN */}
                  <div className="field-section">
                    <label className="field-label">FREE IROAS SUBDOMAIN</label>

                    <div className="subdomain-box">
                      <span className="protocol">https://</span>

                      <input
                        type="text"
                        autoComplete="off"
                        placeholder={suggestedPlaceholder}
                        value={subdomain}
                        onChange={handleSubdomainChange}
                      />

                      <Select
                        className="domain-ending-select"
                        value={domainSuffix}
                        onChange={setDomainSuffix}
                        options={DOMAIN_SUFFIXES.map((suffix) => ({ value: suffix, label: suffix }))}
                      />

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
                      {suggestions.length > 0 ? (
                        suggestions.map((domain) => (
                          <button
                            key={domain}
                            className={`suggestion ${
                              subdomain === domain ? 'selected' : ''
                            }`}
                            onClick={() => handleSuggestionClick(domain)}
                          >
                            {domain}{domainSuffix}
                          </button>
                        ))
                      ) : (
                        <p className="suggestions-empty">
                          Add your restaurant name in Step 1 to see suggestions.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* CUSTOM DOMAIN */
                <div className="custom-domain-card standalone">
                  <div className="custom-icon">◉</div>

                  <div className="custom-content">
                    <div className="custom-title">Connect your own domain</div>

                    <div className="custom-description">
                      Enter a domain you already own — we'll handle SSL and
                      DNS automatically. Works with .com, .co.za, or any
                      extension.
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
              )}
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
                <div className="restaurant-avatar">{previewLetter}</div>

                <h2>{restaurantName.trim() || 'Your restaurant'}</h2>

                <p>
                  {[cuisine.trim(), city.trim()].filter(Boolean).join(' · ') ||
                    'Cuisine · City'}
                </p>

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
