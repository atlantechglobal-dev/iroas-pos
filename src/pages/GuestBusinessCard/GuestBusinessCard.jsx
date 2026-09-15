import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { QrCodePreview } from '../../components/QrCodePreview.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import {
  cardPublicUrl,
  guestSitePath,
  loadCardPreview,
} from '../../utils/guestLinks.js'
import './GuestBusinessCard.css'
import './BusinessIdProfile.css'

const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
]

function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15 14a5 5 0 00-5-5 5 5 0 00-5 5v1h10v-1zm2-1v-2h-2v-2h2V7h2v2h2v2h-2v2h-2zM10 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7z"
      />
    </svg>
  )
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 16a3 3 0 00-2.4 1.2l-6.2-3.1a3.2 3.2 0 000-2.2l6.2-3.1A3 3 0 1015 7c0 .2 0 .3.1.5L8.9 10.6a3 3 0 100 2.8l6.2 3.1c0 .2-.1.3-.1.5a3 3 0 103-3z"
      />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"
      />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
      />
    </svg>
  )
}

function IconWeb() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-3.2a15 15 0 00-1.3-3.3A8 8 0 0118.9 8zM12 4c.8 1.2 1.5 2.9 1.9 4H10c.4-1.1 1.1-2.8 2-4zM4.3 14a8 8 0 010-4h3.5a17 17 0 000 4H4.3zM8.1 16h3.2c.4 1.1 1.1 2.8 2 4a8 8 0 01-5.2-4zm3.2-8H8.1A8 8 0 0112 4c.9 1.2 1.6 2.9 2 4H11.3zm1.4 2h3.5a17 17 0 010 4h-3.5a17 17 0 010-4zm.6 10c-.9-1.2-1.6-2.9-2-4h3.2a8 8 0 01-1.2 4zm5.2-4h3.5a8 8 0 010-4h-3.5a17 17 0 000 4zM5.1 8h3.2A15 15 0 019.6 4.7 8 8 0 005.1 8zM14.4 19.3A15 15 0 0015.7 16h3.2a8 8 0 01-4.5 3.3z"
      />
    </svg>
  )
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z"
      />
    </svg>
  )
}

function IconEnvelope() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
      />
    </svg>
  )
}

function IconLogin() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 17l1.4-1.4L8.8 13H20v-2H8.8l2.6-2.6L10 7l-5 5 5 5zM4 19h6v2H4a2 2 0 01-2-2V5a2 2 0 012-2h6v2H4v14z"
      />
    </svg>
  )
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4H4V6h16v2zm0 4v6H4v-6h16z"
      />
    </svg>
  )
}

function IconSupport() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1a9 9 0 00-9 9v4a3 3 0 003 3h1v-6H5v-1a7 7 0 0114 0v1h-2v6h1a3 3 0 003-3v-4a9 9 0 00-9-9zm-1 20h2a2 2 0 01-2 2 2 2 0 01-2-2h2z"
      />
    </svg>
  )
}

function SocialIcon({ type }) {
  if (type === 'whatsapp') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 00-8.7 14.9L2 22l5.3-1.4A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1112 20zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 01-1.9-1.2 7.2 7.2 0 01-1.3-1.6c-.1-.2 0-.4.1-.5l.4-.4.2-.3a.5.5 0 000-.5l-.8-1.9c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 00-.7.3 2.9 2.9 0 00-.9 2.2 5 5 0 001.1 2.6 11.4 11.4 0 004.4 3.9 5.2 5.2 0 002.5.8 2.4 2.4 0 001.8-.8 2 2 0 00.4-1.4c0-.2-.1-.3-.3-.4z"
        />
      </svg>
    )
  }
  if (type === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z"
        />
      </svg>
    )
  }
  if (type === 'x') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4 4l6.7 8.7L4.4 20H7l5-6.3L16.8 20H20l-6.9-9 6.3-7H16.5l-4.6 5.8L8.2 4H4z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.9a1.1 1.1 0 11-2.2 0 1.1 1.1 0 012.2 0zM12 9a3 3 0 110 6 3 3 0 010-6z"
      />
    </svg>
  )
}

function Field({ label, children }) {
  return (
    <label className="bid-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function GuestBusinessCard() {
  const { slug = 'your-card' } = useParams()
  const location = useLocation()
  const saved = loadCardPreview(slug)
  const [remote, setRemote] = useState(null)
  const [brochureIndex, setBrochureIndex] = useState(0)
  const [showScanner, setShowScanner] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    date: '',
    time: '',
    details: '',
  })
  const [formSent, setFormSent] = useState(false)

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

  const restaurant =
    saved?.restaurantName || remote?.restaurant?.name || slug.replace(/-/g, ' ')
  const brand = remote?.brand || {}

  const card = useMemo(() => {
    const savedCard = saved?.card || {}
    const rest = remote?.restaurant || {}
    const base = {
      phone: savedCard.phone || rest.phone || '',
      email: savedCard.email || rest.email || '',
      website: savedCard.website || rest.website || '',
      insta: savedCard.insta || rest.socials?.instagram || '',
      facebook: savedCard.facebook || rest.socials?.facebook || '',
      twitter: savedCard.twitter || rest.socials?.twitter || '',
      address: savedCard.address || rest.address || '',
      city: savedCard.city || rest.city || '',
      country: savedCard.country || rest.country || '',
      tagline: savedCard.tagline || rest.tagline || '',
      description:
        savedCard.description || rest.description || brand.description || '',
      cuisine: savedCard.cuisine || rest.cuisine || brand.cuisine || '',
      logoDataUrl: savedCard.logoDataUrl || brand.logoDataUrl || '',
      coverDataUrl:
        savedCard.heroDataUrl ||
        savedCard.coverDataUrl ||
        brand.coverDataUrl ||
        '',
    }
    return base
  }, [remote, saved, brand])

  const media = useMemo(() => {
    const fromGallery = (remote?.gallery || [])
      .map((g) => g?.dataUrl || g?.url || '')
      .filter(Boolean)
    const fromMenu = (remote?.menu || [])
      .flatMap((c) => c.items || [])
      .map((i) => i.imageDataUrl)
      .filter(Boolean)
    const list = [...fromGallery, ...fromMenu]
    return list.length ? list.slice(0, 12) : FALLBACK_PHOTOS
  }, [remote])

  const heroImage = card.coverDataUrl || media[0] || FALLBACK_PHOTOS[0]

  const storyBlocks = useMemo(() => {
    const remoteStories = remote?.restaurant?.stories
    if (
      remoteStories &&
      (remoteStories.traditionBody || remoteStories.varietyBody)
    ) {
      return [
        {
          title: remoteStories.traditionTitle || 'Tradition',
          subtitle:
            remoteStories.traditionSub ||
            (card.cuisine
              ? `${card.cuisine} crafted with care`
              : 'Authentic flavours crafted with passion'),
          body:
            remoteStories.traditionBody ||
            card.description ||
            `At ${restaurant}, we bring warm hospitality and thoughtfully prepared plates to your table.`,
        },
        {
          title: remoteStories.varietyTitle || 'Variety',
          subtitle:
            remoteStories.varietySub || 'Delicious meals for every occasion',
          body:
            remoteStories.varietyBody ||
            `From quiet weeknights to celebrations, ${restaurant} offers seasonal favourites.`,
        },
      ]
    }
    const desc = String(card.description || '').trim()
    if (desc.length > 160) {
      const mid = Math.floor(desc.length / 2)
      const breakAt = desc.indexOf('. ', mid)
      const cut = breakAt > 40 ? breakAt + 1 : mid
      return [
        {
          title: 'Tradition',
          subtitle: card.cuisine
            ? `${card.cuisine} crafted with care`
            : 'Authentic flavours crafted with passion',
          body: desc.slice(0, cut).trim(),
        },
        {
          title: 'Variety',
          subtitle: 'Delicious meals for every occasion',
          body: desc.slice(cut).trim() || desc,
        },
      ]
    }
    return [
      {
        title: 'Tradition',
        subtitle: card.cuisine
          ? `${card.cuisine} crafted with care`
          : 'Authentic flavours crafted with passion',
        body:
          desc ||
          `At ${restaurant}, we bring warm hospitality and thoughtfully prepared plates to your table. Every dish reflects our dedication to quality, taste, and memorable evenings.`,
      },
      {
        title: 'Variety',
        subtitle: 'Delicious meals for every occasion',
        body: `From quiet weeknights to celebrations, ${restaurant} offers seasonal favourites, sharing plates, and catering for gatherings — always consistent, always welcoming.`,
      },
    ]
  }, [card.description, card.cuisine, restaurant, remote])

  const publicUrl = cardPublicUrl(slug)
  const websiteUrl = guestSitePath(slug, 'website')
  const websiteHref = card.website
    ? /^https?:/i.test(card.website)
      ? card.website
      : `https://${card.website}`
    : `${typeof window !== 'undefined' ? window.location.origin : ''}${websiteUrl}`
  const locationQuery = [card.address, card.city, card.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ')
  const locationHref = locationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`
    : ''
  const mapEmbed = locationQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(locationQuery)}&z=15&output=embed`
    : ''

  const primary = brand.primaryColor || '#5c3317'
  const secondary = brand.secondaryColor || '#f0b49e'
  const accent = brand.accentColor || '#8b5a2b'
  const profileStyle = {
    '--bid-primary': primary,
    '--bid-secondary': secondary,
    '--bid-accent': accent,
  }

  const socials = [
    card.phone && {
      key: 'whatsapp',
      href: (() => {
        let digits = String(card.phone).replace(/\D/g, '')
        if (digits.length === 10) digits = `91${digits}`
        return `https://wa.me/${digits}`
      })(),
      label: 'WhatsApp',
      className: 'wa',
    },
    {
      key: 'facebook',
      href: card.facebook
        ? /^https?:/i.test(card.facebook)
          ? card.facebook
          : `https://facebook.com/${card.facebook}`
        : websiteHref,
      label: 'Facebook',
      className: 'fb',
    },
    {
      key: 'x',
      href: card.twitter
        ? /^https?:/i.test(card.twitter)
          ? card.twitter
          : `https://x.com/${card.twitter}`
        : websiteHref,
      label: 'X',
      className: 'x',
    },
    {
      key: 'instagram',
      href: card.insta
        ? `https://instagram.com/${String(card.insta).replace(/^@/, '')}`
        : websiteHref,
      label: 'Instagram',
      className: 'ig',
    },
  ].filter(Boolean)

  const handleSaveContact = () => {
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${restaurant}`,
      card.phone ? `TEL:${card.phone}` : '',
      card.email ? `EMAIL:${card.email}` : '',
      card.website ? `URL:${card.website}` : `URL:${websiteHref}`,
      locationQuery ? `ADR:;;${locationQuery};;;;` : '',
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([vCard], { type: 'text/vcard' }))
    link.download = `${slug}-contact.vcf`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: restaurant,
          text: card.tagline || `Connect with ${restaurant}`,
          url: publicUrl,
        })
      } else {
        await navigator.clipboard.writeText(publicUrl)
      }
    } catch {
      /* ignore */
    }
  }

  const initials = String(restaurant)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  const brochurePhoto = media[brochureIndex % media.length]

  return (
    <div className="guest-card-page bid-page" style={profileStyle}>
      <article className="bid-card">
        <div className="bid-online">
          <em /> Online
        </div>

        <header
          className={`bid-qr-hero${showScanner ? ' is-scanner' : ''}`}
          onMouseEnter={() => setShowScanner(true)}
          onMouseLeave={() => setShowScanner(false)}
          onFocus={() => setShowScanner(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setShowScanner(false)
          }}
          onClick={() => setShowScanner((v) => !v)}
          role="button"
          tabIndex={0}
          aria-label={
            showScanner
              ? 'Business ID QR code. Click or hover away to show brochure.'
              : 'Brochure photo. Hover or click to show QR scanner.'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setShowScanner((v) => !v)
            }
          }}
        >
          <div className="bid-hero-brochure" aria-hidden={showScanner}>
            <img
              className="bid-hero-photo"
              src={heroImage}
              alt=""
            />
          </div>

          <div className="bid-hero-scanner" aria-hidden={!showScanner}>
            <div className="bid-qr-frame">
              <QrCodePreview
                value={publicUrl}
                size={152}
                alt={`${restaurant} business ID QR`}
              />
            </div>
          </div>

          <div className="bid-logo">
            {card.logoDataUrl ? (
              <img src={card.logoDataUrl} alt={`${restaurant} logo`} />
            ) : (
              <span>{initials || 'ID'}</span>
            )}
          </div>
        </header>

        <section className="bid-intro">
          <h1>{restaurant}</h1>
          <p className="bid-tagline">
            “{card.tagline || 'Good food, warm hospitality.'}”
          </p>

          <div className="bid-socials" aria-label="Social profiles">
            {socials.map((s) => (
              <a
                key={s.key}
                className={`bid-social ${s.className}`}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
              >
                <SocialIcon type={s.key === 'instagram' ? 'instagram' : s.key} />
              </a>
            ))}
          </div>

          <div className="bid-primary-actions">
            <button type="button" onClick={handleSaveContact}>
              <IconUserPlus />
              <span>Save Contact</span>
            </button>
            <button type="button" onClick={handleShare}>
              <IconShare />
              <span>Share Card</span>
            </button>
          </div>
        </section>

        <section className="bid-contact-grid" aria-label="Quick actions">
          {card.phone ? (
            <a href={`tel:${String(card.phone).replace(/\s/g, '')}`}>
              <IconPhone />
              <span>Call</span>
              <span className="bid-contact-value">{card.phone}</span>
            </a>
          ) : (
            <div className="bid-contact-tile is-disabled" aria-disabled="true">
              <IconPhone />
              <span>Call</span>
            </div>
          )}
          {card.email ? (
            <a href={`mailto:${card.email}`}>
              <IconMail />
              <span>Email</span>
              <span className="bid-contact-value">{card.email}</span>
            </a>
          ) : (
            <div className="bid-contact-tile is-disabled" aria-disabled="true">
              <IconMail />
              <span>Email</span>
            </div>
          )}
          <a href={websiteHref} target="_blank" rel="noreferrer">
            <IconWeb />
            <span>Website</span>
            {card.website ? (
              <span className="bid-contact-value">{card.website}</span>
            ) : null}
          </a>
          {locationHref ? (
            <a href={locationHref} target="_blank" rel="noreferrer">
              <IconPin />
              <span>Location</span>
              {locationQuery ? (
                <span className="bid-contact-value">{locationQuery}</span>
              ) : null}
            </a>
          ) : (
            <div className="bid-contact-tile is-disabled" aria-disabled="true">
              <IconPin />
              <span>Location</span>
            </div>
          )}
        </section>

        <section className="bid-stories">
          {storyBlocks.map((block) => (
            <div key={block.title} className="bid-story">
              <div className="bid-story-head">
                <h2>{block.title}</h2>
                <i />
              </div>
              <p className="bid-story-sub">{block.subtitle}</p>
              <div className="bid-story-card">
                <p>{block.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="bid-brochure">
          <div className="bid-section-title">
            <i />
            <h2>Brochure</h2>
            <i />
          </div>
          <p className="bid-section-sub">Flip and see our work.</p>
          <div className="bid-brochure-stage">
            <img src={brochurePhoto} alt={`${restaurant} brochure`} />
            <button
              type="button"
              className="bid-brochure-nav prev"
              aria-label="Previous"
              onClick={() =>
                setBrochureIndex((i) => (i - 1 + media.length) % media.length)
              }
            >
              ‹
            </button>
            <button
              type="button"
              className="bid-brochure-nav next"
              aria-label="Next"
              onClick={() => setBrochureIndex((i) => (i + 1) % media.length)}
            >
              ›
            </button>
          </div>
        </section>

        <section className="bid-gallery">
          <div className="bid-section-title">
            <i />
            <h2>Media Gallery</h2>
            <i />
          </div>
          <p className="bid-section-sub">Our Pictures & Videos</p>
          <div className="bid-gallery-grid">
            {media.slice(0, 9).map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                className="bid-gallery-item"
                onClick={() => setBrochureIndex(index)}
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>

        <section className="bid-map">
          <div className="bid-lined-head">
            <h2>Map</h2>
            <i />
          </div>
          <p className="bid-section-sub">Visit us. Ample parking.</p>
          {locationQuery ? (
            <p className="bid-map-address">{locationQuery}</p>
          ) : (
            <p className="bid-map-address bid-map-address--empty">
              Add your full address, city, and country in restaurant setup to show the map.
            </p>
          )}
          {mapEmbed ? (
            <div className="bid-map-frame">
              <iframe
                title={`${restaurant} map`}
                src={mapEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <a
                className="bid-map-open"
                href={locationHref}
                target="_blank"
                rel="noreferrer"
              >
                Open in Maps
              </a>
            </div>
          ) : null}
        </section>

        <section className="bid-enquiry">
          <div className="bid-lined-head">
            <h2>Got a question?</h2>
            <i />
          </div>
          <p className="bid-section-sub">We will get you the answer. Fast.</p>

          {formSent ? (
            <p className="bid-enquiry-ok">Thanks — your message was sent.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setFormSent(true)
              }}
            >
              <Field label="Name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter your Fullname"
                />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Enter your email"
                />
              </Field>
              <Field label="Company">
                <input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Enter company name"
                />
              </Field>
              <Field label="Phone Number">
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Enter your phone number"
                />
              </Field>
              <div className="bid-field-row">
                <Field label="Service Date">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </Field>
                <Field label="Service Time">
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Details">
                <textarea
                  rows={4}
                  value={form.details}
                  onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                  placeholder="Enter your details here"
                />
              </Field>
              <button type="submit" className="bid-send">
                <IconEnvelope />
                Send Message
              </button>
            </form>
          )}
        </section>

        <footer className="bid-actions-bar">
          <Link
            className="bid-action dark"
            to={ROUTES.LOGIN}
            state={{ from: ROUTES.BUSINESS_ID, cardPath: location.pathname }}
          >
            <IconLogin />
            <span>Login</span>
          </Link>
          <Link className="bid-action peach" to={ROUTES.CREATE_ACCOUNT}>
            <IconCard />
            <span>Get my own card</span>
          </Link>
          <a className="bid-action dark" href="mailto:support@iroas.app">
            <IconSupport />
            <span>Support</span>
          </a>
        </footer>
        <p className="bid-powered">
          Powered by <strong>IROAS</strong>
        </p>
      </article>
    </div>
  )
}

export default GuestBusinessCard
