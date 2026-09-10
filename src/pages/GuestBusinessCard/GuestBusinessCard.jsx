import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QrCodePreview } from '../../components/QrCodePreview.jsx'
import { BusinessCardVisual } from '../../components/businessCard/BusinessCardVisual.jsx'
import { api } from '../../lib/api'
import {
  cardDisplayHost,
  cardPublicUrl,
  guestSitePath,
  loadCardPreview,
} from '../../utils/guestLinks.js'
import './GuestBusinessCard.css'
import './BusinessIdProfile.css'

const THEME_COLORS = {
  lime: {
    accent: '#8dc63f',
    dark: '#7ab52f',
    headerText: '#16311a',
    panel: '#f0c12e',
    ink: '#17171a',
    muted: '#5a5a52',
    hot: '#8dc63f',
  },
  charcoal: {
    accent: '#26282a',
    dark: '#141516',
    headerText: '#f2f2ef',
    panel: '#2a2c2e',
    ink: '#f2f2ef',
    muted: '#a7a5a0',
    hot: '#f08a2a',
  },
  olive: {
    accent: '#5f8f5a',
    dark: '#4d7549',
    headerText: '#f4f8f2',
    panel: '#6a945f',
    ink: '#f4f8f2',
    muted: '#d5e2d2',
    hot: '#c4e07a',
  },
}

function BusinessIdProfile({ restaurant, card, brand, websiteUrl, onSaveContact, onShare }) {
  const locationHref = card.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`
    : ''
  const websiteHref = card.website
    ? /^https?:/i.test(card.website) ? card.website : `https://${card.website}`
    : websiteUrl
  const profileStyle = {
    '--business-id-primary': brand?.primaryColor || '#8dc63f',
    '--business-id-secondary': brand?.secondaryColor || '#f0f72a',
    '--business-id-accent': brand?.accentColor || '#5a5a52',
  }

  return (
    <article className="business-id-profile" style={profileStyle}>
      <div
        className="business-id-cover"
        style={brand?.coverDataUrl ? { backgroundImage: `url(${brand.coverDataUrl})` } : undefined}
      />
      <div className="business-id-logo">
        {brand?.logoDataUrl ? <img src={brand.logoDataUrl} alt={`${restaurant} logo`} /> : <span>{restaurant.slice(0, 2).toUpperCase()}</span>}
      </div>
      <section className="business-id-intro">
        <h1>{restaurant}</h1>
        <p>{card.tagline || card.role || 'Welcome to our business'}</p>
        <div className="business-id-socials" aria-label="Social profiles">
          {card.insta ? <a href={`https://instagram.com/${card.insta.replace(/^@/, '')}`} target="_blank" rel="noreferrer" aria-label="Instagram">◎</a> : null}
          {card.phone ? <a href={`https://wa.me/${card.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">◔</a> : null}
        </div>
        <div className="business-id-primary-actions">
          <button type="button" onClick={onSaveContact}>♙ <span>Save contact</span></button>
          <button type="button" onClick={onShare}>⌯ <span>Share card</span></button>
        </div>
      </section>
      <section className="business-id-contact-grid">
        {card.phone ? <a href={`tel:${card.phone.replace(/\s/g, '')}`}><b>☎</b><span>Call</span></a> : null}
        {card.email ? <a href={`mailto:${card.email}`}><b>✉</b><span>Email</span></a> : null}
        <a href={websiteHref} target="_blank" rel="noreferrer"><b>◎</b><span>Website</span></a>
        {locationHref ? <a href={locationHref} target="_blank" rel="noreferrer"><b>⌖</b><span>Location</span></a> : null}
      </section>
    </article>
  )
}

function GuestBusinessCard() {
  const { slug = 'your-card' } = useParams()
  const saved = loadCardPreview(slug)
  const [remote, setRemote] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .getPublicSite(slug)
      .then((data) => {
        if (!cancelled) setRemote(data)
      })
      .catch(() => {
        if (!cancelled) setRemote(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const theme = saved?.theme || 'lime'
  const layout = saved?.layout || 'split-gold'
  const colors = THEME_COLORS[theme] || THEME_COLORS.lime
  const restaurant =
    saved?.restaurantName || remote?.restaurant?.name || slug.replace(/-/g, ' ')
  const card = {
    name: remote?.restaurant?.name || 'Your name',
    role: 'Owner',
    phone: remote?.restaurant?.phone || '',
    email: remote?.restaurant?.email || '',
    website: remote?.restaurant?.website || '',
    insta: remote?.restaurant?.socials?.instagram || '',
    address: remote?.restaurant?.address || '',
    tagline: remote?.restaurant?.tagline || '',
    heroDataUrl: remote?.brand?.coverDataUrl || '',
    circleDataUrl: '',
    logoDataUrl: remote?.brand?.logoDataUrl || '',
    ...(saved?.card || {}),
  }
  // Prefer saved card fields, but fill blanks from public API
  ;['phone', 'email', 'website', 'address', 'tagline', 'logoDataUrl', 'heroDataUrl'].forEach(
    (key) => {
      if (!card[key] && remote) {
        if (key === 'logoDataUrl') card.logoDataUrl = remote.brand?.logoDataUrl || ''
        else if (key === 'heroDataUrl') card.heroDataUrl = remote.brand?.coverDataUrl || ''
        else if (key === 'tagline') card.tagline = remote.restaurant?.tagline || ''
        else card[key] = remote.restaurant?.[key] || ''
      }
    },
  )

  const publicUrl = cardPublicUrl(slug)
  const websiteUrl = guestSitePath(slug, 'website')

  const handleSaveContact = () => {
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${restaurant}`,
      card.phone ? `TEL:${card.phone}` : '',
      card.email ? `EMAIL:${card.email}` : '',
      card.website ? `URL:${card.website}` : `URL:${window.location.origin}${websiteUrl}`,
      card.address ? `ADR:;;${card.address};;;;` : '',
      'END:VCARD',
    ].filter(Boolean).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([vCard], { type: 'text/vcard' }))
    link.download = `${slug}-contact.vcf`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleShare = async () => {
    const shareData = { title: restaurant, text: card.tagline || `Connect with ${restaurant}`, url: publicUrl }
    try {
      if (navigator.share) await navigator.share(shareData)
      else await navigator.clipboard.writeText(publicUrl)
    } catch {
      // Closing the native share panel is not an error for the visitor.
    }
  }

  return (
    <div className="guest-card-page">
      <BusinessIdProfile
        restaurant={restaurant}
        card={card}
        brand={remote?.brand}
        websiteUrl={websiteUrl}
        onSaveContact={handleSaveContact}
        onShare={handleShare}
      />

      <div className="guest-card-shell legacy-business-card" aria-hidden="true">
        <BusinessCardVisual
          layout={layout}
          theme={theme}
          colors={colors}
          displayRestaurant={restaurant}
          card={card}
          interactive
        />

        <div className="guest-card-qr">
          <QrCodePreview value={publicUrl} size={110} alt="Business card QR" />
          <div>
            <strong>Scan to save</strong>
            <p>{cardDisplayHost(slug)}</p>
            <div className="guest-card-links">
              <Link to={guestSitePath(slug, 'website')}>Website</Link>
              <Link to={`/l/${slug}`}>One Link</Link>
              <Link to={guestSitePath(slug, 'book')}>Book a table</Link>
            </div>
          </div>
        </div>
      </div>

      <p className="guest-card-footer">
        Powered by IROAS · <Link to="/digital-business-card">Back to editor</Link>
      </p>
    </div>
  )
}

export default GuestBusinessCard
