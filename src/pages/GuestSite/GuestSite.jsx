import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  GUEST_MENU_ITEMS,
  GUEST_SITE_PAGES,
  guestDishPath,
  guestSitePath,
  resolveGuestSiteContext,
} from '../../utils/guestLinks.js'
import './GuestSite.css'
import {
  GuestAccountPage,
  GuestBookPage,
  GuestCartPage,
  GuestCheckoutPage,
  GuestPlacedPage,
  GuestTrackingPage,
} from './GuestCommerce.jsx'

const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
]

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

function formatHoursSummary(hours) {
  if (!Array.isArray(hours) || !hours.length) return ''
  const openDays = hours.filter((h) => !h.closed && h.open && h.close)
  if (!openDays.length) return 'Hours coming soon'
  const first = openDays[0]
  const same = openDays.every((h) => h.open === first.open && h.close === first.close)
  const closed = hours.filter((h) => h.closed).map((h) => h.day)
  if (same) {
    const openLabels = openDays.map((h) => h.day)
    const openRange =
      openLabels.length > 1 ? `${openLabels[0]} – ${openLabels[openLabels.length - 1]}` : openLabels[0]
    const openPart = `${openRange}: ${first.open} – ${first.close}`
    if (closed.length) return `${openPart} · ${closed.join(', ')}: Closed`
    return openPart
  }
  return hours
    .map((h) => (h.closed ? `${h.day}: Closed` : `${h.day}: ${h.open} – ${h.close}`))
    .join(' · ')
}

function todayHoursLabel(hours) {
  if (!Array.isArray(hours) || !hours.length) return null
  const keys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const key = keys[new Date().getDay()]
  const row = hours.find((h) => String(h.day || '').slice(0, 3) === key)
  if (!row) return null
  if (row.closed) return 'Closed today'
  if (row.close) return `Open until ${row.close}`
  return 'Open today'
}

function dishModifiersFor(item) {
  if (item?.veg) {
    return [
      { id: 'extra-bread', name: 'Extra naan', price: 90 },
      { id: 'raita', name: 'House raita', price: 80 },
      { id: 'spicy', name: 'Extra spicy', price: 0 },
    ]
  }
  return [
    { id: 'extra-bread', name: 'Extra naan', price: 90 },
    { id: 'raita', name: 'House raita', price: 80 },
    { id: 'spicy', name: 'Extra spicy', price: 0 },
  ]
}

function GuestSite() {
  const { slug = 'your-link', page, itemId } = useParams()
  const activePage = itemId ? 'dish' : page || 'home'
  const localCtx = useMemo(() => resolveGuestSiteContext(slug), [slug])

  const [site, setSite] = useState(null)
  const [menuFromApi, setMenuFromApi] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [cart, setCart] = useState([])
  const [booking, setBooking] = useState({
    name: '',
    phone: '',
    guests: '2',
    date: '',
    time: '',
    notes: '',
  })
  const [booked, setBooked] = useState(null)
  const [bookError, setBookError] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)
  const [availSlots, setAvailSlots] = useState([])
  const [availMeta, setAvailMeta] = useState({ closed: false, reason: '', loading: false })
  const [menuSearch, setMenuSearch] = useState('')
  const [menuCategory, setMenuCategory] = useState('all')
  const [menuTag, setMenuTag] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [dishQty, setDishQty] = useState(1)
  const [dishMods, setDishMods] = useState(() => new Set())
  const [wishlist, setWishlist] = useState(() => new Set())
  const [serviceMode, setServiceMode] = useState('delivery')
  const [coupon, setCoupon] = useState('')
  const [lastOrder, setLastOrder] = useState(null)
  const [checkout, setCheckout] = useState({
    name: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    pincode: '',
    eta: 'ASAP',
    instructions: '',
    payment: 'upi',
    upiId: '',
  })

  useEffect(() => {
    const id = 'iroas-guest-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap'
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
              stockStatus: item.stockStatus || 'in_stock',
            })),
          }))
        setMenuFromApi(groups.length ? groups : null)
      } else setMenuFromApi(null)
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (activePage !== 'book' || !booking.date) {
      setAvailSlots([])
      setAvailMeta({ closed: false, reason: '', loading: false })
      return undefined
    }

    let cancelled = false
    setAvailMeta((prev) => ({ ...prev, loading: true }))
    api
      .getPublicAvailability(slug, { date: booking.date, guests: booking.guests })
      .then((data) => {
        if (cancelled) return
        setAvailSlots(data.slots || [])
        setAvailMeta({
          closed: Boolean(data.closed),
          reason: data.reason || '',
          loading: false,
        })
        setBooking((prev) => {
          if (!prev.time) return prev
          const stillOpen = (data.slots || []).some((s) => s.time === prev.time && !s.full)
          return stillOpen ? prev : { ...prev, time: '' }
        })
      })
      .catch((err) => {
        if (cancelled) return
        setAvailSlots([])
        setAvailMeta({
          closed: true,
          reason: err.message || 'Unable to load availability.',
          loading: false,
        })
      })

    return () => {
      cancelled = true
    }
  }, [slug, activePage, booking.date, booking.guests])

  const restaurantName =
    site?.restaurant?.name || localCtx.restaurantName || slug.replace(/-/g, ' ')
  const brand = {
    primaryColor: site?.brand?.primaryColor || localCtx.brand.primaryColor || '#F97316',
    secondaryColor: site?.brand?.secondaryColor || localCtx.brand.secondaryColor || '#FED7AA',
    accentColor: site?.brand?.accentColor || localCtx.brand.accentColor || '#111827',
    logoDataUrl: site?.brand?.logoDataUrl || localCtx.brand.logoDataUrl || '',
    coverDataUrl: site?.brand?.coverDataUrl || localCtx.brand.coverDataUrl || '',
    cuisine: site?.restaurant?.cuisine || localCtx.brand.cuisine || '',
    description: site?.restaurant?.description || localCtx.brand.description || '',
    phone: site?.restaurant?.phone || localCtx.brand.phone || '',
    email: site?.restaurant?.email || localCtx.brand.email || '',
    website: site?.restaurant?.website || localCtx.brand.website || '',
    address: site?.restaurant?.address || localCtx.brand.address || '',
    city: site?.restaurant?.city || '',
    country: site?.restaurant?.country || '',
    displayFont: site?.brand?.displayFont || 'Fraunces',
    bodyFont: site?.brand?.bodyFont || 'DM Sans',
    surfaceColor: site?.brand?.surfaceColor || localCtx.brand.surfaceColor || '',
  }
  const operatingHours = Array.isArray(site?.restaurant?.hours) ? site.restaurant.hours : []
  const yearEst = site?.restaurant?.yearEstablished || ''
  const tagline =
    site?.oneLink?.subheadline ||
    site?.restaurant?.tagline ||
    localCtx.subheadline ||
    brand.description ||
    'Thoughtful plates, warm service, and evenings worth lingering over.'
  const heroHeadline = (() => {
    const custom = String(site?.oneLink?.headline || '').trim()
    if (custom && custom.toLowerCase() !== String(restaurantName).toLowerCase()) return custom
    if (brand.cuisine) return `${brand.cuisine}, served slowly.`
    return `Welcome to ${restaurantName}.`
  })()
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
    if (loadError || !site) {
      return GUEST_MENU_ITEMS.map((g) => ({ ...g, categoryImage: '' }))
    }
    return []
  }, [site, menuFromApi, loadError])

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

  const siteActionLinks = useMemo(() => {
    return orderedDestinations.filter((d) => {
      if (['menu', 'order', 'book'].includes(d.key)) return false
      if (GUEST_SITE_PAGES[d.key]) return false
      return Boolean(d.href)
    })
  }, [orderedDestinations])

  const flatMenuItems = useMemo(
    () =>
      menuGroups.flatMap((g) =>
        g.items.map((item) => ({
          ...item,
          category: g.category,
        })),
      ),
    [menuGroups],
  )

  const selectedDish = useMemo(() => {
    if (!itemId) return null
    const decoded = decodeURIComponent(itemId)
    return (
      flatMenuItems.find((i) => String(i.id) === decoded) ||
      flatMenuItems.find((i) => String(i.name) === decoded) ||
      null
    )
  }, [flatMenuItems, itemId])

  const dishPhoto = useMemo(() => {
    if (!selectedDish) return ''
    if (selectedDish.imageDataUrl) return selectedDish.imageDataUrl
    const idx = Math.max(
      0,
      flatMenuItems.findIndex((i) => (i.id || i.name) === (selectedDish.id || selectedDish.name)),
    )
    return FALLBACK_PHOTOS[(idx + 1) % FALLBACK_PHOTOS.length]
  }, [selectedDish, flatMenuItems])

  const dishAddOns = useMemo(
    () => (selectedDish ? dishModifiersFor(selectedDish) : []),
    [selectedDish],
  )

  const dishExtrasTotal = useMemo(
    () => dishAddOns.filter((m) => dishMods.has(m.id)).reduce((sum, m) => sum + Number(m.price || 0), 0),
    [dishAddOns, dishMods],
  )

  const dishLineTotal = useMemo(() => {
    if (!selectedDish) return 0
    return ((Number(selectedDish.price) || 0) + dishExtrasTotal) * dishQty
  }, [selectedDish, dishExtrasTotal, dishQty])

  useEffect(() => {
    setDishQty(1)
    setDishMods(new Set())
  }, [itemId])

  const dishKey = selectedDish ? String(selectedDish.id || selectedDish.name) : ''
  const dishSaved = Boolean(dishKey && wishlist.has(dishKey))

  const filteredMenuItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase()
    return flatMenuItems.filter((item) => {
      if (menuCategory !== 'all' && item.category !== menuCategory) return false
      const tag = String(item.tag || '').toLowerCase()
      if (menuTag === 'veg' && !item.veg) return false
      if (menuTag === 'nonveg' && item.veg) return false
      if (menuTag === 'best' && !/best|seller|popular|favourite|favorite/.test(tag)) return false
      if (menuTag === 'chef' && !/chef|special/.test(tag)) return false
      if (!q) return true
      return (
        String(item.name || '')
          .toLowerCase()
          .includes(q) ||
        String(item.desc || '')
          .toLowerCase()
          .includes(q) ||
        String(item.category || '')
          .toLowerCase()
          .includes(q)
      )
    })
  }, [flatMenuItems, menuSearch, menuCategory, menuTag])

  const popularItems = useMemo(() => {
    const tagged = flatMenuItems.filter((i) => i.tag)
    const withPhotos = flatMenuItems.filter((i) => i.imageDataUrl)
    const rest = flatMenuItems.filter((i) => !i.imageDataUrl)
    return [...tagged, ...withPhotos, ...rest]
      .filter((item, idx, arr) => arr.findIndex((x) => (x.id || x.name) === (item.id || item.name)) === idx)
      .slice(0, 3)
  }, [flatMenuItems])

  const photoPool = useMemo(() => {
    const pool = []
    const seen = new Set()
    const push = (src) => {
      if (!src || seen.has(src)) return
      seen.add(src)
      pool.push(src)
    }
    ;(site?.gallery || []).forEach((g) => push(g.dataUrl))
    push(brand.coverDataUrl)
    flatMenuItems.forEach((i) => push(i.imageDataUrl))
    menuGroups.forEach((g) => push(g.categoryImage))
    FALLBACK_PHOTOS.forEach((src) => push(src))
    return pool
  }, [site?.gallery, brand.coverDataUrl, flatMenuItems, menuGroups])

  const heroTiles = photoPool.slice(0, 4)
  const bentoTiles = photoPool.slice(0, 5)
  const stripTiles = photoPool.slice(0, 6)

  const fullAddress = [brand.address, brand.city, brand.country].filter(Boolean).join(', ')
  const hoursSummary = formatHoursSummary(operatingHours)
  const openBadge = todayHoursLabel(operatingHours)
  const reviewHref = orderedDestinations.find((d) => d.key === 'review' && d.href)?.href

  const cssVars = {
    '--gs-primary': brand.primaryColor,
    '--gs-secondary': brand.secondaryColor,
    '--gs-accent': brand.accentColor || '#111827',
    '--gs-text': '#111827',
    '--gs-muted': '#6b7280',
    '--gs-bg': brand.surfaceColor || '#ffffff',
    '--gs-panel': '#ffffff',
    '--gs-soft': '#fff7ed',
    '--gs-line': '#f3f4f6',
    '--gs-display': '"Fraunces", Georgia, "Times New Roman", serif',
    '--gs-body': '"DM Sans", system-ui, sans-serif',
  }

  const navItems = [
    { to: guestSitePath(slug, 'website'), label: 'Home', end: true },
    liveKeys.has('menu') && { to: guestSitePath(slug, 'menu'), label: 'Menu' },
    liveKeys.has('book') && { to: guestSitePath(slug, 'book'), label: 'Book a table' },
    { to: guestSitePath(slug, 'account'), label: 'Account' },
  ].filter(Boolean)

  const cartCount = cart.reduce((n, i) => n + i.qty, 0)
  const brandMeta = [brand.cuisine, brand.city || brand.address].filter(Boolean).join(' · ')

  const dishBadge = (item) => {
    const tag = String(item.tag || '').toLowerCase()
    if (/best|seller|popular|favourite|favorite/.test(tag)) return { kind: 'best', label: 'Best seller' }
    if (/chef|special/.test(tag)) return { kind: 'chef', label: "Chef's" }
    if (item.tag) return { kind: 'tag', label: item.tag }
    return null
  }

  const addToCart = (item, qty = 1, extras = []) => {
    const extraTotal = extras.reduce((sum, m) => sum + Number(m.price || 0), 0)
    const extraNames = extras.map((m) => m.name).filter(Boolean)
    const lineName = extraNames.length ? `${item.name} · ${extraNames.join(', ')}` : item.name
    const linePrice = (Number(item.price) || 0) + extraTotal
    const key = `${item.id || item.name}|${extraNames.join('|')}`

    setCart((prev) => {
      const existing = prev.find((p) => p.lineKey === key)
      if (existing) {
        return prev.map((p) => (p.lineKey === key ? { ...p, qty: p.qty + qty } : p))
      }
      return [
        ...prev,
        {
          ...item,
          name: lineName,
          price: linePrice,
          qty,
          lineKey: key,
        },
      ]
    })
  }

  const toggleDishMod = (modId) => {
    setDishMods((prev) => {
      const next = new Set(prev)
      if (next.has(modId)) next.delete(modId)
      else next.add(modId)
      return next
    })
  }

  const addDishToCart = () => {
    if (!selectedDish || selectedDish.stockStatus === 'out') return
    const extras = dishAddOns.filter((m) => dishMods.has(m.id))
    addToCart(selectedDish, dishQty, extras)
  }

  const submitBooking = async (event) => {
    event.preventDefault()
    setBookError('')
    if (!booking.time) {
      setBookError('Please select an available time slot.')
      return
    }
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

  const isHome = activePage === 'home' || activePage === 'website'

  return (
    <div className="guest-site gs-marketing" style={cssVars}>
      <header className="gs-top">
        <Link className="gs-brand" to={guestSitePath(slug, 'website')}>
          {logo}
          <div className="gs-brand-copy">
            <strong>{restaurantName}</strong>
            {brandMeta ? <span>{brandMeta}</span> : null}
          </div>
        </Link>

        <nav className="gs-nav" aria-label="Site">
          {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={Boolean(item.end)}
                className={({ isActive }) => {
                  const onDishMenu = activePage === 'dish' && item.label === 'Menu'
                  return isActive || onDishMenu ? 'active' : undefined
                }}
              >
                {item.label}
              </NavLink>
          ))}
        </nav>

        <div className="gs-top-actions">
          {liveKeys.has('order') ? (
            <Link className="gs-cart-btn" to={guestSitePath(slug, 'order')}>
              <span className="gs-cart-ico" aria-hidden="true" />
              Cart
              {cartCount > 0 ? <em>{cartCount}</em> : null}
            </Link>
          ) : null}
          {liveKeys.has('order') ? (
            <Link className="gs-btn dark" to={guestSitePath(slug, 'order')}>
              Order now
            </Link>
          ) : liveKeys.has('book') ? (
            <Link className="gs-btn dark" to={guestSitePath(slug, 'book')}>
              Book a table
            </Link>
          ) : null}
        </div>
      </header>

      <main className="gs-main">
        {isHome ? (
          <>
            <section className="gs-hero-split">
              <div className="gs-hero-copy">
                {openBadge || yearEst ? (
                  <p className="gs-pill">
                    {openBadge || (yearEst ? `Est. since ${yearEst}` : null)}
                  </p>
                ) : (
                  <p className="gs-pill">{brand.cuisine || 'Restaurant'}</p>
                )}
                <h1>{heroHeadline}</h1>
                <p className="gs-lead">{tagline}</p>
                <div className="gs-cta-row">
                  {liveKeys.has('book') ? (
                    <Link className="gs-btn primary" to={guestSitePath(slug, 'book')}>
                      Book a table
                    </Link>
                  ) : null}
                  {liveKeys.has('menu') ? (
                    <Link className="gs-text-cta" to={guestSitePath(slug, 'menu')}>
                      View menu →
                    </Link>
                  ) : null}
                </div>
                {fullAddress ? (
                  <p className="gs-hero-meta">
                    <span className="gs-pin" aria-hidden="true" />
                    {fullAddress}
                  </p>
                ) : null}
              </div>
              <div className="gs-hero-mosaic" aria-hidden={!heroTiles.length}>
                {heroTiles.map((src, i) => (
                  <img key={`${src}-${i}`} src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
                ))}
              </div>
            </section>

            {liveKeys.has('menu') && menuGroups.length > 0 ? (
              <section className="gs-section-block">
                <div className="gs-section-row">
                  <h2>Built around the seasons</h2>
                  <Link className="gs-text-cta" to={guestSitePath(slug, 'menu')}>
                    View full menu →
                  </Link>
                </div>
                <div className="gs-cat-grid">
                  {menuGroups.slice(0, 6).map((group, index) => {
                    const img = group.categoryImage || group.items.find((i) => i.imageDataUrl)?.imageDataUrl || photoPool[index % photoPool.length]
                    return (
                      <Link
                        key={group.category}
                        className="gs-cat-card"
                        to={guestSitePath(slug, 'menu')}
                        style={{ backgroundImage: `url(${img})` }}
                      >
                        <span>
                          <strong>{group.category}</strong>
                          <em>
                            {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                          </em>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {liveKeys.has('menu') && popularItems.length > 0 ? (
              <section className="gs-section-block">
                <h2>What everyone&apos;s ordering</h2>
                <div className="gs-popular-grid">
                  {popularItems.map((item, index) => (
                    <article className="gs-popular-card" key={item.id || item.name}>
                      <Link
                        className="gs-popular-media"
                        to={guestDishPath(slug, item.id || item.name)}
                      >
                        <DishPhoto
                          src={item.imageDataUrl || photoPool[(index + 2) % photoPool.length]}
                          alt={item.name}
                        />
                        {item.tag || index === 0 ? (
                          <span className="gs-badge">{item.tag || 'Must try'}</span>
                        ) : null}
                      </Link>
                      <div className="gs-popular-body">
                        <div>
                          <Link to={guestDishPath(slug, item.id || item.name)}>
                            <strong>{item.name}</strong>
                          </Link>
                          <p>{item.desc || 'A guest favourite from our kitchen.'}</p>
                        </div>
                        <div className="gs-popular-foot">
                          <b>{formatPrice(item.price)}</b>
                          {liveKeys.has('order') ? (
                            <button
                              type="button"
                              className="gs-add"
                              onClick={() => addToCart(item)}
                              aria-label={`Add ${item.name}`}
                            >
                              +
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="gs-story-split">
              <div className="gs-story-copy">
                <h2>Cooked by hand, plated with care.</h2>
                <p>
                  {brand.description ||
                    (loadError
                      ? 'Welcome — explore the menu, book a table, or order online.'
                      : `${restaurantName} is built for unhurried evenings: fire, spice, and hospitality that feels personal.`)}
                </p>
                {stripTiles.length ? (
                  <a className="gs-btn dark" href="#gallery">
                    See gallery
                  </a>
                ) : null}
              </div>
              <div className="gs-bento">
                {bentoTiles.map((src, i) => (
                  <img key={`bento-${i}`} src={src} alt="" loading="lazy" />
                ))}
              </div>
            </section>

            {stripTiles.length ? (
              <section className="gs-section-block" id="gallery">
                <h2>A quiet evening, in pictures.</h2>
                <div className="gs-strip">
                  {stripTiles.map((src, i) => (
                    <img key={`strip-${i}`} src={src} alt="" loading="lazy" />
                  ))}
                </div>
              </section>
            ) : null}

            {reviews.length > 0 ? (
              <section className="gs-section-block" id="reviews">
                <div className="gs-section-row">
                  <h2>What people say</h2>
                  {reviewHref ? (
                    <a className="gs-text-cta" href={reviewHref} target="_blank" rel="noopener noreferrer">
                      Leave a review →
                    </a>
                  ) : null}
                </div>
                <div className="gs-review-grid">
                  {reviews.slice(0, 3).map((r) => (
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
            ) : null}

            <section className="gs-hello" id="contact">
              <div>
                <h2>Come say hello.</h2>
                <p>
                  Walk in for a spontaneous meal, or book ahead when you want the quieter corner of
                  the room.
                </p>
              </div>
              <ul className="gs-hello-list">
                {fullAddress ? (
                  <li>
                    <span className="gs-ico pin" aria-hidden="true" />
                    <div>
                      <strong>Location</strong>
                      <p>{fullAddress}</p>
                    </div>
                  </li>
                ) : null}
                {brand.phone ? (
                  <li>
                    <span className="gs-ico phone" aria-hidden="true" />
                    <div>
                      <strong>Phone</strong>
                      <p>
                        <a href={`tel:${String(brand.phone).replace(/\s/g, '')}`}>{brand.phone}</a>
                      </p>
                    </div>
                  </li>
                ) : null}
                {hoursSummary ? (
                  <li>
                    <span className="gs-ico clock" aria-hidden="true" />
                    <div>
                      <strong>Hours</strong>
                      <p>{hoursSummary}</p>
                    </div>
                  </li>
                ) : null}
                {brand.email ? (
                  <li>
                    <span className="gs-ico mail" aria-hidden="true" />
                    <div>
                      <strong>Email</strong>
                      <p>
                        <a href={`mailto:${brand.email}`}>{brand.email}</a>
                      </p>
                    </div>
                  </li>
                ) : null}
              </ul>
            </section>
          </>
        ) : null}

        {activePage === 'menu' ? (
          <section className="gs-menu-page">
            <div className="gs-menu-hero">
              <p className="gs-kicker">The menu</p>
              <h1>Choose your evening.</h1>
              <p>
                From quiet small plates to wood-fired favourites — every dish is hand-portioned,
                freshly prepared, and priced honestly.
              </p>
            </div>

            <div className="gs-menu-toolbar">
              <label className="gs-search">
                <span className="gs-search-ico" aria-hidden="true" />
                <input
                  type="search"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search dishes..."
                  aria-label="Search dishes"
                />
              </label>
              <button
                type="button"
                className={`gs-filters-btn${filtersOpen ? ' is-open' : ''}`}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <span className="gs-filters-ico" aria-hidden="true" />
                Filters
              </button>
            </div>

            {filtersOpen ? (
              <div className="gs-menu-filters">
                <div className="gs-pill-row" role="tablist" aria-label="Categories">
                  <button
                    type="button"
                    className={`gs-pill dark${menuCategory === 'all' ? ' is-active' : ''}`}
                    onClick={() => setMenuCategory('all')}
                  >
                    All categories
                  </button>
                  {menuGroups.map((group) => (
                    <button
                      key={group.category}
                      type="button"
                      className={`gs-pill dark${menuCategory === group.category ? ' is-active' : ''}`}
                      onClick={() => setMenuCategory(group.category)}
                    >
                      {group.category}
                    </button>
                  ))}
                </div>
                <div className="gs-pill-row" role="tablist" aria-label="Dietary filters">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'veg', label: 'Vegetarian' },
                    { id: 'nonveg', label: 'Non-veg' },
                    { id: 'best', label: 'Best sellers' },
                    { id: 'chef', label: "Chef's specials" },
                  ].map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`gs-pill accent${menuTag === tag.id ? ' is-active' : ''}`}
                      onClick={() => setMenuTag(tag.id)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {menuGroups.length === 0 ? <p className="gs-muted">Menu coming soon.</p> : null}
            {menuGroups.length > 0 && filteredMenuItems.length === 0 ? (
              <p className="gs-muted">No dishes match these filters.</p>
            ) : null}

            <div className="gs-dish-grid">
              {filteredMenuItems.map((item, index) => {
                const soldOut = item.stockStatus === 'out'
                const badge = dishBadge(item)
                const photo = item.imageDataUrl || photoPool[(index + 1) % photoPool.length]
                const dishTo = guestDishPath(slug, item.id || item.name)
                return (
                  <article
                    key={item.id || `${item.category}-${item.name}`}
                    className={`gs-dish-card${soldOut ? ' is-soldout' : ''}`}
                  >
                    <Link className="gs-dish-media" to={dishTo}>
                      <DishPhoto src={photo} alt={item.name} />
                      {badge ? <span className={`gs-dish-badge ${badge.kind}`}>{badge.label}</span> : null}
                      {soldOut ? <span className="gs-soldout-badge">Sold out today</span> : null}
                    </Link>
                    <div className="gs-dish-body">
                      <Link className="gs-dish-title" to={dishTo}>
                        <span
                          className={`gs-diet ${item.veg ? 'veg' : 'nonveg'}`}
                          title={item.veg ? 'Vegetarian' : 'Non-veg'}
                          aria-label={item.veg ? 'Vegetarian' : 'Non-veg'}
                        />
                        <strong>{item.name}</strong>
                        <b>{formatPrice(item.price)}</b>
                      </Link>
                      <p>{item.desc || 'Prepared fresh to order.'}</p>
                      <div className="gs-dish-foot">
                        <span>~ {item.prepMinutes || 15} min</span>
                        {liveKeys.has('order') ? (
                          <button
                            type="button"
                            className="gs-dish-add"
                            disabled={soldOut}
                            onClick={() => addToCart(item)}
                          >
                            <em>+</em> Add
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        {activePage === 'dish' ? (
          <section className="gs-dish-page">
            <Link className="gs-back-link" to={guestSitePath(slug, 'menu')}>
              ← Back to menu
            </Link>

            {!selectedDish ? (
              <div className="gs-dish-missing">
                <h1>Dish not found</h1>
                <p className="gs-muted">This item may have been removed from the live menu.</p>
                <Link className="gs-btn primary" to={guestSitePath(slug, 'menu')}>
                  Browse menu
                </Link>
              </div>
            ) : (
              <div className="gs-dish-detail">
                <div className="gs-dish-detail-media">
                  <DishPhoto src={dishPhoto} alt={selectedDish.name} />
                </div>
                <div className="gs-dish-detail-copy">
                  <div className="gs-dish-status-row">
                    <span className={`gs-diet ${selectedDish.veg ? 'veg' : 'nonveg'}`} />
                    {dishBadge(selectedDish) ? (
                      <span className="gs-soft-pill">{dishBadge(selectedDish).label}</span>
                    ) : (
                      <span className="gs-soft-pill">{selectedDish.category || 'Menu'}</span>
                    )}
                    {selectedDish.stockStatus === 'out' ? (
                      <span className="gs-soft-pill warn">Sold out today</span>
                    ) : null}
                  </div>

                  <h1>{selectedDish.name}</h1>
                  <p className="gs-dish-desc">
                    {selectedDish.desc || 'Prepared fresh to order with seasonal ingredients.'}
                  </p>

                  <div className="gs-attr-row">
                    <span className="gs-attr">Wood-fired</span>
                    <span className="gs-attr">Locally sourced</span>
                    <span className="gs-attr">~{selectedDish.prepMinutes || 15} min prep</span>
                    <span className="gs-attr">Serves 1–2</span>
                  </div>

                  <div className="gs-mods">
                    <h2>Make it yours</h2>
                    <ul>
                      {dishAddOns.map((mod) => {
                        const checked = dishMods.has(mod.id)
                        return (
                          <li key={mod.id}>
                            <label className={checked ? 'is-checked' : ''}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDishMod(mod.id)}
                              />
                              <span>{mod.name}</span>
                              <b>{mod.price ? `+${formatPrice(mod.price)}` : 'Free'}</b>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <div className="gs-dish-actions">
                    <div className="gs-qty" aria-label="Quantity">
                      <button
                        type="button"
                        onClick={() => setDishQty((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <strong>{dishQty}</strong>
                      <button
                        type="button"
                        onClick={() => setDishQty((q) => Math.min(20, q + 1))}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`gs-wish${dishSaved ? ' is-on' : ''}`}
                      aria-label={dishSaved ? 'Remove from wishlist' : 'Save to wishlist'}
                      aria-pressed={dishSaved}
                      onClick={() => {
                        if (!dishKey) return
                        setWishlist((prev) => {
                          const next = new Set(prev)
                          if (next.has(dishKey)) next.delete(dishKey)
                          else next.add(dishKey)
                          return next
                        })
                      }}
                    >
                      <span className="gs-wish-ico" aria-hidden="true" />
                    </button>
                    {liveKeys.has('order') ? (
                      <button
                        type="button"
                        className="gs-btn primary gs-add-cart"
                        disabled={selectedDish.stockStatus === 'out'}
                        onClick={addDishToCart}
                      >
                        Add to cart · {formatPrice(dishLineTotal)}
                      </button>
                    ) : (
                      <Link className="gs-btn primary gs-add-cart" to={guestSitePath(slug, 'menu')}>
                        Back to menu · {formatPrice(dishLineTotal)}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {activePage === 'order' ? (
          <GuestCartPage
            slug={slug}
            cart={cart}
            setCart={setCart}
            serviceMode={serviceMode}
            setServiceMode={setServiceMode}
            coupon={coupon}
            setCoupon={setCoupon}
            photoFor={(item) =>
              item.imageDataUrl ||
              photoPool[
                Math.max(
                  0,
                  flatMenuItems.findIndex((i) => (i.id || i.name) === (item.id || item.name)),
                ) % photoPool.length
              ]
            }
          />
        ) : null}

        {activePage === 'checkout' ? (
          <GuestCheckoutPage
            slug={slug}
            cart={cart}
            setCart={setCart}
            serviceMode={serviceMode}
            checkout={checkout}
            setCheckout={setCheckout}
            onPlaced={setLastOrder}
          />
        ) : null}

        {activePage === 'placed' ? <GuestPlacedPage slug={slug} lastOrder={lastOrder} /> : null}

        {activePage === 'tracking' ? <GuestTrackingPage slug={slug} lastOrder={lastOrder} /> : null}

        {activePage === 'book' ? (
          <GuestBookPage
            slug={slug}
            restaurantName={restaurantName}
            booking={booking}
            setBooking={setBooking}
            booked={booked}
            setBooked={setBooked}
            bookError={bookError}
            bookingBusy={bookingBusy}
            availSlots={availSlots}
            availMeta={availMeta}
            submitBooking={submitBooking}
          />
        ) : null}

        {activePage === 'account' ? (
          <GuestAccountPage
            slug={slug}
            restaurantName={restaurantName}
            checkout={checkout}
            lastOrder={lastOrder}
            favorites={
              wishlist.size
                ? flatMenuItems.filter((item) => wishlist.has(String(item.id || item.name)))
                : flatMenuItems.filter((item) => /best|seller|popular|chef|special/i.test(item.tag || '')).slice(0, 3)
            }
            photoFor={(item) =>
              item.imageDataUrl ||
              photoPool[
                Math.max(
                  0,
                  flatMenuItems.findIndex((i) => (i.id || i.name) === (item.id || item.name)),
                ) % photoPool.length
              ]
            }
          />
        ) : null}
      </main>

      <footer className="gs-footer">
        <div className="gs-footer-top gs-footer-3">
          <div className="gs-footer-brand">
            <div className="gs-brand">
              {logo}
              <div className="gs-brand-copy">
                <strong>{restaurantName}</strong>
                {brandMeta ? <span>{brandMeta}</span> : null}
              </div>
            </div>
            <p>
              {brand.description ||
                'Good food, warm people, and evenings worth lingering over.'}
            </p>
            <div className="gs-social">
              {brand.phone ? (
                <a href={`tel:${String(brand.phone).replace(/\s/g, '')}`} aria-label="Call">
                  Call
                </a>
              ) : null}
              {brand.email ? (
                <a href={`mailto:${brand.email}`} aria-label="Email">
                  Email
                </a>
              ) : null}
              {siteActionLinks.slice(0, 2).map((d) => (
                <a key={d.key} href={d.href} target="_blank" rel="noopener noreferrer">
                  {d.name}
                </a>
              ))}
            </div>
          </div>
          <div className="gs-footer-col">
            <h4>Visit</h4>
            {fullAddress ? <p>{fullAddress}</p> : null}
            {hoursSummary ? <p>{hoursSummary}</p> : null}
            {brand.phone ? <p>{brand.phone}</p> : null}
          </div>
          <div className="gs-footer-col">
            <h4>Explore</h4>
            <Link to={guestSitePath(slug, 'website')}>Home</Link>
            {liveKeys.has('menu') ? <Link to={guestSitePath(slug, 'menu')}>Menu</Link> : null}
            {liveKeys.has('book') ? <Link to={guestSitePath(slug, 'book')}>Book a table</Link> : null}
            <Link to={guestSitePath(slug, 'account')}>Account</Link>
            {liveKeys.has('order') ? <Link to={guestSitePath(slug, 'order')}>Order</Link> : null}
          </div>
        </div>
        <div className="gs-footer-bottom">
          <span>
            © {new Date().getFullYear()} {restaurantName} · Powered by{' '}
            <em className="gs-powered">IROAS</em>
          </span>
        </div>
      </footer>
    </div>
  )
}

export default GuestSite
