import { randomBytes } from 'node:crypto'
import express, { Router } from 'express'
import { db } from '../../infra/db.js'
import {
  ACTIVE_STATUS_SQL,
  assertBookable,
  bookingRules,
  listSlots,
  maxCoversFromSettings,
  parseHoursJson,
  parseTimeToMinutes,
  zonedNow,
} from '../../services/reservationAvailability.js'
import { onReservationCreated, onReservationStatusChange } from '../../services/reservationMessaging.js'
import { assignTableForParty } from '../../services/diningTables.js'
import {
  createGuestOrder,
  findTableByPublicCode,
  getOrderByPublicCode,
  listOrdersByPhone,
} from '../../services/orders.js'
import { onOrderCreated } from '../../services/orderMessaging.js'
import { listDiningTables } from '../../services/diningTables.js'
import { verifyNotifySignature } from '../../services/addpayClient.js'
import { getPaymentSettings } from '../../services/paymentSettings.js'
import { finalizeOnboardingPayment, parseRestaurantSettings } from '../../services/onboardingPayment.js'
import { getPublishedAdminCardBySlug } from '../../services/platformAdminService.js'
import { rateLimit } from '../../middleware/rateLimit.js'
import { UryError } from '../../integrations/ury/uryClient.js'
import { IntegrationError, resolveUryTenant } from '../../integrations/ury/uryTenant.js'
import { getUryFeatures, getUryPublicSite } from '../../integrations/ury/uryPublic.js'
import { toSiteHours } from '../../integrations/ury/uryHours.js'
import { GuestOrderError, getGuestOrder, requestGuestBill, submitGuestOrder } from '../../integrations/ury/urySelfOrdering.js'
import { resolveUryTableCode } from '../../integrations/ury/uryTableQr.js'
import { findGuestAccountCustomer, getUryOrderByInvoiceAndPhone, listUryOrdersByPhone } from '../../integrations/ury/uryOrders.js'
import { attachKitchenProgress } from '../../integrations/ury/uryKitchenFlow.js'
import { findOrCreateUryCustomer, OrderingError, placeUryOrder } from '../../integrations/ury/uryOrdering.js'
import { groupDineTables, listUryTables } from '../../integrations/ury/uryTables.js'

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

/** Super-admin / platform professional business card (public share link). */
router.get('/platform-card/:slug', (req, res) => {
  const entry = getPublishedAdminCardBySlug(req.params.slug)
  if (!entry) return res.status(404).json({ error: 'Card not found.' })
  res.json({
    type: 'platform_admin',
    orgName: entry.orgName || 'IROAS',
    theme: entry.theme || 'lime',
    layout: entry.layout || 'split-gold',
    publicSlug: entry.publicSlug || req.params.slug,
    card: entry.card || {},
    admin: entry.admin || null,
  })
})

/** Hours and contact on the public site. URY wins when it has them; otherwise the IROAS profile is shown. */
function applyUrySiteFields(fields, ury) {
  if (!ury) return fields
  const next = { ...fields }
  if (ury.features.hours && ury.hours?.status === 'ok') {
    next.hours = toSiteHours(ury.hours.weekly)
  }
  if (ury.features.contact && ury.contact?.status === 'ok') {
    for (const key of ['phone', 'email', 'address', 'city', 'country']) next[key] = ury.contact[key] || ''
  }
  return next
}

/** Public restaurant site payload (images as URLs, not base64) */
router.get('/:slug', async (req, res, next) => {
  try {
    await sendPublicSite(req, res)
  } catch (err) {
    next(err)
  }
})

async function sendPublicSite(req, res) {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' })
  const ury = await getUryPublicSite(restaurant.id)

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

  const contactFields = applyUrySiteFields(
    {
      phone: restaurant.phone || '',
      email: restaurant.email || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      country: restaurant.country || '',
      hours: parseHours(restaurant),
    },
    ury,
  )

  res.json({
    restaurant: {
      name: restaurant.name,
      slug,
      cuisine: restaurant.cuisine || '',
      description: restaurant.description || '',
      tagline: settings.tagline || '',
      website: restaurant.website || '',
      ...contactFields,
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
    ...(ury ? { ury } : {}),
  })
}

const uryOrderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many order attempts. Please wait a moment and try again.',
})

function sendGuestOrderError(res, err, restaurantId) {
  if (err instanceof GuestOrderError || err instanceof OrderingError) {
    return res.status(err.status).json({ success: false, code: err.code, error: err.message })
  }
  if (err instanceof IntegrationError) {
    console.warn(`[public-ury-orders] restaurant=${restaurantId} ${err.code}${err.reason ? ` reason=${err.reason}` : ''}`)
    return res.status(503).json({ success: false, code: 'ordering_unavailable', error: 'Online ordering is currently unavailable.' })
  }
  if (err instanceof UryError) {
    console.warn(`[public-ury-orders] restaurant=${restaurantId} ury_error=${err.code}`)
    return res.status(502).json({
      success: false,
      code: 'pos_unavailable',
      error: 'We could not reach the restaurant’s POS. Please try again.',
    })
  }
  console.error('[public-ury-orders]', err)
  return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
}

/** Resolves the live restaurant and its verified URY tenant when guest ordering is switched on. */
async function guestOrderingTenant(req, res) {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  if (!restaurant) {
    res.status(404).json({ success: false, error: 'Restaurant not found.' })
    return null
  }
  if (!getUryFeatures(restaurant.id)?.guestOrdering) {
    res.status(404).json({ success: false, code: 'ordering_unavailable', error: 'Online ordering is not available.' })
    return null
  }
  return { restaurant, tenant: await resolveUryTenant(restaurant.id) }
}

/** URY rooms and tables for the website dine-in picker (same list the POS Select Table dialog uses). */
router.get('/:slug/ury-dine-tables', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const rooms = groupDineTables(await listUryTables(ctx.tenant))
    res.json({ success: true, data: { rooms } })
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

/** New dine-in order through URY sync_order. A free table becomes occupied; the guest is the POS customer. */
router.post('/:slug/ury-dine-orders', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const { table, guestName, guestPhone, items, pax } = req.body || {}
    const customer = await findOrCreateUryCustomer(ctx.tenant, { name: guestName, phone: guestPhone })
    const placed = await placeUryOrder(ctx.tenant, {
      table,
      customer: customer.id,
      items,
      pax,
    })
    console.info(
      `[public-ury-dine] restaurant=${restaurantId} invoice=${placed.invoice || '?'} table=${placed.table} customer=${customer.id}`,
    )
    res.status(201).json({
      success: true,
      data: {
        status: 'placed',
        invoice: placed.invoice,
        table: placed.table,
        customer: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        orderType: 'Dine In',
        occupied: true,
      },
    })
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

/** Guest pickup order placed in URY (self-ordering). Retries reuse submissionId. */
router.post('/:slug/ury-orders', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const { submissionId, items, guestName, guestPhone, tableCode } = req.body || {}
    let table = null
    if (tableCode) {
      table = (await resolveUryTableCode(ctx.tenant, tableCode))?.name || null
      if (!table) return res.status(404).json({ success: false, code: 'table_not_found', error: 'This table QR code is not valid. Please ask the staff.' })
    }
    const result = await submitGuestOrder(ctx.tenant, { submissionId, items, guestName, guestPhone, table })
    const data = result.body.data
    console.info(
      `[public-ury-orders] restaurant=${restaurantId} submission=${data?.submissionId || '?'} status=${data?.status || result.body.code}` +
        `${table ? ` table=${table}` : ''}${data?.invoice ? ` invoice=${data.invoice}` : ''}`,
    )
    res.status(result.httpStatus).json(result.body)
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

/** Resolves a scanned URY table QR code (signed by IROAS) to the table, re-checked in URY. */
router.get('/:slug/ury-table/:code', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const table = await resolveUryTableCode(ctx.tenant, req.params.code)
    if (!table) return res.status(404).json({ success: false, code: 'table_not_found', error: 'This table QR code is not valid. Please ask the staff.' })
    res.json({ success: true, data: { table: { ...table, code: req.params.code } } })
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

router.get('/:slug/ury-orders/:submissionId', async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const result = await getGuestOrder(ctx.tenant, req.params.submissionId)
    res.status(result.httpStatus === 201 ? 200 : result.httpStatus).json(result.body)
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

function mapAccountOrders(orders) {
  return orders.map((o) => ({
    id: o.id,
    state: o.state,
    posStatus: o.posStatus,
    orderType: o.orderType,
    table: o.table,
    customerId: o.customerId || '',
    customer: o.customer,
    total: o.total,
    currency: o.currency,
    postedAt: o.postedAt,
    kitchenStep: o.kitchenStep || null,
    kitchenLabel: o.kitchenLabel || null,
    paymentLabel:
      o.state === 'paid' ? 'Paid' : o.state === 'draft' ? 'Draft · unpaid' : o.state === 'unbilled' ? 'Unbilled · unpaid' : o.posStatus,
  }))
}

/**
 * Guest Track: POS Invoice id (e.g. UDT-SA-00005) + phone from checkout.
 * Returns the same shape as Account order rows, plus line items.
 */
router.get('/:slug/ury-track', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const invoice = String(req.query.invoice || req.query.code || '').trim()
    const phone = String(req.query.phone || '').trim()
    if (!invoice) {
      return res.status(400).json({ success: false, code: 'invalid_invoice', error: 'Enter your order number (e.g. UDT-SA-00005).' })
    }
    if (phone.replace(/\D/g, '').length < 7) {
      return res.status(400).json({ success: false, code: 'invalid_phone', error: 'Enter the phone number used at checkout.' })
    }
    const found = await getUryOrderByInvoiceAndPhone(ctx.tenant, invoice, phone)
    if (!found) {
      return res.status(404).json({
        success: false,
        code: 'order_not_found',
        error: 'No POS order matches that number and phone.',
      })
    }
    const [order] = attachKitchenProgress(restaurantId, [found])
    res.json({
      success: true,
      data: {
        ...order,
        paymentLabel:
          order.state === 'paid'
            ? 'Paid'
            : order.state === 'draft'
              ? 'Draft · unpaid'
              : order.state === 'unbilled'
                ? 'Unbilled · unpaid'
                : order.posStatus,
      },
    })
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

/** Guest Account: look up POS customer + invoices by phone (no create). */
router.get('/:slug/ury-account', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const phone = String(req.query.phone || '').trim()
    const customerId = String(req.query.customerId || '').trim()
    if (phone.replace(/\D/g, '').length < 7) {
      return res.status(400).json({ success: false, code: 'invalid_phone', error: 'Enter the phone number used on your orders.' })
    }
    const customer = await findGuestAccountCustomer(ctx.tenant, phone, customerId)
    const rawOrders = customer
      ? await listUryOrdersByPhone(ctx.tenant, customer.phone || phone, { customerId: customer.id })
      : []
    const orders = attachKitchenProgress(restaurantId, rawOrders)
    res.json({
      success: true,
      data: {
        phone,
        customer: customer
          ? { id: customer.id, name: customer.name, phone: customer.phone, created: false }
          : null,
        orders: mapAccountOrders(orders),
      },
    })
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

/**
 * Create or open a guest POS account (URY Customer) for this restaurant’s website.
 * Same create_customer path as staff; rate-limited. Does not change IROAS login/signup.
 */
router.post('/:slug/ury-account', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const name = String(req.body?.name || '').trim()
    const phone = String(req.body?.phone || '').trim()
    let customer
    try {
      customer = await findOrCreateUryCustomer(ctx.tenant, { name, phone })
    } catch (err) {
      if (err instanceof OrderingError) {
        return res.status(err.status).json({ success: false, code: err.code, error: err.message })
      }
      throw err
    }
    const orders = attachKitchenProgress(
      restaurantId,
      await listUryOrdersByPhone(ctx.tenant, customer.phone || phone, { customerId: customer.id }),
    )
    console.info(
      `[public-ury-account] restaurant=${restaurantId} customer=${customer.id}${customer.created ? ' created' : ' existing'}`,
    )
    res.status(customer.created ? 201 : 200).json({
      success: true,
      data: {
        customer: { id: customer.id, name: customer.name, phone: customer.phone, created: customer.created },
        orders: mapAccountOrders(orders),
      },
    })
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
})

/** Guest asks URY to prepare the bill (Draft/Unbilled → ready for Payment in POS). */
router.post('/:slug/ury-orders/:submissionId/request-bill', uryOrderLimiter, async (req, res) => {
  let restaurantId = null
  try {
    const ctx = await guestOrderingTenant(req, res)
    if (!ctx) return
    restaurantId = ctx.restaurant.id
    const result = await requestGuestBill(ctx.tenant, req.params.submissionId)
    console.info(
      `[public-ury-orders] restaurant=${restaurantId} submission=${req.params.submissionId} action=request_bill` +
        `${result.body?.data?.invoice ? ` invoice=${result.body.data.invoice}` : ''}`,
    )
    res.status(result.httpStatus === 201 ? 200 : result.httpStatus).json(result.body)
  } catch (err) {
    sendGuestOrderError(res, err, restaurantId)
  }
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
       WHERE restaurant_id = ? AND date = ? AND status IN (${ACTIVE_STATUS_SQL})`,
    )
    .all(restaurant.id, date)

  const result = listSlots({
    hours,
    date,
    guests,
    existingRows: existing,
    maxCovers: maxCoversFromSettings(settings),
    ...bookingRules(restaurant, settings),
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
           WHERE restaurant_id = ? AND date = ? AND status IN (${ACTIVE_STATUS_SQL})`,
        )
        .all(restaurant.id, String(date))

      const check = assertBookable({
        hours,
        date: String(date),
        time: String(time),
        guests: guestCount,
        existingRows: existing,
        maxCovers: maxCoversFromSettings(settings),
        ...bookingRules(restaurant, settings),
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
            (restaurant_id, guest_name, phone, guest_email, guests, date, time, notes, status, table_id, cancel_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
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
          randomBytes(16).toString('hex'),
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
      cancelToken: row.cancel_token,
    },
  })
})

function guestBookingView(restaurant, row) {
  const start = parseTimeToMinutes(row.time)
  const zoned = zonedNow(restaurant.timezone)
  const started =
    row.date < zoned.date || (row.date === zoned.date && start != null && start <= zoned.minutes)
  return {
    restaurantName: restaurant.name,
    guestName: row.guest_name,
    guests: row.guests,
    date: row.date,
    time: row.time,
    status: row.status,
    canCancel: ['pending', 'confirmed'].includes(row.status) && !started,
  }
}

function findGuestBooking(req) {
  const restaurant = findRestaurantBySlug(req.params.slug, { liveOnly: true })
  const token = String(req.params.token || '')
  if (!restaurant || !/^[0-9a-f]{32}$/.test(token)) return {}
  const row = db
    .prepare('SELECT * FROM reservations WHERE cancel_token = ? AND restaurant_id = ?')
    .get(token, restaurant.id)
  return { restaurant, row }
}

/** Guest looks at their booking through the link in the confirmation message. */
router.get('/:slug/bookings/:token', (req, res) => {
  const { restaurant, row } = findGuestBooking(req)
  if (!row) return res.status(404).json({ error: 'Booking not found.' })
  res.json({ booking: guestBookingView(restaurant, row) })
})

router.post('/:slug/bookings/:token/cancel', (req, res) => {
  const { restaurant, row } = findGuestBooking(req)
  if (!row) return res.status(404).json({ error: 'Booking not found.' })
  if (!guestBookingView(restaurant, row).canCancel) {
    return res.status(409).json({ error: 'This booking can no longer be cancelled online. Please call the restaurant.' })
  }
  db.prepare(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`).run(row.id)
  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)
  onReservationStatusChange(restaurant, row, updated, { byGuest: true })
  res.json({ booking: guestBookingView(restaurant, updated) })
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
  async (req, res) => {
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

    const settings = parseRestaurantSettings(restaurant)
    const pending = settings?.onboardingPayment
    // Reference must match the one we handed out for this checkout attempt —
    // guards against a stale/replayed webhook from an earlier retry.
    if (!pending || pending.reference !== orderRef) return respondSuccess()
    if (pending.paid) return respondSuccess() // already processed — idempotent

    if (transStatus === 3) {
      // Cancelled — clear the pending flag so the owner can retry.
      const nextSettings = {
        ...settings,
        onboardingPayment: {
          ...pending,
          pending: false,
          cancelledAt: new Date().toISOString(),
        },
      }
      db.prepare(`UPDATE restaurants SET settings_json = ?, updated_at = datetime('now') WHERE id = ?`).run(
        JSON.stringify(nextSettings),
        restaurant.id,
      )
      return respondSuccess()
    }

    if (transStatus !== 2) return respondSuccess() // not a completed payment yet

    try {
      await finalizeOnboardingPayment(restaurant, {
        reference: orderRef,
        amount: pending.amount,
        currency: pending.currency || 'ZAR',
        addpayOrderNo: payload.order_no || null,
        method: 'addpay',
        gateway: 'addpay',
      })
    } catch (err) {
      console.error('[addpay webhook] finalize failed:', err.message || err)
      return res.status(500).type('text/plain').send('error')
    }

    return respondSuccess()
  },
)

export default router
