import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  assertBookable,
  listSlots,
  maxCoversFromSettings,
  normalizeOperatingHours,
  parseHoursJson,
} from '../services/reservationAvailability.js'
import {
  onReservationCreated,
  onReservationStatusChange,
} from '../services/reservationMessaging.js'
import {
  assignTableForParty,
  assertTableAvailable,
  listDiningTables,
  upsertDiningTable,
} from '../services/diningTables.js'
import {
  getOrderById,
  listOrders,
  markOrderPaid,
  updateOrderStatus,
} from '../services/orders.js'
import {
  formatUserId,
  onboardingPlanAmount,
  professionalEmailForRestaurant,
  sendOnboardingPaymentEmails,
} from '../services/onboardingMessaging.js'
import { addpayRequest } from '../services/addpayClient.js'
import { getPaymentSettings } from '../services/paymentSettings.js'

const router = Router()

function getOwnRestaurant(ownerId) {
  return db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(ownerId)
}

router.use(requireAuth)

function parseSettings(restaurant) {
  if (!restaurant.settings_json) return {}
  try {
    return JSON.parse(restaurant.settings_json)
  } catch {
    return {}
  }
}

router.get('/', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }
  res.json({ restaurant: { ...restaurant, settings: parseSettings(restaurant) } })
})

router.put('/profile', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const {
    restaurantName,
    cuisine,
    description,
    phone,
    website,
    email,
    city,
    country,
    timezone,
    address,
    hours,
  } = req.body || {}

  db.prepare(
    `UPDATE restaurants
     SET name = ?, cuisine = ?, description = ?, phone = ?, website = ?, email = ?,
         city = ?, country = ?, timezone = ?, address = ?,
         operating_hours = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    restaurantName ?? restaurant.name,
    cuisine ?? restaurant.cuisine,
    description ?? restaurant.description,
    phone ?? restaurant.phone,
    website ?? restaurant.website,
    email ?? restaurant.email,
    city ?? restaurant.city,
    country ?? restaurant.country,
    timezone ?? restaurant.timezone,
    address ?? restaurant.address,
    hours
      ? JSON.stringify(normalizeOperatingHours(hours))
      : restaurant.operating_hours,
    restaurant.id,
  )

  res.json({ ok: true })
})

router.put('/domain', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { subdomain, customDomain, domainSuffix } = req.body || {}

  if (subdomain) {
    const taken = db
      .prepare('SELECT id FROM restaurants WHERE subdomain = ? AND id != ?')
      .get(subdomain, restaurant.id)
    if (taken) {
      return res.status(409).json({ error: 'That subdomain is already taken.' })
    }
  }

  const allowedSuffixes = new Set(['iroas.com', 'com', 'co.za'])
  const nextSuffix =
    domainSuffix && allowedSuffixes.has(String(domainSuffix).replace(/^\./, ''))
      ? String(domainSuffix).replace(/^\./, '')
      : restaurant.domain_suffix || 'iroas.com'

  db.prepare(
    `UPDATE restaurants SET subdomain = ?, custom_domain = ?, domain_suffix = ?,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(subdomain ?? null, customDomain ?? null, nextSuffix, restaurant.id)

  res.json({ ok: true })
})

router.put('/brand', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { primaryColor, secondaryColor, accentColor, font, theme, logoDataUrl } =
    req.body || {}

  db.prepare(
    `UPDATE restaurants
     SET primary_color = ?, secondary_color = ?, accent_color = ?, font = ?, theme = ?,
         logo_data_url = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    primaryColor ?? restaurant.primary_color,
    secondaryColor ?? restaurant.secondary_color,
    accentColor ?? restaurant.accent_color,
    font ?? restaurant.font,
    theme ?? restaurant.theme,
    logoDataUrl ?? restaurant.logo_data_url,
    restaurant.id,
  )

  res.json({ ok: true })
})

router.put('/settings', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const patch = req.body || {}
  const merged = { ...parseSettings(restaurant), ...patch }

  db.prepare(
    `UPDATE restaurants SET settings_json = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(merged), restaurant.id)

  res.json({ ok: true, settings: merged })
})

router.post('/launch', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  if (restaurant.status === 'live') {
    return res.json({ ok: true, status: 'live' })
  }

  if (restaurant.status === 'pending_approval') {
    return res.json({ ok: true, status: 'pending_approval' })
  }

  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }

  if (!restaurant.name) {
    return res.status(400).json({ error: 'Complete the restaurant profile before submitting.' })
  }

  if (!restaurant.subdomain && !restaurant.custom_domain) {
    return res.status(400).json({ error: 'Choose a web address before submitting.' })
  }

  db.prepare(
    `UPDATE restaurants SET status = 'pending_approval',
     submitted_at = datetime('now'),
     rejection_reason = NULL,
     rejected_at = NULL,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(restaurant.id)

  const settings = parseSettings(restaurant)
  const professionalEmail = professionalEmailForRestaurant(restaurant)
  if (professionalEmail && !restaurant.email) {
    db.prepare(`UPDATE restaurants SET email = ? WHERE id = ?`).run(professionalEmail, restaurant.id)
  }

  res.json({
    ok: true,
    status: 'pending_approval',
    userId: formatUserId(req.user.id),
    professionalEmail,
    paymentRequired: !settings?.onboardingPayment?.paid,
    amount: onboardingPlanAmount(restaurant.plan),
  })
})

router.get('/onboarding-payment', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }

  const settings = parseSettings(restaurant)
  const paid = Boolean(settings?.onboardingPayment?.paid)
  const professionalEmail =
    professionalEmailForRestaurant(restaurant) || String(restaurant.email || '').trim()

  res.json({
    restaurantName: restaurant.name,
    plan: restaurant.plan || 'starter',
    status: restaurant.status,
    amount: onboardingPlanAmount(restaurant.plan),
    currency: 'INR',
    userId: formatUserId(req.user.id),
    professionalEmail,
    ownerEmail: req.user.email || '',
    paid,
    payment: settings?.onboardingPayment || null,
  })
})

function appBaseUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/$/, '')
}

/**
 * Start a hosted AddPay checkout. We never collect card/UPI details
 * ourselves — the browser is redirected to AddPay's own page, and the
 * actual "paid" flag only ever gets set by the signed webhook below, never
 * by this request completing.
 */
router.post('/onboarding-payment', async (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }
  if (restaurant.status === 'onboarding') {
    return res.status(400).json({ error: 'Submit your store from Launch before paying.' })
  }

  const settings = parseSettings(restaurant)
  if (settings?.onboardingPayment?.paid) {
    const professionalEmail =
      professionalEmailForRestaurant(restaurant) || String(restaurant.email || '').trim()
    return res.json({
      ok: true,
      alreadyPaid: true,
      userId: formatUserId(req.user.id),
      professionalEmail,
      payment: settings.onboardingPayment,
    })
  }

  const amount = onboardingPlanAmount(restaurant.plan)
  const reference = `ONB-${restaurant.id}-${Date.now().toString(36).toUpperCase()}`
  const professionalEmail = professionalEmailForRestaurant(restaurant)
  const appBase = appBaseUrl()

  let checkout
  try {
    checkout = await addpayRequest(
      '/api/entry',
      {
        method: 'pay.paycloud.checkout',
        merchant_order_no: reference,
        order_amount: amount,
        price_currency: 'ZAR',
        notify_url: `${appBase}/api/public/payments/addpay/webhook`,
        return_url: `${appBase}/onboarding/payment?paid=return`,
        description: `IROAS launch — ${restaurant.name || 'your business'}`,
        expires: 300,
        term_ip: '127.0.0.1',
      },
      getPaymentSettings(),
    )
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || 'Unable to start payment.' })
  }

  let data = checkout.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      data = null
    }
  }
  const payUrl = data?.pay_url
  if (!payUrl) {
    return res.status(502).json({ error: 'AddPay did not return a payment URL.' })
  }

  const nextSettings = {
    ...settings,
    onboardingPayment: {
      paid: false,
      pending: true,
      reference,
      amount,
      currency: 'ZAR',
      gateway: 'addpay',
      createdAt: new Date().toISOString(),
    },
    professionalEmail,
  }

  db.prepare(
    `UPDATE restaurants SET settings_json = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(nextSettings), restaurant.id)

  res.json({ ok: true, payUrl, reference, amount, currency: 'ZAR' })
})

function mapReservation(row) {
  return {
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
  }
}

function mapReview(row) {
  return {
    id: row.id,
    author: row.author,
    rating: row.rating,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  }
}

router.get('/reservations', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const rows = db
    .prepare(
      `SELECT * FROM reservations
       WHERE restaurant_id = ?
       ORDER BY date ASC, time ASC, id DESC`,
    )
    .all(restaurant.id)

  res.json({ reservations: rows.map(mapReservation) })
})

router.get('/availability', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const date = String(req.query.date || '').trim()
  const guests = Math.max(1, Math.min(20, Number(req.query.guests) || 2))
  if (!date) return res.status(400).json({ error: 'date query parameter is required.' })

  const settings = parseSettings(restaurant)
  const hours = parseHoursJson(restaurant.operating_hours)
  const existing = db
    .prepare(
      `SELECT id, date, time, guests, status FROM reservations
       WHERE restaurant_id = ? AND date = ? AND status IN ('pending', 'confirmed')`,
    )
    .all(restaurant.id, date)

  const includePast =
    String(req.query.includePast || '') === '1' || String(req.query.includePast || '') === 'true'

  const result = listSlots({
    hours,
    date,
    guests,
    existingRows: existing,
    maxCovers: maxCoversFromSettings(settings),
    includePast,
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

router.post('/reservations', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { guestName, name, phone, email, guests, date, time, notes, status, tableId } =
    req.body || {}
  const guest = String(guestName || name || '').trim()
  if (!guest || !String(phone || '').trim() || !date || !time) {
    return res.status(400).json({ error: 'Guest name, phone, date and time are required.' })
  }

  const guestCount = Math.max(1, Math.min(20, Number(guests) || 2))
  const guestEmail = String(email || '').trim() || null
  const settings = parseSettings(restaurant)
  const hours = parseHoursJson(restaurant.operating_hours)
  const desiredStatus = ['pending', 'confirmed', 'cancelled'].includes(status)
    ? status
    : 'confirmed'

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

      let assignedTable =
        tableId != null && tableId !== ''
          ? Number(tableId)
          : assignTableForParty({
              restaurantId: restaurant.id,
              date: String(date),
              time: String(time),
              guests: guestCount,
            })

      if (tableId != null && tableId !== '') {
        const tableCheck = assertTableAvailable({
          restaurantId: restaurant.id,
          tableId: assignedTable,
          date: String(date),
          time: String(time),
          guests: guestCount,
        })
        if (!tableCheck.ok) {
          const err = new Error(tableCheck.error)
          err.status = tableCheck.status
          throw err
        }
      }

      const result = db
        .prepare(
          `INSERT INTO reservations
            (restaurant_id, guest_name, phone, guest_email, guests, date, time, notes, status, table_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          restaurant.id,
          guest,
          String(phone).trim(),
          guestEmail,
          guestCount,
          String(date),
          String(time),
          String(notes || '').trim() || null,
          desiredStatus,
          assignedTable || null,
        )
      insertedId = result.lastInsertRowid
    })
    run.immediate()
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unable to create booking.' })
  }

  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(insertedId)
  onReservationCreated(restaurant, row, { source: 'staff' })
  res.status(201).json({ reservation: mapReservation(row) })
})

router.patch('/reservations/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const row = db
    .prepare('SELECT * FROM reservations WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!row) return res.status(404).json({ error: 'Reservation not found.' })

  const { status, guestName, phone, email, guests, date, time, notes, tableId } = req.body || {}
  const nextStatus =
    status && ['pending', 'confirmed', 'cancelled'].includes(status) ? status : row.status
  const nextGuests =
    guests != null ? Math.max(1, Math.min(20, Number(guests) || 2)) : row.guests
  const nextDate = date != null ? String(date) : row.date
  const nextTime = time != null ? String(time) : row.time
  const nextName = guestName != null ? String(guestName).trim() : row.guest_name
  const nextPhone = phone != null ? String(phone).trim() : row.phone
  const nextEmail =
    email !== undefined ? String(email || '').trim() || null : row.guest_email
  const nextNotes =
    notes !== undefined ? String(notes || '').trim() || null : row.notes

  const needsCapacityCheck =
    nextStatus !== 'cancelled' &&
    (nextStatus === 'confirmed' ||
      nextDate !== row.date ||
      nextTime !== row.time ||
      nextGuests !== row.guests ||
      (row.status === 'cancelled' && nextStatus !== 'cancelled'))

  try {
    const run = db.transaction(() => {
      if (needsCapacityCheck) {
        const settings = parseSettings(restaurant)
        const hours = parseHoursJson(restaurant.operating_hours)
        const existing = db
          .prepare(
            `SELECT id, date, time, guests, status FROM reservations
             WHERE restaurant_id = ? AND date = ? AND status IN ('pending', 'confirmed')`,
          )
          .all(restaurant.id, nextDate)

        const check = assertBookable({
          hours,
          date: nextDate,
          time: nextTime,
          guests: nextGuests,
          existingRows: existing,
          maxCovers: maxCoversFromSettings(settings),
          excludeReservationId: row.id,
        })
        if (!check.ok) {
          const err = new Error(check.error)
          err.status = check.status
          throw err
        }
      }

      let nextTableId =
        tableId !== undefined
          ? tableId === null || tableId === ''
            ? null
            : Number(tableId)
          : row.table_id

      if (
        nextTableId == null &&
        nextStatus !== 'cancelled' &&
        (nextDate !== row.date || nextTime !== row.time || nextGuests !== row.guests)
      ) {
        nextTableId = assignTableForParty({
          restaurantId: restaurant.id,
          date: nextDate,
          time: nextTime,
          guests: nextGuests,
          excludeReservationId: row.id,
        })
      }

      if (nextTableId != null && nextStatus !== 'cancelled') {
        const tableCheck = assertTableAvailable({
          restaurantId: restaurant.id,
          tableId: nextTableId,
          date: nextDate,
          time: nextTime,
          guests: nextGuests,
          excludeReservationId: row.id,
        })
        if (!tableCheck.ok) {
          const err = new Error(tableCheck.error)
          err.status = tableCheck.status
          throw err
        }
      }

      db.prepare(
        `UPDATE reservations
         SET guest_name = ?, phone = ?, guest_email = ?, guests = ?, date = ?, time = ?,
             notes = ?, status = ?, table_id = ?
         WHERE id = ?`,
      ).run(
        nextName,
        nextPhone,
        nextEmail,
        nextGuests,
        nextDate,
        nextTime,
        nextNotes,
        nextStatus,
        nextTableId,
        row.id,
      )
    })
    run.immediate()
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unable to update booking.' })
  }

  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)
  onReservationStatusChange(restaurant, row, updated)
  res.json({ reservation: mapReservation(updated) })
})

router.get('/tables', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  res.json({ tables: listDiningTables(restaurant.id) })
})

router.post('/tables', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const result = upsertDiningTable(restaurant.id, req.body || {})
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.status(201).json({ table: result.table })
})

router.patch('/tables/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const result = upsertDiningTable(restaurant.id, { ...(req.body || {}), id: Number(req.params.id) })
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.json({ table: result.table })
})

router.delete('/tables/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const existing = db
    .prepare('SELECT id FROM dining_tables WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!existing) return res.status(404).json({ error: 'Table not found.' })
  db.prepare('UPDATE dining_tables SET active = 0 WHERE id = ?').run(existing.id)
  db.prepare('UPDATE reservations SET table_id = NULL WHERE table_id = ?').run(existing.id)
  res.json({ ok: true })
})

router.get('/orders', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const orders = listOrders(restaurant.id, {
    status: req.query.status,
    paymentStatus: req.query.paymentStatus,
    serviceMode: req.query.serviceMode,
  })
  res.json({ orders })
})

router.get('/orders/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const order = getOrderById(restaurant.id, Number(req.params.id))
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order })
})

router.patch('/orders/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const { status } = req.body || {}
  if (!status) return res.status(400).json({ error: 'status is required.' })
  const result = updateOrderStatus(restaurant.id, Number(req.params.id), status)
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.json({ order: result.order })
})

router.post('/orders/:id/mark-paid', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const result = markOrderPaid(restaurant.id, Number(req.params.id), {
    paymentMethod: req.body?.paymentMethod,
  })
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.json({ order: result.order })
})

router.get('/reviews', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const rows = db
    .prepare(
      `SELECT * FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC`,
    )
    .all(restaurant.id)

  res.json({ reviews: rows.map(mapReview) })
})

router.post('/reviews', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { author, rating, body, status } = req.body || {}
  if (!String(author || '').trim() || !String(body || '').trim()) {
    return res.status(400).json({ error: 'Author and review text are required.' })
  }

  const result = db
    .prepare(
      `INSERT INTO reviews (restaurant_id, author, rating, body, status)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      restaurant.id,
      String(author).trim(),
      Math.max(1, Math.min(5, Number(rating) || 5)),
      String(body).trim(),
      status === 'hidden' ? 'hidden' : 'published',
    )

  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ review: mapReview(row) })
})

router.patch('/reviews/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const row = db
    .prepare('SELECT * FROM reviews WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!row) return res.status(404).json({ error: 'Review not found.' })

  const { status, author, rating, body } = req.body || {}
  const nextStatus =
    status && ['published', 'hidden'].includes(status) ? status : row.status

  db.prepare(
    `UPDATE reviews SET author = ?, rating = ?, body = ?, status = ? WHERE id = ?`,
  ).run(
    author != null ? String(author).trim() : row.author,
    rating != null ? Math.max(1, Math.min(5, Number(rating) || 5)) : row.rating,
    body != null ? String(body).trim() : row.body,
    nextStatus,
    row.id,
  )

  const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(row.id)
  res.json({ review: mapReview(updated) })
})

export default router
