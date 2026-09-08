import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function findRestaurantBySlug(slug) {
  const clean = slugify(slug)
  if (!clean) return null
  const bySub = db.prepare('SELECT * FROM restaurants WHERE subdomain = ?').get(clean)
  if (bySub) return bySub
  const rows = db.prepare('SELECT * FROM restaurants WHERE name IS NOT NULL').all()
  return rows.find((r) => slugify(r.name) === clean) || null
}

function parseSettings(restaurant) {
  if (!restaurant?.settings_json) return {}
  try {
    return JSON.parse(restaurant.settings_json)
  } catch {
    return {}
  }
}

function parseHours(restaurant) {
  if (!restaurant?.operating_hours) return null
  try {
    return JSON.parse(restaurant.operating_hours)
  } catch {
    return restaurant.operating_hours
  }
}

function publicSlug(restaurant) {
  return restaurant.subdomain || slugify(restaurant.name)
}

/** Lightweight image references — avoid embedding base64 in JSON payloads. */
export function mediaPath(slug, kind, id) {
  if (id == null || id === '') return `/api/public/${slug}/media/${kind}`
  return `/api/public/${slug}/media/${kind}/${id}`
}

function sendDataUrl(res, dataUrl) {
  if (!dataUrl) return res.status(404).json({ error: 'Image not found.' })
  const match = String(dataUrl).match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (!match) return res.status(404).json({ error: 'Image not found.' })
  try {
    const buffer = Buffer.from(match[2], 'base64')
    res.setHeader('Content-Type', match[1] || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.send(buffer)
  } catch {
    return res.status(404).json({ error: 'Image not found.' })
  }
}

function mapPublicMenu(restaurant, slug) {
  const categories = db
    .prepare(
      `SELECT * FROM menu_categories
       WHERE restaurant_id = ? AND status = 'live'
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(restaurant.id)

  const items = db
    .prepare(
      `SELECT id, category_id, name, description, price, veg, tag, prep_minutes, image_data_url
       FROM menu_items
       WHERE restaurant_id = ? AND status = 'live'
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(restaurant.id)

  return categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      imageDataUrl: cat.image_data_url ? mediaPath(slug, 'category', cat.id) : '',
      items: items
        .filter((item) => item.category_id === cat.id)
        .map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          desc: item.description || '',
          veg: Boolean(item.veg),
          tag: item.tag || '',
          imageDataUrl: item.image_data_url ? mediaPath(slug, 'menu', item.id) : '',
          prepMinutes: item.prep_minutes ?? 15,
        })),
    }))
    .filter((c) => c.items.length > 0)
}

function seedReviewsIfEmpty(restaurantId, restaurantName) {
  const count = db
    .prepare('SELECT COUNT(*) AS c FROM reviews WHERE restaurant_id = ?')
    .get(restaurantId).c
  if (count > 0) return

  const insert = db.prepare(
    `INSERT INTO reviews (restaurant_id, author, rating, body, status)
     VALUES (?, ?, ?, ?, 'published')`,
  )
  insert.run(
    restaurantId,
    'Aisha K.',
    5,
    `Wonderful evening at ${restaurantName || 'this restaurant'} — warm service and unforgettable plates.`,
  )
  insert.run(
    restaurantId,
    'Rohan M.',
    4,
    'Great ambience and thoughtful menu. Will definitely book again.',
  )
}

function requireRestaurant(req, res) {
  const restaurant = findRestaurantBySlug(req.params.slug)
  if (!restaurant) {
    res.status(404).json({ error: 'Restaurant not found.' })
    return null
  }
  return restaurant
}

router.get('/:slug/media/logo', (req, res) => {
  const restaurant = requireRestaurant(req, res)
  if (!restaurant) return
  return sendDataUrl(res, restaurant.logo_data_url)
})

router.get('/:slug/media/cover', (req, res) => {
  const restaurant = requireRestaurant(req, res)
  if (!restaurant) return
  const settings = parseSettings(restaurant)
  return sendDataUrl(res, settings.coverDataUrl || settings.coverPhoto || '')
})

router.get('/:slug/media/gallery/:index', (req, res) => {
  const restaurant = requireRestaurant(req, res)
  if (!restaurant) return
  const settings = parseSettings(restaurant)
  const gallery = Array.isArray(settings.gallery) ? settings.gallery : []
  const item = gallery[Number(req.params.index)]
  return sendDataUrl(res, item?.dataUrl || item?.url || '')
})

router.get('/:slug/media/menu/:itemId', (req, res) => {
  const restaurant = requireRestaurant(req, res)
  if (!restaurant) return
  const item = db
    .prepare(
      `SELECT image_data_url FROM menu_items
       WHERE id = ? AND restaurant_id = ? AND status = 'live'`,
    )
    .get(req.params.itemId, restaurant.id)
  return sendDataUrl(res, item?.image_data_url || '')
})

router.get('/:slug/media/category/:catId', (req, res) => {
  const restaurant = requireRestaurant(req, res)
  if (!restaurant) return
  const cat = db
    .prepare(
      `SELECT image_data_url FROM menu_categories
       WHERE id = ? AND restaurant_id = ? AND status = 'live'`,
    )
    .get(req.params.catId, restaurant.id)
  return sendDataUrl(res, cat?.image_data_url || '')
})

/** Public restaurant site payload (images as URLs, not base64) */
router.get('/:slug', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug)
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  const settings = parseSettings(restaurant)
  seedReviewsIfEmpty(restaurant.id, restaurant.name)

  const reviews = db
    .prepare(
      `SELECT id, author, rating, body, created_at AS createdAt
       FROM reviews
       WHERE restaurant_id = ? AND status = 'published'
       ORDER BY created_at DESC
       LIMIT 12`,
    )
    .all(restaurant.id)

  const slug = publicSlug(restaurant)
  const galleryRaw = Array.isArray(settings.gallery) ? settings.gallery : []
  const gallery = galleryRaw
    .map((g, i) => {
      const hasImage = Boolean(g?.dataUrl || g?.url)
      return {
        id: g.id || `g-${i}`,
        dataUrl: hasImage ? mediaPath(slug, 'gallery', i) : '',
        caption: g.caption || '',
      }
    })
    .filter((g) => g.dataUrl)

  const menu = mapPublicMenu(restaurant, slug)

  res.json({
    restaurant: {
      name: restaurant.name,
      slug,
      cuisine: restaurant.cuisine || '',
      description: restaurant.description || '',
      tagline: settings.tagline || '',
      phone: restaurant.phone || '',
      email: restaurant.email || '',
      website: restaurant.website || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      country: restaurant.country || '',
      hours: parseHours(restaurant),
      socials: {
        instagram: settings.instagram || settings.socialInstagram || '',
        facebook: settings.facebook || '',
        googleReview: settings.googleReviewUrl || settings.reviewUrl || '',
      },
      yearEstablished: settings.yearEstablished || '',
    },
    brand: {
      primaryColor: restaurant.primary_color || '#F97316',
      secondaryColor: restaurant.secondary_color || '#F0F72A',
      accentColor: restaurant.accent_color || '#BDB8A4',
      font: restaurant.font || 'Plus Jakarta Sans',
      displayFont: settings.displayFont || restaurant.font || 'Plus Jakarta Sans',
      bodyFont: settings.bodyFont || 'Plus Jakarta Sans',
      theme: restaurant.theme || 'modern',
      logoDataUrl: restaurant.logo_data_url ? mediaPath(slug, 'logo') : '',
      coverDataUrl: Boolean(settings.coverDataUrl || settings.coverPhoto)
        ? mediaPath(slug, 'cover')
        : '',
      surfaceColor: settings.surfaceColor || '',
    },
    gallery,
    reviews,
    menu,
    oneLink: {
      headline: settings.oneLinkHeadline || settings.tagline || restaurant.name || '',
      subheadline: settings.oneLinkSubheadline || settings.tagline || '',
      themeKey: settings.oneLinkThemeKey || 'lime',
      destinations: Array.isArray(settings.oneLinkDestinations)
        ? settings.oneLinkDestinations
        : null,
    },
  })
})

/** Guest creates a reservation */
router.post('/:slug/reservations', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug)
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  const { name, phone, guests, date, time, notes } = req.body || {}
  if (!String(name || '').trim() || !String(phone || '').trim()) {
    return res.status(400).json({ error: 'Name and phone are required.' })
  }
  if (!date || !time) {
    return res.status(400).json({ error: 'Date and time are required.' })
  }

  const guestCount = Math.max(1, Math.min(20, Number(guests) || 2))

  const result = db
    .prepare(
      `INSERT INTO reservations
        (restaurant_id, guest_name, phone, guests, date, time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      restaurant.id,
      String(name).trim(),
      String(phone).trim(),
      guestCount,
      String(date),
      String(time),
      String(notes || '').trim() || null,
    )

  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.lastInsertRowid)

  res.status(201).json({
    reservation: {
      id: row.id,
      guestName: row.guest_name,
      phone: row.phone,
      guests: row.guests,
      date: row.date,
      time: row.time,
      notes: row.notes || '',
      status: row.status,
      createdAt: row.created_at,
    },
  })
})

export default router
