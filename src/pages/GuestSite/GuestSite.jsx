import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  GUEST_MENU_ITEMS,
  GUEST_SITE_PAGES,
  guestSitePath,
  oneLinkDisplayHost,
  resolveGuestSiteContext,
} from '../../utils/guestLinks.js'
import './GuestSite.css'

function formatPrice(n) {
  return `₹${n}`
}

function stars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function DishPhoto({ src, alt = '', className = '' }) {
  if (src) {
    return <img className={`gs-photo ${className}`.trim()} src={src} alt={alt} loading="lazy" />
  }
  return <div className={`gs-photo placeholder ${className}`.trim()} aria-hidden="true" />
}

function GalleryCarousel({ slides, variant = 'default' }) {
  const [index, setIndex] = useState(0)
  const count = slides.length
  const isHero = variant === 'hero'

  useEffect(() => {
    setIndex(0)
  }, [count])

  useEffect(() => {
    if (count < 2) return undefined
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [count])

  if (!count) return null

  const go = (dir) => {
    setIndex((i) => (i + dir + count) % count)
  }

  const current = slides[index]

  return (
    <div
      className={`gs-carousel${isHero ? ' gs-carousel-hero' : ''}`}
      aria-roledescription="carousel"
      aria-label="Gallery"
    >
      <div className="gs-carousel-stage">
        {slides.map((slide, i) => (
          <img
            key={slide.id || i}
            className={`gs-carousel-image${i === index ? ' is-active' : ''}`}
            src={slide.src}
            alt={slide.caption || `Gallery image ${i + 1}`}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ))}
        {!isHero && current.caption ? (
          <p className="gs-carousel-caption">{current.caption}</p>
        ) : null}
        {count > 1 ? (
          <>
            <button type="button" className="gs-carousel-nav prev" onClick={() => go(-1)} aria-label="Previous">
              ‹
            </button>
            <button type="button" className="gs-carousel-nav next" onClick={() => go(1)} aria-label="Next">
              ›
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="gs-carousel-dots" role="tablist" aria-label="Gallery slides">
          {slides.map((slide, i) => (
            <button
              key={slide.id || i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? 'active' : ''}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function GuestSite() {
  const { slug = 'your-link', page } = useParams()
  const activePage = page || 'home'
  const localCtx = useMemo(() => resolveGuestSiteContext(slug), [slug])

  const [site, setSite] = useState(null)
  const [menuFromApi, setMenuFromApi] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [cart, setCart] = useState([])
  const [orderNote, setOrderNote] = useState('')
  const [orderDone, setOrderDone] = useState(false)
  const [booking, setBooking] = useState({
    name: '',
    phone: '',
    guests: '2',
    date: '',
    time: '19:00',
    notes: '',
  })
  const [booked, setBooked] = useState(null)
  const [bookError, setBookError] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)

  useEffect(() => {
    const id = 'iroas-brand-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;600;700&family=Fraunces:wght@600;700&family=Outfit:wght@500;700&family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    Promise.allSettled([api.getPublicSite(slug), api.getPublicMenu(slug)]).then(([siteRes, menuRes]) => {
      if (cancelled) return
      if (siteRes.status === 'fulfilled') setSite(siteRes.value)
      else {
        setSite(null)
        setLoadError(true)
      }
      if (menuRes.status === 'fulfilled') {
        const groups = (menuRes.value.categories || [])
          .filter((c) => (c.items || []).length > 0)
          .map((c) => ({
            category: c.name,
            categoryImage: c.imageDataUrl || '',
            items: (c.items || []).map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              desc: item.desc || item.description || '',
              veg: item.veg,
              tag: item.tag || '',
              imageDataUrl: item.imageDataUrl || '',
              prepMinutes: item.prepMinutes,
            })),
          }))
        setMenuFromApi(groups.length ? groups : null)
      } else setMenuFromApi(null)
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  const restaurantName =
    site?.restaurant?.name || localCtx.restaurantName || slug.replace(/-/g, ' ')
  const brand = {
    primaryColor: site?.brand?.primaryColor || localCtx.brand.primaryColor,
    secondaryColor: site?.brand?.secondaryColor || localCtx.brand.secondaryColor,
    accentColor: site?.brand?.accentColor || localCtx.brand.accentColor,
    logoDataUrl: site?.brand?.logoDataUrl || localCtx.brand.logoDataUrl || '',
    coverDataUrl: site?.brand?.coverDataUrl || localCtx.brand.coverDataUrl || '',
    cuisine: site?.restaurant?.cuisine || localCtx.brand.cuisine || '',
    description: site?.restaurant?.description || localCtx.brand.description || '',
    phone: site?.restaurant?.phone || localCtx.brand.phone || '',
    address: site?.restaurant?.address || localCtx.brand.address || '',
    displayFont: site?.brand?.displayFont || localCtx.brand.displayFont || 'Playfair Display',
    bodyFont: site?.brand?.bodyFont || localCtx.brand.bodyFont || 'Plus Jakarta Sans',
    surfaceColor: site?.brand?.surfaceColor || localCtx.brand.surfaceColor || '',
  }
  const tagline =
    site?.restaurant?.tagline ||
    localCtx.subheadline ||
    'Order, book a table or browse our menu.'
  const headline = site?.restaurant?.name || localCtx.headline || restaurantName
  const reviews = site?.reviews || []
  const menuGroups = useMemo(() => {
    if (menuFromApi?.length) return menuFromApi
    if (site?.menu?.length) {
      return site.menu.map((c) => ({
        category: c.name,
        categoryImage: c.imageDataUrl || '',
        items: (c.items || []).map((item) => ({
          ...item,
          imageDataUrl: item.imageDataUrl || '',
        })),
      }))
    }
    return GUEST_MENU_ITEMS.map((g) => ({ ...g, categoryImage: '' }))
  }, [site, menuFromApi])

  const liveKeys = useMemo(() => {
    const fromApi = site?.oneLink?.destinations
    if (Array.isArray(fromApi) && fromApi.length) {
      const keys = new Set(
        fromApi.filter((d) => d.live && d.key && d.key !== 'website').map((d) => d.key),
      )
      keys.add('website')
      return keys
    }
    const keys = new Set(localCtx.liveKeys || [])
    keys.add('website')
    if (!keys.has('menu') && !keys.has('order') && !keys.has('book') && keys.size <= 1) {
      keys.add('menu')
      keys.add('order')
      keys.add('book')
    }
    return keys
  }, [site, localCtx.liveKeys])

  const orderedDestinations = useMemo(() => {
    const list = site?.oneLink?.destinations || localCtx.destinations || []
    return list.filter((d) => d.live && d.key && d.key !== 'website')
  }, [site, localCtx.destinations])

  /** Footer / contact links (review, instagram, directions, call, custom) — order follows One Link shuffle */
  const siteActionLinks = useMemo(() => {
    return orderedDestinations.filter((d) => {
      if (['menu', 'order', 'book'].includes(d.key)) return false
      if (GUEST_SITE_PAGES[d.key]) return false
      return Boolean(d.href)
    })
  }, [orderedDestinations])

  const showReviews = liveKeys.has('review') && reviews.length > 0
  const showFindUs =
    (liveKeys.has('directions') || liveKeys.has('call')) && (brand.phone || brand.address)
  const showBookTeaser = liveKeys.has('book')

  /** Home lower sections shuffled to match destination order */
  const homeTailOrder = useMemo(() => {
    const order = []
    const seen = new Set()
    const push = (id) => {
      if (seen.has(id)) return
      seen.add(id)
      order.push(id)
    }
    for (const d of orderedDestinations) {
      if (d.key === 'book') push('book')
      else if (d.key === 'review') push('review')
      else if (d.key === 'directions' || d.key === 'call') push('findus')
    }
    if (showBookTeaser) push('book')
    if (showReviews) push('review')
    if (showFindUs) push('findus')
    return order
  }, [orderedDestinations, showBookTeaser, showReviews, showFindUs])

  const theme = localCtx.theme

  const flatMenuItems = useMemo(
    () => menuGroups.flatMap((g) => g.items),
    [menuGroups],
  )
  const highlightItems = useMemo(() => {
    const withPhotos = flatMenuItems.filter((i) => i.imageDataUrl)
    const rest = flatMenuItems.filter((i) => !i.imageDataUrl)
    return [...withPhotos, ...rest].slice(0, 6)
  }, [flatMenuItems])

  const heroSlides = useMemo(() => {
    const slides = []
    const seen = new Set()
    const push = (src, caption, id) => {
      if (!src || seen.has(src)) return
      seen.add(src)
      slides.push({ id: id || `s-${slides.length}`, src, caption: caption || '' })
    }
    ;(site?.gallery || []).forEach((g, i) => push(g.dataUrl, g.caption, g.id || `g-${i}`))
    if (!slides.length) push(brand.coverDataUrl, '', 'cover')
    return slides
  }, [site?.gallery, brand.coverDataUrl])

  const inkIsLight = (() => {
    const hex = String(brand.accentColor || '').replace('#', '')
    if (hex.length !== 6) return false
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 160
  })()

  const cssVars = {
    '--gs-primary': brand.primaryColor,
    '--gs-secondary': brand.secondaryColor,
    '--gs-accent': brand.accentColor,
    '--gs-text': inkIsLight ? '#17171a' : brand.accentColor || theme.text,
    '--gs-muted': theme.muted,
    '--gs-bg': brand.surfaceColor || theme.screenBg || '#f4f1ec',
    '--gs-panel': '#ffffff',
    '--gs-display': `"${brand.displayFont}", "Playfair Display", serif`,
    '--gs-body': `"${brand.bodyFont}", "Plus Jakarta Sans", sans-serif`,
  }

  const navItems = [
    { to: guestSitePath(slug, 'website'), label: 'Home', end: true },
    liveKeys.has('menu') && { to: guestSitePath(slug, 'menu'), label: 'Menu' },
    liveKeys.has('order') && { to: guestSitePath(slug, 'order'), label: 'Order' },
    liveKeys.has('book') && { to: guestSitePath(slug, 'book'), label: 'Book' },
  ].filter(Boolean)

  const addToCart = (item) => {
    setOrderDone(false)
    setCart((prev) => {
      const key = item.id || item.name
      const existing = prev.find((p) => (p.id || p.name) === key)
      if (existing) {
        return prev.map((p) =>
          (p.id || p.name) === key ? { ...p, qty: p.qty + 1 } : p,
        )
      }
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)

  const placeOrder = (event) => {
    event.preventDefault()
    if (!cart.length) return
    setOrderDone(true)
    setCart([])
    setOrderNote('')
  }

  const submitBooking = async (event) => {
    event.preventDefault()
    setBookError('')
    setBookingBusy(true)
    try {
      const { reservation } = await api.createPublicReservation(slug, {
        name: booking.name,
        phone: booking.phone,
        guests: booking.guests,
        date: booking.date,
        time: booking.time,
        notes: booking.notes,
      })
      setBooked(reservation)
    } catch (err) {
      setBookError(err.message || 'Unable to request reservation. Try again.')
    } finally {
      setBookingBusy(false)
    }
  }

  const logo = brand.logoDataUrl ? (
    <img src={brand.logoDataUrl} alt="" className="gs-logo-img" />
  ) : (
    <span className="gs-logo-mark">{String(restaurantName).charAt(0).toUpperCase()}</span>
  )

  return (
    <div className={`guest-site theme-${theme.key} neuma`} style={cssVars}>
      <header className="gs-top">
        <div className="gs-brand">
          {logo}
          <div>
            <strong>{restaurantName}</strong>
            <span>{oneLinkDisplayHost(slug)}</span>
          </div>
        </div>
        <nav className="gs-nav" aria-label="Site">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={Boolean(item.end)}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {activePage === 'home' || activePage === 'website' ? (
        <section className="gs-hero-neuma">
          <div className={`gs-hero-bleed${heroSlides.length ? ' has-carousel' : ''}`}>
            {heroSlides.length > 0 ? (
              <GalleryCarousel slides={heroSlides} variant="hero" />
            ) : null}
            <div className="gs-hero-veil">
              <p className="gs-eyebrow">{brand.cuisine || 'The restaurant'}</p>
              <h1>{headline}</h1>
              <p className="gs-lead">{tagline}</p>
              <div className="gs-cta-row">
                {liveKeys.has('menu') ? (
                  <Link className="gs-btn primary" to={guestSitePath(slug, 'menu')}>
                    View menu
                  </Link>
                ) : null}
                {liveKeys.has('order') ? (
                  <Link className="gs-btn secondary" to={guestSitePath(slug, 'order')}>
                    Order online
                  </Link>
                ) : null}
                {liveKeys.has('book') ? (
                  <Link className="gs-btn ghost" to={guestSitePath(slug, 'book')}>
                    Book a table
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <main className="gs-main">
        {activePage === 'home' || activePage === 'website' ? (
          <>
            <section className="gs-block">
              <p className="gs-kicker">The brand</p>
              <h2>Our story</h2>
              <p className="gs-story">
                {brand.description ||
                  (loadError
                    ? 'Welcome — explore the menu, book a table, or order online.'
                    : 'A place for good food, warm people and lasting evenings.')}
              </p>
            </section>

            {liveKeys.has('menu') && highlightItems.length > 0 ? (
              <section className="gs-block">
                <div className="gs-block-head">
                  <div>
                    <p className="gs-kicker">Menus</p>
                    <h2>Favourites</h2>
                  </div>
                  <Link className="gs-text-link" to={guestSitePath(slug, 'menu')}>
                    Full menu →
                  </Link>
                </div>
                <div className="gs-highlight-grid">
                  {highlightItems.map((item) => (
                    <article className="gs-highlight-card" key={item.id || item.name}>
                      <DishPhoto src={item.imageDataUrl} alt={item.name} className="gs-highlight-photo" />
                      <div className="gs-highlight-copy">
                        <strong>{item.name}</strong>
                        <span>{item.desc}</span>
                        <b>{formatPrice(item.price)}</b>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {homeTailOrder.map((sectionId) => {
              if (sectionId === 'book' && showBookTeaser) {
                return (
                  <section className="gs-block gs-book-teaser" key="book">
                    <div>
                      <p className="gs-kicker">Reservations</p>
                      <h2>Book your table</h2>
                      <p>Reserve a spot for dinner, celebrations or a quiet lunch.</p>
                    </div>
                    <Link className="gs-btn primary" to={guestSitePath(slug, 'book')}>
                      Book a table
                    </Link>
                  </section>
                )
              }
              if (sectionId === 'review' && showReviews) {
                return (
                  <section className="gs-block" key="review">
                    <div className="gs-block-head">
                      <div>
                        <p className="gs-kicker">Guests</p>
                        <h2>What people say</h2>
                      </div>
                      {orderedDestinations.find((d) => d.key === 'review' && d.href) ? (
                        <a
                          className="gs-text-link"
                          href={orderedDestinations.find((d) => d.key === 'review')?.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Leave a review →
                        </a>
                      ) : null}
                    </div>
                    <div className="gs-review-grid">
                      {reviews.map((r) => (
                        <blockquote className="gs-review-card" key={r.id}>
                          <div className="gs-stars" aria-label={`${r.rating} stars`}>
                            {stars(r.rating)}
                          </div>
                          <p>{r.body}</p>
                          <cite>{r.author}</cite>
                        </blockquote>
                      ))}
                    </div>
                  </section>
                )
              }
              if (sectionId === 'findus' && showFindUs) {
                return (
                  <section className="gs-block gs-contact-block" key="findus">
                    <p className="gs-kicker">Visit</p>
                    <h2>Find us</h2>
                    {liveKeys.has('directions') && brand.address ? <p>{brand.address}</p> : null}
                    {liveKeys.has('call') && brand.phone ? (
                      <a className="gs-text-link" href={`tel:${String(brand.phone).replace(/\s/g, '')}`}>
                        Call · {brand.phone}
                      </a>
                    ) : null}
                    {liveKeys.has('directions') && brand.address ? (
                      <a
                        className="gs-text-link"
                        href={`https://maps.google.com/?q=${encodeURIComponent(brand.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get directions →
                      </a>
                    ) : null}
                  </section>
                )
              }
              return null
            })}
          </>
        ) : null}

        {activePage === 'menu' ? (
          <section className="gs-section">
            <div className="gs-section-head">
              <p className="gs-kicker">Menus</p>
              <h2>Digital menu</h2>
              <p>Live dishes and prices for {restaurantName}.</p>
            </div>
            {menuGroups.map((group) => (
              <div className="gs-menu-group" key={group.category}>
                <div className="gs-menu-group-head">
                  {group.categoryImage ? (
                    <DishPhoto src={group.categoryImage} alt="" className="gs-menu-cat-photo" />
                  ) : null}
                  <h3>{group.category}</h3>
                </div>
                <div className="gs-menu-dish-grid">
                  {group.items.map((item) => (
                    <article className="gs-menu-dish" key={item.id || item.name}>
                      <DishPhoto src={item.imageDataUrl} alt={item.name} className="gs-menu-dish-photo" />
                      <div className="gs-menu-dish-body">
                        <div className="gs-menu-dish-top">
                          <strong>
                            {item.name}
                            {item.veg ? <em className="veg"> Veg</em> : null}
                            {item.tag ? <em className="tag"> {item.tag}</em> : null}
                          </strong>
                          <b>{formatPrice(item.price)}</b>
                        </div>
                        {item.desc ? <p>{item.desc}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
            {liveKeys.has('order') ? (
              <Link className="gs-btn primary" to={guestSitePath(slug, 'order')}>
                Order from this menu
              </Link>
            ) : null}
          </section>
        ) : null}

        {activePage === 'order' ? (
          <section className="gs-section gs-order">
            <div className="gs-section-head">
              <p className="gs-kicker">Order</p>
              <h2>Order online</h2>
              <p>Preview checkout — cart uses your live menu.</p>
            </div>

            <div className="gs-order-grid">
              <div className="gs-order-menu">
                {flatMenuItems.map((item) => (
                  <button
                    key={item.id || item.name}
                    type="button"
                    className="gs-order-item"
                    onClick={() => addToCart(item)}
                  >
                    <DishPhoto src={item.imageDataUrl} alt="" className="gs-order-thumb" />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.desc}</span>
                    </div>
                    <span className="gs-price-add">
                      {formatPrice(item.price)}
                      <em>+ Add</em>
                    </span>
                  </button>
                ))}
              </div>

              <aside className="gs-cart">
                <h3>Your bag</h3>
                {orderDone ? (
                  <p className="gs-success">Order placed — we&apos;ll confirm shortly.</p>
                ) : null}
                {cart.length === 0 && !orderDone ? (
                  <p className="gs-muted">Tap dishes to add them.</p>
                ) : null}
                <ul>
                  {cart.map((item) => (
                    <li key={item.id || item.name}>
                      <span>
                        {item.qty}× {item.name}
                      </span>
                      <b>{formatPrice(item.price * item.qty)}</b>
                    </li>
                  ))}
                </ul>
                <form onSubmit={placeOrder}>
                  <label htmlFor="order-note">Note</label>
                  <textarea
                    id="order-note"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Allergies, cutlery, delivery notes"
                    rows={3}
                  />
                  <div className="gs-cart-total">
                    <span>Total</span>
                    <strong>{formatPrice(cartTotal)}</strong>
                  </div>
                  <button className="gs-btn primary" type="submit" disabled={!cart.length}>
                    Place order
                  </button>
                </form>
              </aside>
            </div>
          </section>
        ) : null}

        {activePage === 'book' ? (
          <section className="gs-section">
            <div className="gs-section-head">
              <p className="gs-kicker">Reservations</p>
              <h2>Book a table</h2>
              <p>Reserve a spot at {restaurantName}.</p>
            </div>

            {booked ? (
              <div className="gs-success-card">
                <h3>Reservation requested</h3>
                <p>
                  Thanks {booked.guestName || booking.name} — we&apos;ll hold a table for{' '}
                  {booked.guests} on {booked.date} at {booked.time}. Status:{' '}
                  <strong>{booked.status}</strong>.
                </p>
                <button
                  type="button"
                  className="gs-btn secondary"
                  onClick={() => {
                    setBooked(null)
                    setBooking((b) => ({ ...b, notes: '' }))
                  }}
                >
                  Make another booking
                </button>
              </div>
            ) : (
              <form className="gs-book-form" onSubmit={submitBooking}>
                {bookError ? <p className="gs-form-error">{bookError}</p> : null}
                <label>
                  Name
                  <input
                    required
                    value={booking.name}
                    onChange={(e) => setBooking((b) => ({ ...b, name: e.target.value }))}
                  />
                </label>
                <label>
                  Phone
                  <input
                    required
                    value={booking.phone}
                    onChange={(e) => setBooking((b) => ({ ...b, phone: e.target.value }))}
                  />
                </label>
                <label>
                  Guests
                  <select
                    value={booking.guests}
                    onChange={(e) => setBooking((b) => ({ ...b, guests: e.target.value }))}
                  >
                    {['1', '2', '3', '4', '5', '6', '8', '10'].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    required
                    value={booking.date}
                    onChange={(e) => setBooking((b) => ({ ...b, date: e.target.value }))}
                  />
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    required
                    value={booking.time}
                    onChange={(e) => setBooking((b) => ({ ...b, time: e.target.value }))}
                  />
                </label>
                <label className="full">
                  Notes
                  <input
                    value={booking.notes}
                    onChange={(e) => setBooking((b) => ({ ...b, notes: e.target.value }))}
                    placeholder="Occasion, seating preference…"
                  />
                </label>
                <button className="gs-btn primary" type="submit" disabled={bookingBusy}>
                  {bookingBusy ? 'Sending…' : 'Request reservation'}
                </button>
              </form>
            )}
          </section>
        ) : null}
      </main>

      <footer className="gs-footer">
        {siteActionLinks.length > 0 ? (
          <div className="gs-extra-links">
            {siteActionLinks.map((d) => (
              <a
                key={d.key}
                className="gs-text-link"
                href={d.href}
                target={
                  String(d.href).startsWith('http') || String(d.href).startsWith('//')
                    ? '_blank'
                    : undefined
                }
                rel={
                  String(d.href).startsWith('http') || String(d.href).startsWith('//')
                    ? 'noopener noreferrer'
                    : undefined
                }
              >
                {d.name}
              </a>
            ))}
          </div>
        ) : null}
        <span>Powered by IROAS · Guest website</span>
        <div className="gs-footer-links">
          <Link to="/one-link">Editor</Link>
        </div>
      </footer>
    </div>
  )
}

export default GuestSite
