import express, { Router } from 'express'
import { db } from '../db.js'
import {
  assertBookable,
  listSlots,
  maxCoversFromSettings,
  parseHoursJson,
} from '../services/reservationAvailability.js'
import { onReservationCreated } from '../services/reservationMessaging.js'
import { assignTableForParty } from '../services/diningTables.js'
import {
  createGuestOrder,
  findTableByPublicCode,
  getOrderByPublicCode,
  listOrdersByPhone,
} from '../services/orders.js'
import { onOrderCreated } from '../services/orderMessaging.js'
import { listDiningTables } from '../services/diningTables.js'
import { verifyNotifySignature } from '../services/addpayClient.js'
import { getPaymentSettings } from '../services/paymentSettings.js'
import { sendOnboardingPaymentEmails } from '../services/onboardingMessaging.js'

const router = Router()

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function findRestaurantBySlug(slug, { liveOnly = false } = {}) {
  const clean = slugify(slug)
  if (!clean) return null

  const bySub = db.prepare('SELECT * FROM restaurants WHERE subdomain = ?').get(clean)
  if (bySub) {
    if (bySub.status === 'deleted') return null
    if (liveOnly && bySub.status !== 'live') return null
    return bySub
  }

  const rows = db
    .prepare(
      liveOnly
        ? "SELECT * FROM restaurants WHERE name IS NOT NULL AND status = 'live'"
        : "SELECT * FROM restaurants WHERE name IS NOT NULL AND status != 'deleted'",
    )
    .all()

  return (
    rows.find((r) => slugify(r.subdomain || '') === clean || slugify(r.name) === clean) || null
  )
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
      `SELECT id, category_id, name, description, price, veg, tag, prep_minutes, stock_status, image_data_url
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
          stockStatus: item.stock_status || 'in_stock',
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

function requireRestaurant(req, res, { liveOnly = false } = {}) {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly })
  if (!restaurant || (liveOnly && restaurant.status !== 'live')) {
    res.status(404).json({ error: 'Restaurant not found.' })
    return null
  }
  return restaurant
}

router.get('/:slug/media/logo', (req, res) => {
  const restaurant = requireRestaurant(req, res, { liveOnly: true })
  if (!restaurant) return
  return sendDataUrl(res, restaurant.logo_data_url)
})

router.get('/:slug/media/cover', (req, res) => {
  const restaurant = requireRestaurant(req, res, { liveOnly: true })
  if (!restaurant) return
  const settings = parseSettings(restaurant)
  return sendDataUrl(res, settings.coverDataUrl || settings.coverPhoto || '')
})

router.get('/:slug/media/gallery/:index', (req, res) => {
  const restaurant = requireRestaurant(req, res, { liveOnly: true })
  if (!restaurant) return
  const settings = parseSettings(restaurant)
  const gallery = Array.isArray(settings.gallery) ? settings.gallery : []
  const item = gallery[Number(req.params.index)]
  return sendDataUrl(res, item?.dataUrl || item?.url || '')
})

router.get('/:slug/media/menu/:itemId', (req, res) => {
  const restaurant = requireRestaurant(req, res, { liveOnly: true })
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
  const restaurant = requireRestaurant(req, res, { liveOnly: true })
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
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
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
        googleReview:
          settings.googleBusiness || settings.googleReviewUrl || settings.reviewUrl || '',
      },
      yearEstablished: settings.yearEstablished || '',
      stories: settings.businessIdStories || null,
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
    payments: {
      upiId: settings.upiId || '',
      upiDisplayName: settings.upiDisplayName || restaurant.name || '',
      methods: ['upi', 'cash'],
      pauseOrders: Boolean(settings.pauseOrders),
    },
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

/** Availability slots for a date + party size (live restaurants only). */
router.get('/:slug/availability', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  const date = String(req.query.date || '').trim()
  const guests = Math.max(1, Math.min(12, Number(req.query.guests) || 2))
  if (!date) return res.status(400).json({ error: 'date query parameter is required.' })

  const settings = parseSettings(restaurant)
  const hours = parseHoursJson(restaurant.operating_hours)
  const existing = db
    .prepare(
      `SELECT id, date, time, guests, status FROM reservations
       WHERE restaurant_id = ? AND date = ? AND status IN ('pending', 'confirmed')`,
    )
    .all(restaurant.id, date)

  const result = listSlots({
    hours,
    date,
    guests,
    existingRows: existing,
    maxCovers: maxCoversFromSettings(settings),
  })

  res.json({
    date,
    guests,
    maxCovers: maxCoversFromSettings(settings),
    closed: result.closed,
    reason: result.reason || null,
    slots: result.slots,
  })
})

/** Guest creates a reservation */
router.post('/:slug/reservations', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  const { name, phone, email, guests, date, time, notes } = req.body || {}
  if (!String(name || '').trim() || !String(phone || '').trim()) {
    return res.status(400).json({ error: 'Name and phone are required.' })
  }
  if (!date || !time) {
    return res.status(400).json({ error: 'Date and time are required.' })
  }

  const guestCount = Math.max(1, Math.min(12, Number(guests) || 2))
  if (Number(guests) > 12) {
    return res.status(400).json({
      error: 'Online bookings are limited to 12 guests. Please call the restaurant for larger parties.',
    })
  }
  const guestEmail = String(email || '').trim() || null
  const settings = parseSettings(restaurant)
  const hours = parseHoursJson(restaurant.operating_hours)

  let insertedId = null
  try {
    const run = db.transaction(() => {
      const existing = db
        .prepare(
          `SELECT id, date, time, guests, status FROM reservations
           WHERE restaurant_id = ? AND date = ? AND status IN ('pending', 'confirmed')`,
        )
        .all(restaurant.id, String(date))

      const check = assertBookable({
        hours,
        date: String(date),
        time: String(time),
        guests: guestCount,
        existingRows: existing,
        maxCovers: maxCoversFromSettings(settings),
      })
      if (!check.ok) {
        const err = new Error(check.error)
        err.status = check.status
        throw err
      }

      const tableId = assignTableForParty({
        restaurantId: restaurant.id,
        date: String(date),
        time: String(time),
        guests: guestCount,
      })

      const result = db
        .prepare(
          `INSERT INTO reservations
            (restaurant_id, guest_name, phone, guest_email, guests, date, time, notes, status, table_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .run(
          restaurant.id,
          String(name).trim(),
          String(phone).trim(),
          guestEmail,
          guestCount,
          String(date),
          String(time),
          String(notes || '').trim() || null,
          tableId || null,
        )
      insertedId = result.lastInsertRowid
    })
    run.immediate()
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unable to create booking.' })
  }

  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(insertedId)
  onReservationCreated(restaurant, row, { source: 'public' })

  res.status(201).json({
    reservation: {
      id: row.id,
      guestName: row.guest_name,
      phone: row.phone,
      email: row.guest_email || '',
      guests: row.guests,
      date: row.date,
      time: row.time,
      notes: row.notes || '',
      status: row.status,
      tableId: row.table_id || null,
      createdAt: row.created_at,
    },
  })
})

/** Public list of active dining tables (for guest table picker) */
router.get('/:slug/tables', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })
  const tables = listDiningTables(restaurant.id)
    .filter((t) => t.active !== 0 && t.active !== false)
    .map((t) => ({
      id: t.id,
      name: t.name,
      seats: t.seats,
      zone: t.zone,
      publicCode: t.publicCode,
    }))
  res.json({ tables })
})

/** Resolve a dining table from QR public code */
router.get('/:slug/table/:code', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })
  const table = findTableByPublicCode(restaurant.id, req.params.code)
  if (!table) return res.status(404).json({ error: 'Table not found.' })
  res.json({
    table: {
      id: table.id,
      name: table.name,
      seats: table.seats,
      zone: table.zone,
      publicCode: table.publicCode,
    },
  })
})

/** Guest places an order (manual Cash / UPI — payment_pending until staff marks paid) */
router.post('/:slug/orders', async (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  const result = createGuestOrder(restaurant, req.body || {})
  if (!result.ok) return res.status(result.status).json({ error: result.error })

  try {
    await onOrderCreated(restaurant, result.order)
  } catch (err) {
    console.warn('Order messaging failed:', err?.message || err)
  }

  res.status(201).json({ order: result.order })
})

/** Guest tracks an order by public code (optional phone check) */
router.get('/:slug/orders/:code', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  const order = getOrderByPublicCode(restaurant.id, req.params.code, {
    phone: req.query.phone,
  })
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order })
})

/** Guest order history by phone */
router.get('/:slug/order-history', (req, res) => {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })
  const phone = String(req.query.phone || '').trim()
  if (!phone) return res.status(400).json({ error: 'phone query parameter is required.' })
  const orders = listOrdersByPhone(restaurant.id, phone)
  res.json({ orders })
})

/**
 * AddPay/PayCloud server-to-server payment notification. No session, no
 * restaurant slug in the URL — the RSA signature (verified against AddPay's
 * Gateway Public Key) is what makes this endpoint trustworthy, matching the
 * IROAS LMS integration this was ported from. AddPay's webhook can post as
 * form-urlencoded or JSON depending on config, so both are parsed here
 * without touching the app-wide JSON-only body parser.
 */
router.post(
  '/payments/addpay/webhook',
  express.urlencoded({ extended: true }),
  (req, res) => {
    const payload = { ...req.query, ...(req.body || {}) }
    delete payload.slug

    const respondSuccess = () => res.type('text/plain').status(200).send('success')

    if (!verifyNotifySignature(payload, getPaymentSettings())) {
      // Don't leak *why* verification failed — just refuse quietly. AddPay
      // will retry; a wrong response here must never look like "accepted".
      return res.status(400).type('text/plain').send('invalid signature')
    }

    const orderRef = String(payload.merchant_order_no || '').trim()
    const transStatus = Number(payload.trans_status)
    const match = /^ONB-(\d+)-/.exec(orderRef)
    if (!match) return respondSuccess()

    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(Number(match[1]))
    if (!restaurant) return respondSuccess()

    const settings = parseSettings(restaurant)
    const pending = settings?.onboardingPayment
    // Reference must match the one we handed out for this checkout attempt —
    // guards against a stale/replayed webhook from an earlier retry.
    if (!pending || pending.reference !== orderRef) return respondSuccess()
    if (pending.paid) return respondSuccess() // already processed — idempotent

    if (transStatus === 3) {
      // Cancelled — clear the pending flag so the owner can retry.
      const nextSettings = { ...settings, onboardingPayment: { ...pending, pending: false, cancelledAt: new Date().toISOString() } }
      db.prepare(`UPDATE restaurants SET settings_json = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(nextSettings), restaurant.id)
      return respondSuccess()
    }

    if (transStatus !== 2) return respondSuccess() // not a completed payment yet

    const professionalEmail = settings.professionalEmail || restaurant.email || ''
    const payment = {
      ...pending,
      paid: true,
      pending: false,
      paidAt: new Date().toISOString(),
      addpayOrderNo: payload.order_no || null,
    }
    const nextSettings = { ...settings, onboardingPayment: payment }

    db.prepare(
      `UPDATE restaurants SET settings_json = ?, email = COALESCE(NULLIF(email, ''), ?),
       updated_at = datetime('now') WHERE id = ?`,
    ).run(JSON.stringify(nextSettings), professionalEmail || null, restaurant.id)

    const updated = { ...restaurant, email: restaurant.email || professionalEmail }
    sendOnboardingPaymentEmails({ restaurant: updated, payment }).catch(() => {})

    return respondSuccess()
  },
)

export default router
