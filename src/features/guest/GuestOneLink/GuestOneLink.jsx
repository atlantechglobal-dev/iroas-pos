import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/shared/lib/api'
import {
  GUEST_SITE_PAGES,
  ONE_LINK_THEMES,
  guestSitePath,
  withGuestDestinationHrefs,
} from '@/shared/utils/guestLinks'
import './GuestOneLink.css'

const PAGE_LINKS = [
  { key: 'menu', name: 'Digital Menu', meta: 'Live menu with prices', icon: '/images/menu.png' },
  { key: 'order', name: 'Order Online', meta: 'Takeaway and dine-in', icon: '/images/order online.png' },
  { key: 'book', name: 'Book a Table', meta: 'Live availability', icon: '/images/table book.png' },
]

function externalLinks(site) {
  const r = site?.restaurant || {}
  const social = r.socials || {}
  const web = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)
  return [
    r.phone && { key: 'call', name: 'Call Restaurant', meta: r.phone, href: `tel:${String(r.phone).replace(/\s/g, '')}`, icon: '/images/call.svg' },
    r.address && { key: 'directions', name: 'Directions', meta: r.address, href: `https://maps.google.com/?q=${encodeURIComponent(r.address)}`, icon: '/images/direction.svg' },
    social.googleReview && { key: 'review', name: 'Leave a Review', meta: 'Google reviews', href: web(social.googleReview), icon: '/images/review.svg' },
    social.instagram && {
      key: 'instagram',
      name: 'Instagram',
      meta: 'Social profile',
      href: /^https?:/i.test(social.instagram) ? social.instagram : `https://instagram.com/${String(social.instagram).replace(/^@/, '')}`,
      icon: '/images/instagram.svg',
    },
  ].filter(Boolean)
}

/** What the owner switched on in One Link; before they save anything, everything the restaurant has data for. */
function hubLinks(site, slug) {
  const saved = site?.oneLink?.destinations
  if (Array.isArray(saved) && saved.length) {
    return withGuestDestinationHrefs(slug, saved.filter((d) => d.live && d.key && d.key !== 'website' && d.href))
  }
  return withGuestDestinationHrefs(slug, [...PAGE_LINKS, ...externalLinks(site)])
}

function sendEvent(slug, body) {
  api.recordLinkEvent(slug, body).catch(() => {})
}

function GuestOneLink() {
  const { slug = '' } = useParams()
  const [site, setSite] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .getPublicSite(slug)
      .then((data) => {
        if (!alive) return
        setSite(data)
        sendEvent(slug, { kind: 'view' })
      })
      .catch((err) => alive && setError(err.message || 'This link is not available.'))
    return () => {
      alive = false
    }
  }, [slug])

  const links = useMemo(() => (site ? hubLinks(site, slug) : []), [site, slug])

  if (error) {
    return (
      <main className="guest-one-link">
        <div className="guest-one-link-shell">
          <p className="guest-empty" role="alert">{error}</p>
        </div>
      </main>
    )
  }
  if (!site) {
    return (
      <main className="guest-one-link">
        <div className="guest-one-link-shell">
          <p className="guest-empty">Loading…</p>
        </div>
      </main>
    )
  }

  const themeKey = ONE_LINK_THEMES[site.oneLink?.themeKey] ? site.oneLink.themeKey : 'lime'
  const theme = ONE_LINK_THEMES[themeKey]
  const accent = site.brand?.primaryColor || theme.accent
  const name = site.restaurant?.name || slug
  const style = {
    '--ol-accent': accent,
    '--ol-accent-dark': theme.accentDark,
    '--ol-screen': theme.screenBg,
    '--ol-text': theme.text,
    '--ol-muted': theme.muted,
    '--ol-btn-bg': theme.buttonBg,
    '--ol-btn-text': theme.buttonText,
  }

  const open = (link) => sendEvent(slug, { kind: 'click', key: link.key })

  return (
    <main className={`guest-one-link theme-${themeKey}`} style={style}>
      <div className="guest-one-link-shell">
        <header className="guest-one-link-header">
          {site.brand?.logoDataUrl ? (
            <img className="guest-avatar-img" src={site.brand.logoDataUrl} alt="" />
          ) : (
            <div className="guest-avatar">{name.charAt(0).toUpperCase()}</div>
          )}
          <h1>{site.oneLink?.headline || name}</h1>
          {site.oneLink?.subheadline ? <p className="guest-sub">{site.oneLink.subheadline}</p> : null}
        </header>

        <nav className="guest-links" aria-label={`${name} links`}>
          {links.map((link) => {
            const inner = (
              <>
                <span className="guest-link-icon">
                  <img src={link.icon} alt="" />
                </span>
                <span>{link.name}</span>
                <img className="guest-arrow" src="/images/arrow.svg" alt="" />
              </>
            )
            return GUEST_SITE_PAGES[link.key] ? (
              <Link key={link.key} className="guest-link" to={link.href} onClick={() => open(link)}>
                {inner}
              </Link>
            ) : (
              <a key={link.key} className="guest-link" href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" onClick={() => open(link)}>
                {inner}
              </a>
            )
          })}
          {links.length === 0 ? <p className="guest-empty">No links are available yet.</p> : null}
        </nav>

        <div className="guest-site-cta">
          <Link className="guest-site-btn" to={guestSitePath(slug, 'website')} onClick={() => open({ key: 'website' })}>
            Visit our website
          </Link>
        </div>
      </div>
    </main>
  )
}

export default GuestOneLink
