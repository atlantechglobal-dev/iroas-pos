import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

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
    hours ? JSON.stringify(hours) : restaurant.operating_hours,
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

  if (!restaurant.name) {
    return res.status(400).json({ error: 'Complete the restaurant profile before launching.' })
  }

  if (!restaurant.subdomain && !restaurant.custom_domain) {
    return res.status(400).json({ error: 'Choose a web address before launching.' })
  }

  db.prepare(
    `UPDATE restaurants SET status = 'live', launched_at = datetime('now'),
     updated_at = datetime('now') WHERE id = ?`,
  ).run(restaurant.id)

  res.json({ ok: true })
})

function mapReservation(row) {
  return {
    id: row.id,
    guestName: row.guest_name,
    phone: row.phone,
    guests: row.guests,
    date: row.date,
    time: row.time,
    notes: row.notes || '',
    status: row.status,
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

router.post('/reservations', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { guestName, name, phone, guests, date, time, notes, status } = req.body || {}
  const guest = String(guestName || name || '').trim()
  if (!guest || !String(phone || '').trim() || !date || !time) {
    return res.status(400).json({ error: 'Guest name, phone, date and time are required.' })
  }

  const result = db
    .prepare(
      `INSERT INTO reservations
        (restaurant_id, guest_name, phone, guests, date, time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      restaurant.id,
      guest,
      String(phone).trim(),
      Math.max(1, Math.min(20, Number(guests) || 2)),
      String(date),
      String(time),
      String(notes || '').trim() || null,
      ['pending', 'confirmed', 'cancelled'].includes(status) ? status : 'confirmed',
    )

  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ reservation: mapReservation(row) })
})

router.patch('/reservations/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const row = db
    .prepare('SELECT * FROM reservations WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!row) return res.status(404).json({ error: 'Reservation not found.' })

  const { status, guestName, phone, guests, date, time, notes } = req.body || {}
  const nextStatus =
    status && ['pending', 'confirmed', 'cancelled'].includes(status) ? status : row.status

  db.prepare(
    `UPDATE reservations
     SET guest_name = ?, phone = ?, guests = ?, date = ?, time = ?, notes = ?, status = ?
     WHERE id = ?`,
  ).run(
    guestName != null ? String(guestName).trim() : row.guest_name,
    phone != null ? String(phone).trim() : row.phone,
    guests != null ? Math.max(1, Math.min(20, Number(guests) || 2)) : row.guests,
    date != null ? String(date) : row.date,
    time != null ? String(time) : row.time,
    notes !== undefined ? String(notes || '').trim() || null : row.notes,
    nextStatus,
    row.id,
  )

  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)
  res.json({ reservation: mapReservation(updated) })
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
