import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/shared/lib/api'
import {
  GUEST_SITE_PAGES,
  ONE_LINK_THEMES,
  guestSitePath,
  oneLinkPublicUrl,
  withGuestDestinationHrefs,
} from '@/shared/utils/guestLinks'
import { buildVCard, downloadVCard, mapsHref, telHref, whatsappHref } from '@/shared/utils/contactLinks'
import { QrCodePreview, downloadQrPng } from '@/shared/ui/QrCodePreview'
import { Icon } from '@/features/guest/GuestOneLink/OneLinkIcons'
import { hubLinks } from '@/features/guest/GuestOneLink/hubLinks'
import './GuestOneLink.css'
import './OneLinkHub.css'

const TABS = [
  { key: 'enquire', label: 'Enquire', icon: 'mail' },
  { key: 'find', label: 'Find us', icon: 'pin' },
  { key: 'share', label: 'Share', icon: 'qr' },
]

function sendEvent(slug, body) {
  api.recordLinkEvent(slug, body).catch(() => {})
}

function EnquiryForm({ slug, onSent }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '', website: '' })
  const [state, setState] = useState({ busy: false, error: '', sent: false })
  const set = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setState({ busy: true, error: '', sent: false })
    try {
      await api.sendEnquiry(slug, form)
      setState({ busy: false, error: '', sent: true })
      setForm({ name: '', phone: '', email: '', message: '', website: '' })
      onSent?.()
    } catch (err) {
      setState({ busy: false, error: err.message || 'Could not send your message.', sent: false })
    }
  }

  if (state.sent) {
    return (
      <div className="gol-sent" role="status">
        <strong>Message sent</strong>
        <p>Thank you. The restaurant will get back to you soon.</p>
        <button type="button" className="gol-ghost" onClick={() => setState({ busy: false, error: '', sent: false })}>
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form className="gol-form" onSubmit={submit}>
      <label>
        Your name
        <input required maxLength={80} value={form.name} onChange={set('name')} autoComplete="name" />
      </label>
      <div className="gol-form-row">
        <label>
          Phone
          <input type="tel" maxLength={30} value={form.phone} onChange={set('phone')} autoComplete="tel" />
        </label>
        <label>
          Email
          <input type="email" maxLength={120} value={form.email} onChange={set('email')} autoComplete="email" />
        </label>
      </div>
      <label>
        Message
        <textarea required rows={4} maxLength={1000} value={form.message} onChange={set('message')} />
      </label>
      <input className="gol-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} />
      {state.error ? (
        <p className="gol-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="gol-primary" disabled={state.busy}>
        {state.busy ? 'Sending…' : 'Send message'}
      </button>
      <small className="gol-hint">Add a phone number or an email so the restaurant can reply.</small>
    </form>
  )
}

function FindUs({ restaurant }) {
  const address = [restaurant.address, restaurant.city, restaurant.country].filter(Boolean).join(', ')
  const hours = (Array.isArray(restaurant.hours) ? restaurant.hours : []).filter((d) => d?.day)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const maps = mapsHref(address)
  return (
    <div className="gol-find">
      {address ? <p className="gol-address">{address}</p> : <p className="gol-hint">The restaurant has not added an address yet.</p>}
      {maps ? (
        <a className="gol-primary" href={maps} target="_blank" rel="noopener noreferrer">
          Open in Maps
        </a>
      ) : null}
      {hours.length ? (
        <ul className="gol-hours" aria-label="Opening hours">
          {hours.map((d) => (
            <li key={d.day} className={d.day === today ? 'is-today' : ''}>
              <span>{d.day}</span>
              <span>{d.closed ? 'Closed' : `${d.open} – ${d.close}`}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function SharePanel({ slug, site, shareUrl }) {
  const [copied, setCopied] = useState(false)
  const r = site.restaurant || {}

  const saveContact = () => {
    downloadVCard(
      buildVCard({
        name: r.name,
        tagline: r.tagline,
        phone: r.phone,
        email: r.email,
        website: r.website ? (/^https?:\/\//i.test(r.website) ? r.website : `https://${r.website}`) : '',
        pageUrl: shareUrl,
        street: r.address,
        city: r.city,
        country: r.country,
      }),
      `${slug}.vcf`,
    )
    sendEvent(slug, { kind: 'click', key: 'save-contact' })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', shareUrl)
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: r.name, text: r.tagline || r.name, url: shareUrl })
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="gol-share">
      <QrCodePreview value={shareUrl} size={176} alt={`QR code for ${r.name || slug}`} />
      <p className="gol-hint">Scan to open this page on another phone.</p>
      <div className="gol-share-actions">
        <button type="button" className="gol-primary" onClick={saveContact}>
          <Icon name="user" /> Save contact
        </button>
        <button type="button" className="gol-ghost" onClick={copy}>
          <Icon name="copy" /> {copied ? 'Copied' : 'Copy link'}
        </button>
        {typeof navigator !== 'undefined' && navigator.share ? (
          <button type="button" className="gol-ghost" onClick={share}>
            <Icon name="share" /> Share
          </button>
        ) : null}
        <button type="button" className="gol-ghost" onClick={() => downloadQrPng(shareUrl, `${slug}-qr.png`, { width: 512 })}>
          <Icon name="download" /> Download QR
        </button>
      </div>
    </div>
  )
}

function GuestOneLink() {
  const { slug = '' } = useParams()
  const [site, setSite] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('enquire')

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

  const links = useMemo(() => (site ? withGuestDestinationHrefs(slug, hubLinks(site, slug)) : []), [site, slug])

  if (error || !site) {
    return (
      <main className="guest-one-link">
        <div className="guest-one-link-shell">
          <p className="guest-empty" role={error ? 'alert' : undefined}>
            {error || 'Loading…'}
          </p>
        </div>
      </main>
    )
  }

  const r = site.restaurant || {}
  const themeKey = ONE_LINK_THEMES[site.oneLink?.themeKey] ? site.oneLink.themeKey : 'lime'
  const theme = ONE_LINK_THEMES[themeKey]
  const accent = site.brand?.primaryColor || theme.accent
  const name = r.name || slug
  const shareUrl = oneLinkPublicUrl(slug)
  const style = {
    '--ol-accent': accent,
    '--ol-accent-dark': theme.accentDark,
    '--ol-screen': theme.screenBg,
    '--ol-text': theme.text,
    '--ol-muted': theme.muted,
    '--ol-btn-bg': theme.buttonBg,
    '--ol-btn-text': theme.buttonText,
  }

  const quick = [
    r.phone && { key: 'call', label: 'Call', icon: 'phone', href: telHref(r.phone) },
    r.phone && whatsappHref(r.phone) && { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', href: whatsappHref(r.phone, `Hi ${name}!`), external: true },
    r.address && { key: 'directions', label: 'Directions', icon: 'pin', href: mapsHref([r.address, r.city].filter(Boolean).join(', ')), external: true },
  ].filter(Boolean)

  const social = r.socials || {}
  const webLink = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)
  const socialIcons = [
    r.phone && whatsappHref(r.phone) && { key: 'whatsapp', label: 'WhatsApp', href: whatsappHref(r.phone), icon: 'whatsapp' },
    social.facebook && { key: 'facebook', label: 'Facebook', href: /^https?:/i.test(social.facebook) ? social.facebook : `https://facebook.com/${social.facebook}`, icon: 'facebook' },
    social.instagram && { key: 'instagram', label: 'Instagram', href: /^https?:/i.test(social.instagram) ? social.instagram : `https://instagram.com/${String(social.instagram).replace(/^@/, '')}`, icon: 'instagram' },
    r.website && { key: 'website', label: 'Website', href: webLink(r.website), icon: 'globe' },
  ].filter(Boolean)

  const track = (key) => sendEvent(slug, { kind: 'click', key })

  return (
    <main className={`guest-one-link theme-${themeKey}`} style={style}>
      <div className="guest-one-link-shell">
        <header className="guest-one-link-header">
          {site.brand?.logoDataUrl ? (
            <img className="guest-avatar-img" src={site.brand.logoDataUrl} alt="" />
          ) : (
            <div className="guest-avatar">{name.charAt(0).toUpperCase()}</div>
          )}
          <h1>{name}</h1>
          {site.oneLink?.headline && site.oneLink.headline !== name ? <p className="guest-sub">{site.oneLink.headline}</p> : null}
          {site.oneLink?.subheadline && site.oneLink.subheadline !== site.oneLink.headline ? <p className="guest-sub">{site.oneLink.subheadline}</p> : null}
          {quick.length ? (
            <div className="gol-quick" role="group" aria-label="Get in touch">
              {quick.map((q) => (
                <a key={q.key} href={q.href} target={q.external ? '_blank' : undefined} rel="noopener noreferrer" onClick={() => track(q.key)}>
                  <Icon name={q.icon} />
                  <span>{q.label}</span>
                </a>
              ))}
            </div>
          ) : null}
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
              <Link key={link.key} className="guest-link" to={link.href} onClick={() => track(link.key)}>
                {inner}
              </Link>
            ) : (
              <a key={link.key} className="guest-link" href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" onClick={() => track(link.key)}>
                {inner}
              </a>
            )
          })}
          {links.length === 0 ? <p className="guest-empty">No links are available yet.</p> : null}
        </nav>

        {socialIcons.length ? (
          <div className="gol-social" aria-label="Social links">
            {socialIcons.map((s) => (
              <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} onClick={() => track(s.key)}>
                <Icon name={s.icon} />
              </a>
            ))}
          </div>
        ) : null}

        <section className="gol-tabs">
          <div className="gol-tablist" role="tablist" aria-label="More">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
                <Icon name={t.icon} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="gol-panel" role="tabpanel">
            {tab === 'enquire' ? <EnquiryForm slug={slug} onSent={() => track('enquiry')} /> : null}
            {tab === 'find' ? <FindUs restaurant={r} /> : null}
            {tab === 'share' ? <SharePanel slug={slug} site={site} shareUrl={shareUrl} /> : null}
          </div>
        </section>

        <div className="guest-site-cta">
          <Link className="guest-site-btn" to={guestSitePath(slug, 'website')} onClick={() => track('website')}>
            Visit our website
          </Link>
        </div>
        <p className="gol-powered">Powered by IROAS</p>
      </div>
    </main>
  )
}

export default GuestOneLink
