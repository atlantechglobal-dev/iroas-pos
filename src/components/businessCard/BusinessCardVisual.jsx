import './BusinessCardVisual.css'

export const CARD_LAYOUTS = [
  {
    id: 'split-gold',
    label: 'Gold split',
    hint: 'Yellow panel + food photo',
  },
  {
    id: 'photo-dark',
    label: 'Photo dark',
    hint: 'Food left, charcoal info',
  },
  {
    id: 'noir-orange',
    label: 'Noir orange',
    hint: 'Dark + orange accents',
  },
]

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"
      />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
      />
    </svg>
  )
}

function IconWeb() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-3.2a15 15 0 00-1.3-3.3A8 8 0 0118.9 8zM12 4c.8 1.2 1.5 2.9 1.9 4H10c.4-1.1 1.1-2.8 2-4zM4.3 14a8 8 0 010-4h3.5a17 17 0 000 4H4.3zM8.1 16h3.2c.4 1.1 1.1 2.8 2 4a8 8 0 01-5.2-4zm3.2-8H8.1A8 8 0 0112 4c.9 1.2 1.6 2.9 2 4H11.3zm1.4 2h3.5a17 17 0 010 4h-3.5a17 17 0 010-4zm.6 10c-.9-1.2-1.6-2.9-2-4h3.2a8 8 0 01-1.2 4zm5.2-4h3.5a8 8 0 010-4h-3.5a17 17 0 000 4zM5.1 8h3.2A15 15 0 019.6 4.7 8 8 0 005.1 8zM14.4 19.3A15 15 0 0015.7 16h3.2a8 8 0 01-4.5 3.3z"
      />
    </svg>
  )
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z"
      />
    </svg>
  )
}

function IconInsta() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.9a1.1 1.1 0 11-2.2 0 1.1 1.1 0 012.2 0zM12 9a3 3 0 110 6 3 3 0 010-6z"
      />
    </svg>
  )
}

function contactRows(card) {
  return [
    card.phone && { key: 'phone', Icon: IconPhone, value: card.phone, href: `tel:${String(card.phone).replace(/\s/g, '')}` },
    card.email && { key: 'email', Icon: IconMail, value: card.email, href: `mailto:${card.email}` },
    card.website && {
      key: 'website',
      Icon: IconWeb,
      value: card.website,
      href: /^https?:/i.test(card.website) ? card.website : `https://${card.website}`,
    },
    card.insta && {
      key: 'insta',
      Icon: IconInsta,
      value: card.insta,
      href: `https://instagram.com/${String(card.insta).replace(/^@/, '')}`,
    },
    card.address && {
      key: 'address',
      Icon: IconPin,
      value: card.address,
      href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}`,
    },
  ].filter(Boolean)
}

function ContactList({ card, interactive, align = 'left' }) {
  const rows = contactRows(card)
  if (rows.length === 0) {
    return <p className="bcv-empty">Add contact details to fill this card.</p>
  }

  return (
    <ul className={`bcv-contacts align-${align}`}>
      {rows.map((row) => {
        const inner = (
          <>
            <span className="bcv-ico">
              <row.Icon />
            </span>
            <span className="bcv-val">{row.value}</span>
          </>
        )
        return (
          <li key={row.key}>
            {interactive ? (
              <a href={row.href} target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <div className="bcv-row-static">{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function LogoMark({ logoDataUrl, name }) {
  if (logoDataUrl) {
    return <img className="bcv-logo-img" src={logoDataUrl} alt="" />
  }
  const initials = String(name || 'R')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return <div className="bcv-logo-fallback">{initials || 'R'}</div>
}

function HeroSurface({ heroDataUrl, className = '' }) {
  return (
    <div
      className={`bcv-hero ${className}`}
      style={
        heroDataUrl
          ? { backgroundImage: `url(${heroDataUrl})` }
          : undefined
      }
    />
  )
}

function SplitGoldCard({ displayRestaurant, card, interactive }) {
  return (
    <div className="bcv-inner layout-split-gold">
      <div className="bcv-panel bcv-info">
        <div className="bcv-identity">
          <h2 className="bcv-name">{card.name || 'Your name'}</h2>
          <p className="bcv-role">{card.role || 'Owner'}</p>
        </div>
        <ContactList card={card} interactive={interactive} />
      </div>
      <div className="bcv-diagonal" aria-hidden="true" />
      <div className="bcv-panel bcv-photo-side">
        <HeroSurface heroDataUrl={card.heroDataUrl} />
        <div className="bcv-brand-corner">
          <LogoMark logoDataUrl={card.logoDataUrl} name={displayRestaurant} />
          <span className="bcv-brand-name">{displayRestaurant}</span>
        </div>
      </div>
      <div
        className="bcv-circle"
        style={
          card.circleDataUrl
            ? { backgroundImage: `url(${card.circleDataUrl})` }
            : card.heroDataUrl
              ? { backgroundImage: `url(${card.heroDataUrl})` }
              : undefined
        }
        aria-hidden="true"
      />
    </div>
  )
}

function PhotoDarkCard({ displayRestaurant, card, interactive }) {
  return (
    <div className="bcv-inner layout-photo-dark">
      <span className="bcv-corner tl" aria-hidden="true" />
      <span className="bcv-corner br" aria-hidden="true" />
      <div className="bcv-panel bcv-photo-side">
        <HeroSurface heroDataUrl={card.heroDataUrl} />
        <div className="bcv-torn" aria-hidden="true" />
      </div>
      <div className="bcv-panel bcv-info">
        <div className="bcv-brand-block">
          <LogoMark logoDataUrl={card.logoDataUrl} name={displayRestaurant} />
          <h2 className="bcv-store">{displayRestaurant}</h2>
          <p className="bcv-tagline">{card.tagline || 'Tagline goes here'}</p>
        </div>
        <ContactList card={card} interactive={interactive} align="right" />
      </div>
    </div>
  )
}

function NoirOrangeCard({ displayRestaurant, card, interactive }) {
  const instaHref = card.insta
    ? `https://instagram.com/${String(card.insta).replace(/^@/, '')}`
    : null

  return (
    <div className="bcv-inner layout-noir-orange">
      <div className="bcv-panel bcv-info">
        <div className="bcv-brand-row">
          <LogoMark logoDataUrl={card.logoDataUrl} name={displayRestaurant} />
          <div>
            <h2 className="bcv-store">{displayRestaurant}</h2>
            <p className="bcv-tagline">{card.tagline || card.role || 'Guest service'}</p>
          </div>
        </div>
        <p className="bcv-service-title">{card.name || 'Customer service'}</p>
        <ContactList card={card} interactive={interactive} />
        <div className="bcv-social">
          {instaHref ? (
            interactive ? (
              <a className="bcv-social-dot" href={instaHref} target="_blank" rel="noreferrer" aria-label="Instagram">
                <IconInsta />
              </a>
            ) : (
              <span className="bcv-social-dot" aria-hidden="true">
                <IconInsta />
              </span>
            )
          ) : (
            <span className="bcv-social-dot muted" aria-hidden="true">
              <IconInsta />
            </span>
          )}
          <span className="bcv-social-dot muted" aria-hidden="true">
            <IconWeb />
          </span>
          <span className="bcv-social-dot muted" aria-hidden="true">
            <IconMail />
          </span>
          <span className="bcv-social-dot muted" aria-hidden="true">
            <IconPhone />
          </span>
        </div>
      </div>
      <div className="bcv-panel bcv-photo-side">
        <div className="bcv-wave" aria-hidden="true" />
        <HeroSurface heroDataUrl={card.heroDataUrl} />
        {card.circleDataUrl ? (
          <div
            className="bcv-circle sm"
            style={{ backgroundImage: `url(${card.circleDataUrl})` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  )
}

/**
 * Landscape restaurant business card visual shared by editor + guest pages.
 */
export function BusinessCardVisual({
  layout = 'split-gold',
  theme = 'lime',
  colors,
  displayRestaurant = 'Your restaurant',
  card = {},
  interactive = false,
}) {
  const layoutId = CARD_LAYOUTS.some((l) => l.id === layout) ? layout : 'split-gold'

  return (
    <div
      className={`bcv-card layout-${layoutId} theme-${theme}`}
      style={{
        '--card-accent': colors?.accent,
        '--card-accent-dark': colors?.dark,
        '--card-header-text': colors?.headerText,
        '--card-panel': colors?.panel,
        '--card-ink': colors?.ink,
        '--card-muted': colors?.muted,
        '--card-hot': colors?.hot,
      }}
    >
      {layoutId === 'split-gold' ? (
        <SplitGoldCard displayRestaurant={displayRestaurant} card={card} interactive={interactive} />
      ) : null}
      {layoutId === 'photo-dark' ? (
        <PhotoDarkCard displayRestaurant={displayRestaurant} card={card} interactive={interactive} />
      ) : null}
      {layoutId === 'noir-orange' ? (
        <NoirOrangeCard displayRestaurant={displayRestaurant} card={card} interactive={interactive} />
      ) : null}
    </div>
  )
}
