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

  return (
    <div className="guest-card-page">
      <div className="guest-card-shell">
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
