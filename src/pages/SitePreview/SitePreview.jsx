import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import './SitePreview.css'

const THEME_LOOK = {
  modern: { background: '#ffffff', color: '#202126', card: '#f7f6f2' },
  luxury: { background: '#10182a', color: '#ffffff', card: 'rgba(255,255,255,0.06)' },
  cafe: { background: '#fff1b9', color: '#202126', card: '#fff8dd' },
  traditional: { background: '#fff4eb', color: '#202126', card: '#fff' },
  dark: { background: '#10182a', color: '#ffffff', card: 'rgba(255,255,255,0.06)' },
  bistro: { background: '#f7f7f4', color: '#202126', card: '#fff' },
}

function SitePreview() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [restaurant, setRestaurant] = useState(null)

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => setRestaurant(restaurant))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="site-preview-page">
        <p className="loading-note">Loading preview…</p>
      </div>
    )
  }

  const name = restaurant?.name?.trim() || 'Your restaurant'
  const cuisine = restaurant?.cuisine?.trim() || ''
  const city = restaurant?.city?.trim() || ''
  const description =
    restaurant?.description?.trim() ||
    `Welcome to ${name}. Fresh flavors, crafted with care.`
  const primary = restaurant?.primary_color || '#F97316'
  const secondary = restaurant?.secondary_color || '#0F172A'
  const accent = restaurant?.accent_color || '#FDBA74'
  const font = restaurant?.font || 'Plus Jakarta Sans'
  const look = THEME_LOOK[restaurant?.theme] || THEME_LOOK.modern
  const logo = restaurant?.logo_data_url
  const initial = name.charAt(0).toUpperCase()
  const hostname = restaurant?.custom_domain
    ? restaurant.custom_domain
    : restaurant?.subdomain
      ? `${restaurant.subdomain}${restaurant.domain_suffix || '.iroas.com'}`
      : 'yourrestaurant.iroas.com'

  return (
    <div className="site-preview-page">
      <div className="preview-chrome">
        <button className="preview-back" type="button" onClick={() => navigate(-1)}>
          ← Back to dashboard
        </button>
        <div className="preview-url-bar">
          <span className="preview-dots">
            <i className="red" /><i className="yellow" /><i className="green" />
          </span>
          <span className="preview-url">🔒 https://{hostname}</span>
        </div>
        <span className="preview-live-badge">
          {restaurant?.status === 'live' ? 'LIVE PREVIEW' : 'DRAFT PREVIEW'}
        </span>
      </div>

      <div
        className="preview-site"
        style={{ background: look.background, color: look.color, fontFamily: font }}
      >
        <header className="site-nav">
          <div className="site-brand">
            <span className="site-logo" style={{ background: primary }}>
              {logo ? <img src={logo} alt="" /> : initial}
            </span>
            <strong>{name}</strong>
          </div>
          <nav className="site-links">
            <a href="#menu">Menu</a>
            <a href="#reserve">Reservations</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
          <button className="site-order-btn" style={{ background: primary }}>Order online</button>
        </header>

        <section className="site-hero">
          <span className="site-eyebrow" style={{ color: primary }}>WELCOME</span>
          <h1>Taste what makes {name} special.</h1>
          <p>{description}</p>
          <div className="site-meta">
            {cuisine && <span>{cuisine}</span>}
            {cuisine && city && <span className="dot">·</span>}
            {city && <span>{city}</span>}
          </div>
          <div className="site-hero-actions">
            <button className="site-btn-primary" style={{ background: primary, borderColor: primary }}>
              View menu
            </button>
            <button className="site-btn-outline" style={{ borderColor: secondary, color: look.color }}>
              Reserve a table
            </button>
          </div>
        </section>

        <section className="site-gallery">
          <div className="site-tile" style={{ background: primary, opacity: 0.85 }} />
          <div className="site-tile" style={{ background: secondary, opacity: 0.85 }} />
          <div className="site-tile" style={{ background: accent, opacity: 0.85 }} />
        </section>

        <section className="site-highlights" style={{ background: look.card }}>
          <div className="highlight-card">
            <strong>Fresh, daily</strong>
            <p>Ingredients sourced and prepared the same day.</p>
          </div>
          <div className="highlight-card">
            <strong>Easy booking</strong>
            <p>Reserve a table online in under a minute.</p>
          </div>
          <div className="highlight-card">
            <strong>Order ahead</strong>
            <p>Skip the wait — order for pickup or delivery.</p>
          </div>
        </section>

        <footer className="site-footer">
          <span>© {new Date().getFullYear()} {name}</span>
          <span className="powered">Powered by IROAS</span>
        </footer>
      </div>
    </div>
  )
}

export default SitePreview
