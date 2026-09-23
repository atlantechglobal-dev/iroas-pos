import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/shared/lib/api'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import {
  GUEST_SITE_PAGES,
  guestDishPath,
  guestSitePath,
  resolveGuestSiteContext,
} from '@/shared/utils/guestLinks'
import '@/features/guest/GuestSite/GuestSite.css'
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

/** Keyword → matching dish photo (avoids random mismatched stock images). */
const DISH_PHOTO_BY_KEYWORD = [
  [/burrata|tomato|caprese|salad/i, 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=800&q=80'],
  [/calamari|squid|seafood|prawn|shrimp|fish/i, 'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=800&q=80'],
  [/broccolini|broccoli|veggie|vegetable|greens/i, 'https://images.unsplash.com/photo-1628773822503-930a7eaecf80?auto=format&fit=crop&w=800&q=80'],
  [/risotto|mushroom|truffle|rice/i, 'https://images.unsplash.com/photo-1476124369491-e7addf5e8730?auto=format&fit=crop&w=800&q=80'],
  [/pizza|margherita|flatbread/i, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'],
  [/pasta|noodle|spaghetti|penne/i, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80'],
  [/burger|sandwich/i, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80'],
  [/chicken|tikka|grill|tandoor/i, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80'],
  [/dessert|cake|ice|sweet|chocolate/i, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80'],
  [/sushi|roll|sashimi/i, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66d?auto=format&fit=crop&w=800&q=80'],
  [/naan|bread|roti/i, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80'],
  [/soup|broth|stew/i, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80'],
]

function resolveMediaUrl(src) {
  if (!src) return ''
  const value = String(src).trim()
  if (!value) return ''
  if (
    value.startsWith('data:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('blob:')
  ) {
    return value
  }
  if (value.startsWith('/')) return value
  return `/${value.replace(/^\.\//, '')}`
}

function matchedDishPhoto(name = '', index = 0) {
  const label = String(name || '')
  for (const [re, url] of DISH_PHOTO_BY_KEYWORD) {
    if (re.test(label)) return url
  }
  return FALLBACK_PHOTOS[Math.abs(Number(index) || 0) % FALLBACK_PHOTOS.length]
}

function dishPhotoSrc(item, index = 0) {
  const uploaded = resolveMediaUrl(item?.imageDataUrl)
  if (uploaded) return uploaded
  return matchedDishPhoto(item?.name, index)
}

function DishPhoto({ src, alt = '', className = '', placeholderLabel = '' }) {
  const [broken, setBroken] = useState(false)
  const resolved = resolveMediaUrl(src)
  const showImg = Boolean(resolved) && !broken

  useEffect(() => {
    setBroken(false)
  }, [resolved])

  if (showImg) {
    return (
      <img
        className={`gs-photo ${className}`.trim()}
        src={resolved}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    )
  }

  const initial = String(placeholderLabel || alt || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return (
    <div
      className={`gs-photo placeholder ${className}`.trim()}
      aria-hidden={alt ? undefined : true}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
    >
      <span>{initial || '·'}</span>
    </div>
  )
}

function formatPrice(n) {
  return `₹${n}`
}

function stars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function FooterSocialLink({ href, label, children }) {
  return (
    <a
      href={href}
      className="gs-footer-social-btn"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
    >
      {children}
    </a>
  )
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
  const { slug = 'your-link', page, itemId, tableCode } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const activePage = itemId ? 'dish' : tableCode ? 'menu' : page || 'home'
  const localCtx = useMemo(() => resolveGuestSiteContext(slug), [slug])

  const [site, setSite] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [cart, setCart] = useState([])
  const [tableSession, setTableSession] = useState(null)
  const [diningTables, setDiningTables] = useState([])
  const [booking, setBooking] = useState({
    name: '',
    phone: '',
    email: '',
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
  const [serviceMode, setServiceMode] = useState('pickup')
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
    payment: 'cash',
    billPay: 'upi',
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
    api
      .getPublicSite(slug)
      .then((data) => {
        if (cancelled) return
        setSite(data)
        const rest = data?.restaurant || {}
        // Soft-prefill delivery city only; phone/email stay as placeholders for the guest.
        setCheckout((prev) => ({
          ...prev,
          city: prev.city || rest.city || '',
        }))
      })
      .catch(() => {
        if (cancelled) return
        setSite(null)
        setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!tableCode) return undefined
    let cancelled = false
    api
      .getPublicTable(slug, tableCode)
      .then(({ table }) => {
        if (cancelled || !table) return
        setTableSession({ ...table, fromQr: true })
        setServiceMode('dinein')
        navigate(guestSitePath(slug, 'menu'), { replace: true })
      })
      .catch(() => {
        if (!cancelled) setTableSession(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug, tableCode, navigate])

  useEffect(() => {
    let cancelled = false
    api
      .getPublicTables(slug)
      .then(({ tables }) => {
        if (!cancelled) setDiningTables(tables || [])
      })
      .catch(() => {
        if (!cancelled) setDiningTables([])
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
    site?.restaurant?.name || (!site ? localCtx.restaurantName : '') || slug.replace(/-/g, ' ')
  const hasSite = Boolean(site?.restaurant)
  const brand = {
    primaryColor: site?.brand?.primaryColor || (!hasSite ? localCtx.brand.primaryColor : '') || '#F97316',
    secondaryColor:
      site?.brand?.secondaryColor || (!hasSite ? localCtx.brand.secondaryColor : '') || '#FED7AA',
    accentColor: site?.brand?.accentColor || (!hasSite ? localCtx.brand.accentColor : '') || '#111827',
    logoDataUrl: site?.brand?.logoDataUrl || (!hasSite ? localCtx.brand.logoDataUrl : '') || '',
    coverDataUrl: site?.brand?.coverDataUrl || (!hasSite ? localCtx.brand.coverDataUrl : '') || '',
    cuisine: site?.restaurant?.cuisine || (!hasSite ? localCtx.brand.cuisine : '') || '',
    description:
      site?.restaurant?.description || (!hasSite ? localCtx.brand.description : '') || '',
    phone: hasSite ? site.restaurant.phone || '' : localCtx.brand.phone || '',
    email: hasSite ? site.restaurant.email || '' : localCtx.brand.email || '',
    website: hasSite ? site.restaurant.website || '' : localCtx.brand.website || '',
    address: hasSite ? site.restaurant.address || '' : localCtx.brand.address || '',
    city: site?.restaurant?.city || '',
    country: site?.restaurant?.country || '',
    displayFont: site?.brand?.displayFont || 'Fraunces',
    bodyFont: site?.brand?.bodyFont || 'DM Sans',
    surfaceColor: site?.brand?.surfaceColor || localCtx.brand.surfaceColor || '',
  }
  const socials = site?.restaurant?.socials || {}
  const operatingHours = Array.isArray(site?.restaurant?.hours) ? site.restaurant.hours : []
  const yearEst = site?.restaurant?.yearEstablished || ''
  const tagline =
    site?.oneLink?.subheadline ||
    site?.restaurant?.tagline ||
    (!hasSite ? localCtx.subheadline : '') ||
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
    return []
  }, [site])

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
    const idx = Math.max(
      0,
      flatMenuItems.findIndex((i) => (i.id || i.name) === (selectedDish.id || selectedDish.name)),
    )
    return dishPhotoSrc(selectedDish, idx)
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
  const googleReviewHref = socials.googleReview
    ? /^https?:/i.test(socials.googleReview)
      ? socials.googleReview
      : `https://${socials.googleReview}`
    : ''
  const reviewHref =
    googleReviewHref ||
    orderedDestinations.find((d) => d.key === 'review' && d.href)?.href ||
    ''
  const websiteHref = brand.website
    ? /^https?:/i.test(brand.website)
      ? brand.website
      : `https://${brand.website}`
    : ''
  const mapsHref = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : ''
  const instagramHref = socials.instagram
    ? /^https?:/i.test(socials.instagram)
      ? socials.instagram
      : `https://instagram.com/${String(socials.instagram).replace(/^@/, '')}`
    : ''
  const facebookHref = socials.facebook
    ? /^https?:/i.test(socials.facebook)
      ? socials.facebook
      : `https://facebook.com/${socials.facebook}`
    : ''

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
    { to: guestSitePath(slug, 'order'), label: 'Order' },
    { to: guestSitePath(slug, 'tracking'), label: 'Track' },
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
    const qtyLabel = qty > 1 ? `${qty}× ` : ''
    toast.success(`${qtyLabel}${item.name || 'Item'} added to cart`)
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
        email: booking.email,
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
                    const img =
                      resolveMediaUrl(group.categoryImage) ||
                      resolveMediaUrl(group.items.find((i) => i.imageDataUrl)?.imageDataUrl) ||
                      dishPhotoSrc(group.items[0], index) ||
                      photoPool[index % photoPool.length]
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
                          src={dishPhotoSrc(item, index)}
                          alt={item.name}
                          placeholderLabel={item.name}
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
                      <p>
                        {mapsHref ? (
                          <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                            {fullAddress}
                          </a>
                        ) : (
                          fullAddress
                        )}
                      </p>
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
                {websiteHref ? (
                  <li>
                    <span className="gs-ico web" aria-hidden="true" />
                    <div>
                      <strong>Website</strong>
                      <p>
                        <a href={websiteHref} target="_blank" rel="noopener noreferrer">
                          {brand.website}
                        </a>
                      </p>
                    </div>
                  </li>
                ) : null}
                {instagramHref || facebookHref || googleReviewHref ? (
                  <li>
                    <span className="gs-ico social" aria-hidden="true" />
                    <div>
                      <strong>Social</strong>
                      <p className="gs-social-inline">
                        {instagramHref ? (
                          <a href={instagramHref} target="_blank" rel="noopener noreferrer">
                            Instagram
                          </a>
                        ) : null}
                        {facebookHref ? (
                          <a href={facebookHref} target="_blank" rel="noopener noreferrer">
                            Facebook
                          </a>
                        ) : null}
                        {googleReviewHref ? (
                          <a href={googleReviewHref} target="_blank" rel="noopener noreferrer">
                            Google reviews
                          </a>
                        ) : null}
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

            {tableSession?.name ? (
              <p className="gs-table-banner">
                {tableSession.fromQr ? 'Scanned · ' : ''}
                Ordering for <strong>{tableSession.name}</strong> · dine-in — add dishes, then open cart
              </p>
            ) : null}

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
                const photo = dishPhotoSrc(item, index)
                const dishTo = guestDishPath(slug, item.id || item.name)
                return (
                  <article
                    key={item.id || `${item.category}-${item.name}`}
                    className={`gs-dish-card${soldOut ? ' is-soldout' : ''}`}
                  >
                    <Link className="gs-dish-media" to={dishTo}>
                      <DishPhoto src={photo} alt={item.name} placeholderLabel={item.name} />
                      {badge ? <span className={`gs-dish-badge ${badge.kind}`}>{badge.label}</span> : null}
                      {soldOut ? <span className="gs-soldout-badge">Sold out today</span> : null}
                      {!soldOut && item.stockStatus === 'low' ? (
                        <span className="gs-lowstock-badge">Low stock</span>
                      ) : null}
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
                  <DishPhoto src={dishPhoto} alt={selectedDish.name} placeholderLabel={selectedDish.name} />
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
                    {selectedDish.stockStatus === 'low' ? (
                      <span className="gs-soft-pill warn">Low stock</span>
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
            tableSession={tableSession}
            setTableSession={setTableSession}
            diningTables={diningTables}
            photoFor={(item) => dishPhotoSrc(item, 0)}
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
            payments={site?.payments || {}}
            tableSession={tableSession}
            restaurantContact={{
              phone: brand.phone,
              email: brand.email,
              city: brand.city,
              name: restaurantName,
            }}
          />
        ) : null}

        {activePage === 'placed' ? <GuestPlacedPage slug={slug} lastOrder={lastOrder} /> : null}

        {activePage === 'tracking' ? (
          <GuestTrackingPage
            slug={slug}
            lastOrder={lastOrder}
            restaurantAddress={fullAddress}
          />
        ) : null}

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
            restaurantPhone={brand.phone}
          />
        ) : null}

        {activePage === 'account' ? (
          <GuestAccountPage
            slug={slug}
            restaurantName={restaurantName}
            checkout={checkout}
            lastOrder={lastOrder}
            restaurantContact={{
              phone: brand.phone,
              email: brand.email,
              address: fullAddress,
            }}
            favorites={
              wishlist.size
                ? flatMenuItems.filter((item) => wishlist.has(String(item.id || item.name)))
                : flatMenuItems.filter((item) => /best|seller|popular|chef|special/i.test(item.tag || '')).slice(0, 3)
            }
            photoFor={(item) => dishPhotoSrc(item, 0)}
          />
        ) : null}
      </main>

      <footer className="gs-footer">
        <div className="gs-footer-grid">
          <div className="gs-footer-brand">
            <Link className="gs-brand gs-footer-logo" to={guestSitePath(slug, 'website')}>
              {logo}
              <div className="gs-brand-copy">
                <strong>{restaurantName}</strong>
                {brandMeta ? <span>{brandMeta}</span> : null}
              </div>
            </Link>
            <p className="gs-footer-blurb">
              {brand.description ||
                'Good food, warm people, and evenings worth lingering over.'}
            </p>
            {instagramHref || facebookHref || googleReviewHref ? (
              <div className="gs-footer-social" aria-label="Social links">
                {instagramHref ? (
                  <FooterSocialLink href={instagramHref} label="Instagram">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5z" />
                    </svg>
                  </FooterSocialLink>
                ) : null}
                {facebookHref ? (
                  <FooterSocialLink href={facebookHref} label="Facebook">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M13 10V7.5c0-.83.67-1.5 1.5-1.5H16V3h-2a4 4 0 0 0-4 4v3H8v3h2v8h3v-8h2.5l.5-3H13z" />
                    </svg>
                  </FooterSocialLink>
                ) : null}
                {googleReviewHref ? (
                  <FooterSocialLink href={googleReviewHref} label="Google reviews">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 14.8 7.2 17l.9-5.3L4.2 7.7l5.4-.8L12 2z" />
                    </svg>
                  </FooterSocialLink>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="gs-footer-col">
            <h4>Explore</h4>
            <nav aria-label="Footer explore">
              <Link to={guestSitePath(slug, 'website')}>Home</Link>
              {liveKeys.has('menu') ? <Link to={guestSitePath(slug, 'menu')}>Menu</Link> : null}
              {liveKeys.has('book') ? (
                <Link to={guestSitePath(slug, 'book')}>Book a table</Link>
              ) : null}
              {liveKeys.has('order') ? <Link to={guestSitePath(slug, 'order')}>Order online</Link> : null}
              <Link to={guestSitePath(slug, 'account')}>Account</Link>
              <Link to={`${guestSitePath(slug, 'website')}#contact`}>Contact</Link>
            </nav>
          </div>

          <div className="gs-footer-col">
            <h4>Visit</h4>
            {fullAddress ? (
              <p>
                {mapsHref ? (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                    {fullAddress}
                  </a>
                ) : (
                  fullAddress
                )}
              </p>
            ) : null}
            {brand.phone ? (
              <p>
                <a href={`tel:${String(brand.phone).replace(/\s/g, '')}`}>{brand.phone}</a>
              </p>
            ) : null}
            {brand.email ? (
              <p>
                <a href={`mailto:${brand.email}`}>{brand.email}</a>
              </p>
            ) : null}
            {websiteHref ? (
              <p>
                <a href={websiteHref} target="_blank" rel="noopener noreferrer">
                  {brand.website}
                </a>
              </p>
            ) : null}
            {mapsHref ? (
              <p>
                <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              </p>
            ) : null}
            {reviewHref && !googleReviewHref ? (
              <p>
                <a href={reviewHref} target="_blank" rel="noopener noreferrer">
                  Leave a review
                </a>
              </p>
            ) : null}
          </div>

          <div className="gs-footer-col">
            <h4>Hours</h4>
            {operatingHours.length > 0 ? (
              <ul className="gs-footer-hours">
                {operatingHours.map((row) => (
                  <li key={row.day || row.open}>
                    <span>{row.day}</span>
                    <span>{row.closed ? 'Closed' : `${row.open} – ${row.close}`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gs-footer-muted">{hoursSummary || 'Hours coming soon'}</p>
            )}
          </div>
        </div>

        <div className="gs-footer-bottom">
          <span>
            © {new Date().getFullYear()} {restaurantName}. All rights reserved.
          </span>
          <span className="gs-footer-powered">
            Powered by <em className="gs-powered">IROAS</em>
          </span>
        </div>
      </footer>
    </div>
  )
}

export default GuestSite
