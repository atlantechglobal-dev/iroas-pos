import { slugify } from './slugify.js'
import { env } from '../config/env.js'

export const ONE_LINK_STORAGE_KEY = 'iroas.oneLink.v1'
export const CARD_STORAGE_KEY = 'iroas.businessCard.v1'

export const ONE_LINK_THEMES = {
  lime: {
    key: 'lime',
    label: 'Lime (Brand)',
    accent: '#8bc53f',
    accentDark: '#6fa62a',
    screenBg: '#ffffff',
    text: '#17171a',
    muted: '#8b8b8f',
    buttonBg: '#f4f8ec',
    buttonText: '#16210a',
  },
  charcoal: {
    key: 'charcoal',
    label: 'Charcoal',
    accent: '#26282a',
    accentDark: '#141516',
    screenBg: '#1a1b1e',
    text: '#f4f4f2',
    muted: '#a7a5a0',
    buttonBg: '#2c2e32',
    buttonText: '#f4f4f2',
  },
  ivory: {
    key: 'ivory',
    label: 'Ivory',
    accent: '#c4a574',
    accentDark: '#9a7b4f',
    screenBg: '#fffaf2',
    text: '#2c2418',
    muted: '#8a7d6b',
    buttonBg: '#f3ebe0',
    buttonText: '#2c2418',
  },
}

export const GUEST_SITE_PAGES = {
  website: { path: '', label: 'Home' },
  menu: { path: 'menu', label: 'Menu' },
  order: { path: 'order', label: 'Order' },
  book: { path: 'book', label: 'Book' },
}

/** Origin used in QR codes and share links (deploy-safe). */
export function publicOrigin() {
  if (env.publicBaseUrl) return env.publicBaseUrl
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** Prefer restaurant subdomain, then name — matches public API slug lookup. */
export function restaurantPublicSlug(restaurantOrName, fallback = 'your-link') {
  if (restaurantOrName && typeof restaurantOrName === 'object') {
    const sub = restaurantOrName.subdomain
    const name = restaurantOrName.name
    return slugify(sub || name || fallback) || fallback
  }
  return slugify(restaurantOrName || fallback) || fallback
}

/** Build real in-app paths for destination keys. */
export function guestSitePath(slug, pageKey = 'website') {
  const page = GUEST_SITE_PAGES[pageKey]
  if (!page || !page.path) return `/s/${slug}`
  return `/s/${slug}/${page.path}`
}

export function guestSiteUrl(slug, pageKey = 'website') {
  const path = guestSitePath(slug, pageKey)
  const origin = publicOrigin()
  return origin ? `${origin}${path}` : path
}

export function withGuestDestinationHrefs(slug, destinations) {
  return (destinations || []).map((d) => {
    if (GUEST_SITE_PAGES[d.key]) {
      return { ...d, href: guestSitePath(slug, d.key) }
    }
    return d
  })
}

export function sanitizeDestinations(destinations) {
  return (destinations || []).map((d, i) => ({
    key: String(d.key || `custom-${i}`),
    name: String(d.name || 'Link').slice(0, 80),
    meta: String(d.meta || '').slice(0, 160),
    href: String(d.href || '').slice(0, 500),
    icon: String(d.icon || '/images/domain.png').slice(0, 200),
    live: Boolean(d.live),
    clicks: String(d.clicks || '0 clicks').slice(0, 40),
  }))
}

export function mergeDestinationsWithDefaults(slug, savedList) {
  const defaults = getDefaultDestinations(slug)
  if (!Array.isArray(savedList) || !savedList.length) {
    return withGuestDestinationHrefs(slug, defaults)
  }
  const defaultByKey = new Map(defaults.map((d) => [d.key, d]))
  const seen = new Set()
  const result = []
  for (const saved of savedList) {
    if (!saved?.key || saved.key === 'website') continue
    seen.add(saved.key)
    const def = defaultByKey.get(saved.key)
    if (def) {
      result.push({
        ...def,
        ...saved,
        href: GUEST_SITE_PAGES[def.key] ? guestSitePath(slug, def.key) : saved.href || def.href,
        icon: saved.icon || def.icon,
        live: saved.live != null ? Boolean(saved.live) : def.live,
      })
    } else {
      result.push({
        key: saved.key,
        name: saved.name || 'Custom Link',
        meta: saved.meta || '',
        href: saved.href || '#',
        icon: saved.icon || '/images/domain.png',
        live: Boolean(saved.live),
        clicks: saved.clicks || '0 clicks',
      })
    }
  }
  for (const def of defaults) {
    if (!seen.has(def.key) && def.key !== 'website') result.push(def)
  }
  return withGuestDestinationHrefs(slug, result)
}

export function getDefaultDestinations(slug) {
  return withGuestDestinationHrefs(slug, [
    {
      key: 'menu',
      icon: '/images/menu.png',
      name: 'Digital Menu',
      meta: 'Live menu with prices',
      clicks: '9,814 clicks',
      live: true,
    },
    {
      key: 'order',
      icon: '/images/order online.png',
      name: 'Order Online',
      meta: 'Delivery & takeaway',
      clicks: '6,402 clicks',
      live: true,
    },
    {
      key: 'book',
      icon: '/images/table book.png',
      name: 'Book a Table',
      meta: 'Live availability',
      clicks: '2,311 clicks',
      live: true,
    },
    {
      key: 'review',
      icon: '/images/review.svg',
      name: 'Leave a Review',
      meta: 'Google reviews',
      href: 'https://g.page/r/review',
      clicks: '872 clicks',
      live: true,
    },
    {
      key: 'instagram',
      icon: '/images/instagram.svg',
      name: 'Instagram',
      meta: 'Social profile',
      href: 'https://instagram.com',
      clicks: '512 clicks',
      live: false,
    },
    {
      key: 'directions',
      icon: '/images/direction.svg',
      name: 'Directions',
      meta: 'Map directions',
      href: 'https://maps.google.com',
      clicks: '1,490 clicks',
      live: true,
    },
    {
      key: 'call',
      icon: '/images/call.svg',
      name: 'Call Restaurant',
      meta: 'Phone',
      href: 'tel:+910000000000',
      clicks: '331 clicks',
      live: false,
    },
  ])
}

/** @deprecated use getDefaultDestinations */
export const DEFAULT_ONE_LINK_DESTINATIONS = getDefaultDestinations('your-link')

/** Human-readable share host for UI — matches the URL encoded in QR. */
export function oneLinkDisplayHost(slug) {
  return String(oneLinkPublicUrl(slug)).replace(/^https?:\/\//, '')
}

export function oneLinkPublicUrl(slug) {
  // One shareable link = the guest restaurant website (not a separate hub URL).
  return guestSiteUrl(slug, 'website')
}

export function cardPublicUrl(slug) {
  const path = `/c/${slug}`
  const origin = publicOrigin()
  return origin ? `${origin}${path}` : path
}

export function cardDisplayHost(slug) {
  return String(cardPublicUrl(slug)).replace(/^https?:\/\//, '')
}

export function saveOneLinkPreview(slug, payload) {
  try {
    const destinations = withGuestDestinationHrefs(slug, payload.destinations)
    const all = JSON.parse(localStorage.getItem(ONE_LINK_STORAGE_KEY) || '{}')
    all[slug] = { ...payload, destinations, updatedAt: Date.now() }
    localStorage.setItem(ONE_LINK_STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadOneLinkPreview(slug) {
  try {
    const all = JSON.parse(localStorage.getItem(ONE_LINK_STORAGE_KEY) || '{}')
    const saved = all[slug] || null
    if (!saved) return null
    return {
      ...saved,
      destinations: withGuestDestinationHrefs(slug, saved.destinations || getDefaultDestinations(slug)),
    }
  } catch {
    return null
  }
}

export function resolveGuestSiteContext(slug) {
  const saved = loadOneLinkPreview(slug)
  const theme = ONE_LINK_THEMES[saved?.themeKey] || ONE_LINK_THEMES.lime
  const brand = saved?.brand || {}
  const primary = brand.primaryColor || theme.accent
  const secondary = brand.secondaryColor || theme.accentDark
  const accent = brand.accentColor || theme.accent
  const destinations = (saved?.destinations || getDefaultDestinations(slug)).filter((d) => d.live)

  return {
    saved,
    theme,
    brand: {
      primaryColor: primary,
      secondaryColor: secondary,
      accentColor: accent,
      surfaceColor: brand.surfaceColor || theme.screenBg || '#ffffff',
      successColor: brand.successColor || '#22C55E',
      warningColor: brand.warningColor || '#F59E0B',
      logoDataUrl: brand.logoDataUrl || '',
      coverDataUrl: brand.coverDataUrl || '',
      displayFont: brand.displayFont || 'Plus Jakarta Sans',
      bodyFont: brand.bodyFont || 'Inter',
      phone: brand.phone || '',
      address: brand.address || '',
      cuisine: brand.cuisine || '',
      description: brand.description || '',
      email: brand.email || '',
      website: brand.website || '',
    },
    restaurantName: saved?.restaurantName || slug.replace(/-/g, ' '),
    headline: saved?.headline || saved?.restaurantName || slug.replace(/-/g, ' '),
    subheadline: saved?.subheadline || 'Order, book a table or browse our menu.',
    destinations,
    liveKeys: new Set(['website', ...destinations.map((d) => d.key)]),
  }
}

export function saveCardPreview(slug, payload) {
  try {
    const all = JSON.parse(localStorage.getItem(CARD_STORAGE_KEY) || '{}')
    all[slug] = { ...payload, updatedAt: Date.now() }
    localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function loadCardPreview(slug) {
  try {
    const all = JSON.parse(localStorage.getItem(CARD_STORAGE_KEY) || '{}')
    return all[slug] || null
  } catch {
    return null
  }
}

export function restaurantLinkSlug(name, fallback = 'your-link') {
  return restaurantPublicSlug(name, fallback)
}

export const GUEST_MENU_ITEMS = [
  {
    category: 'Starters',
    items: [
      { name: 'Burrata & Heirloom Tomato', price: 400, desc: 'Basil oil, warm sourdough', veg: true },
      { name: 'Crispy Calamari', price: 460, desc: 'Lemon aioli, chilli salt', veg: false },
      { name: 'Charred Broccolini', price: 320, desc: 'Tahini, toasted sesame', veg: true },
    ],
  },
  {
    category: 'Mains',
    items: [
      { name: 'Truffle Mushroom Risotto', price: 480, desc: 'Carnaroli rice, parmesan crisp', veg: true },
      { name: 'Wood-Fired Margherita', price: 350, desc: 'San marzano, fior di latte, basil', veg: true },
      { name: 'Saffron Butter Chicken', price: 550, desc: 'Tandoor chicken, fenugreek cream', veg: false },
      { name: 'Catch of the Day', price: 620, desc: 'Market fish, citrus beurre blanc', veg: false },
    ],
  },
  {
    category: 'Desserts',
    items: [
      { name: 'Dark Chocolate Fondant', price: 320, desc: 'Vanilla bean ice cream', veg: true },
      { name: 'Seasonal Pavlova', price: 290, desc: 'Passionfruit cream', veg: true },
    ],
  },
]
