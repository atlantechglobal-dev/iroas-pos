import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import './Brand.css'

const FONTS = [
  {
    key: 'Plus Jakarta Sans',
    symbolClass: '',
    name: 'Plus Jakarta',
    body: 'Body · Inter',
    tag: 'MODERN · EDITORIAL',
  },
  {
    key: 'Playfair Display',
    symbolClass: 'serif',
    name: 'Playfair Display',
    body: 'Body · Inter',
    tag: 'LUXURY · REFINED',
  },
  {
    key: 'Space Grotesk',
    symbolClass: '',
    name: 'Space Grotesk',
    body: 'Body · Inter',
    tag: 'TECH · CONFIDENT',
  },
  {
    key: 'DM Serif Display',
    symbolClass: 'serif',
    name: 'DM Serif Display',
    body: 'Body · DM Sans',
    tag: 'BOLD · CLASSIC',
  },
]

const THEMES = [
  {
    key: 'modern',
    imageClass: 'modern-theme',
    name: 'Modern Minimal',
    description: 'Lots of whitespace, imagery',
    lines: 2,
    background: 'white',
    color: '#202126',
  },
  {
    key: 'luxury',
    imageClass: 'luxury-theme',
    name: 'Luxury Dining',
    description: 'Editorial typography, dark accents',
    lines: 0,
    background: '#10182a',
    color: 'white',
  },
  {
    key: 'cafe',
    imageClass: 'cafe-theme',
    name: 'Cafe Style',
    description: 'Friendly, soft, sun-washed',
    lines: 2,
    background: '#fff1b9',
    color: '#202126',
  },
  {
    key: 'traditional',
    imageClass: 'traditional-theme',
    name: 'Traditional',
    description: 'Warm hues, ornate accents',
    lines: 1,
    background: '#fff4eb',
    color: '#202126',
  },
  {
    key: 'dark',
    imageClass: 'dark-theme',
    name: 'Dark Elegant',
    description: 'Premium, night-time dining',
    lines: 0,
    background: '#10182a',
    color: 'white',
  },
  {
    key: 'bistro',
    imageClass: 'bistro-theme',
    name: 'Casual Bistro',
    description: 'Light, approachable, lively',
    lines: 1,
    background: '#f7f7f4',
    color: '#202126',
  },
]

function Brand() {
  const navigate = useNavigate()

  const [logoDataUrl, setLogoDataUrl] = useState(null)
  const [primaryColor, setPrimaryColor] = useState('#F97316')
  const [secondaryColor, setSecondaryColor] = useState('#F0F72A')
  const [accentColor, setAccentColor] = useState('#BDB8A4')
  const [selectedFont, setSelectedFont] = useState('Plus Jakarta Sans')
  const [selectedTheme, setSelectedTheme] = useState('modern')

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.primary_color) setPrimaryColor(restaurant.primary_color)
        if (restaurant.secondary_color) setSecondaryColor(restaurant.secondary_color)
        if (restaurant.accent_color) setAccentColor(restaurant.accent_color)
        if (restaurant.font) setSelectedFont(restaurant.font)
        if (restaurant.theme) setSelectedTheme(restaurant.theme)
        if (restaurant.logo_data_url) setLogoDataUrl(restaurant.logo_data_url)
      })
      .catch(() => {})
  }, [])

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => setLogoDataUrl(loadEvent.target.result)
    reader.readAsDataURL(file)
  }

  const buildBrandData = () => ({
    primaryColor,
    secondaryColor,
    accentColor,
    font: selectedFont,
    theme: selectedTheme,
    logoDataUrl,
  })

  const handleSave = async () => {
    try {
      await api.updateBrand(buildBrandData())
      alert('Your progress has been saved.')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleContinue = async () => {
    try {
      await api.updateBrand(buildBrandData())
      navigate('/launch')
    } catch (err) {
      alert(err.message)
    }
  }

  const activeTheme =
    THEMES.find((theme) => theme.key === selectedTheme) ?? THEMES[0]

  return (
    <div className="brand-page">
      {/* TOP HEADER */}
      <header className="top-header">
        <div className="header-left">
          <img
            src="/images/Logo9-1 1.svg"
            alt="IROAS"
            className="iroas-logo"
          />

          <div className="setup-time">
            <span>◷</span>
            About 2–3 minutes
          </div>
        </div>

        <div className="header-right">
          <div className="autosaved">
            <span className="save-dot"></span>
            Auto-saved
          </div>

          <button className="save-later" onClick={handleSave}>
            Save & continue later
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

        <div className="step completed">
          <div className="step-icon">✓</div>

          <div className="step-text">
            <strong>Domain</strong>
            <span>Pick your web address</span>
          </div>
        </div>

        <div className="step active">
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

      {/* MAIN */}
      <main className="main-area">
        <div className="content-wrapper">
          {/* LEFT BRAND CARD */}
          <section className="brand-card">
            <div className="card-header">
              <div className="step-label">
                <span>◉</span>
                STEP 3 OF 4
              </div>

              <h1>Make it feel like your brand</h1>

              <p>
                Upload a logo, pick your colors and typography. Everything
                updates in the live preview instantly.
              </p>
            </div>

            <div className="card-body">
              {/* LOGO */}
              <div className="section">
                <label className="section-label">LOGO</label>

                <div className="logo-upload">
                  <div className="logo-preview">
                    {logoDataUrl ? (
                      <img
                        src={logoDataUrl}
                        alt="Logo preview"
                        style={{
                          width: '24px',
                          height: '24px',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <span>▧</span>
                    )}
                  </div>

                  <label className="upload-box" htmlFor="logoInput">
                    <span className="upload-main">
                      Click to upload
                      <span>or drag & drop</span>
                    </span>

                    <span className="upload-sub">
                      PNG, JPG, SVG · up to 2 MB
                    </span>
                  </label>

                  <input
                    type="file"
                    id="logoInput"
                    accept=".png,.jpg,.jpeg,.svg"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>

              {/* BRAND COLORS */}
              <div className="section">
                <label className="section-label">BRAND COLORS</label>

                <div className="color-row">
                  <div className="color-box">
                    <span className="color-title">PRIMARY</span>

                    <div className="color-value">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(event) =>
                          setPrimaryColor(event.target.value)
                        }
                      />

                      <span>{primaryColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="color-box">
                    <span className="color-title">SECONDARY</span>

                    <div className="color-value">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(event) =>
                          setSecondaryColor(event.target.value)
                        }
                      />

                      <span>{secondaryColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="color-box">
                    <span className="color-title">ACCENT</span>

                    <div className="color-value">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(event) =>
                          setAccentColor(event.target.value)
                        }
                      />

                      <span>{accentColor.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TYPOGRAPHY */}
              <div className="section">
                <label className="section-label">TYPOGRAPHY</label>

                <div className="font-grid">
                  {FONTS.map((font) => (
                    <button
                      key={font.key}
                      className={`font-card ${
                        selectedFont === font.key ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedFont(font.key)}
                    >
                      <span className={`font-symbol ${font.symbolClass}`}>
                        T
                      </span>

                      <span className="font-info">
                        <strong>{font.name}</strong>
                        <small>{font.body}</small>
                        <em>{font.tag}</em>
                      </span>

                      {selectedFont === font.key && (
                        <span className="font-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* THEMES */}
              <div className="section">
                <label className="section-label">THEME TEMPLATE</label>

                <div className="theme-grid">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.key}
                      className={`theme-card ${
                        selectedTheme === theme.key ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedTheme(theme.key)}
                    >
                      <div className={`theme-image ${theme.imageClass}`}>
                        <span className="mini-menu">≡ MENU</span>

                        <div className="mini-content">
                          <strong>trident</strong>

                          {theme.lines > 0 && (
                            <div className="mini-lines">
                              {Array.from({ length: theme.lines }).map(
                                (_, i) => (
                                  <i key={i}></i>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="theme-info">
                        <strong>{theme.name}</strong>
                        <span>{theme.description}</span>
                      </div>

                      {selectedTheme === theme.key && (
                        <span className="theme-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT PREVIEW */}
          <aside className="preview-area">
            <div className="preview-label">BRAND PREVIEW</div>

            <div
              className="brand-preview"
              style={{
                fontFamily: selectedFont,
                background: activeTheme.background,
                color: activeTheme.color,
              }}
            >
              <div className="preview-top">
                <div className="preview-name">
                  <span
                    className="preview-logo"
                    style={{ background: primaryColor }}
                  >
                    {logoDataUrl ? (
                      <img
                        src={logoDataUrl}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      'T'
                    )}
                  </span>

                  <strong>trident</strong>
                </div>

                <button
                  className="order-button"
                  style={{ background: primaryColor }}
                >
                  Order
                </button>
              </div>

              <div className="preview-content">
                <span className="welcome">WELCOME</span>

                <h2>Taste what makes trident special.</h2>

                <p>Fresh flavors, crafted with care.</p>

                <div className="preview-buttons">
                  <button
                    className="view-menu"
                    style={{
                      background: primaryColor,
                      borderColor: primaryColor,
                    }}
                  >
                    View menu
                  </button>

                  <button className="reserve">Reserve</button>
                </div>

                <div className="preview-blocks">
                  <div className="preview-block block-one"></div>
                  <div className="preview-block block-two"></div>
                  <div className="preview-block block-three"></div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* BOTTOM BAR */}
      <footer className="bottom-bar">
        <button className="back-button" onClick={() => navigate('/domain')}>
          ← Back
        </button>

        <div className="page-indicator">Step 3 of 4 · Brand</div>

        <button className="continue-button" onClick={handleContinue}>
          Continue →
        </button>
      </footer>
    </div>
  )
}

export default Brand
