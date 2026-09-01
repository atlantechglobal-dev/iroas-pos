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

const VALID_DOMAIN_SUFFIXES = ['.iroas.com', '.iroas.co.za']

router.put('/domain', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { subdomain, customDomain, domainSuffix } = req.body || {}
  const suffix = VALID_DOMAIN_SUFFIXES.includes(domainSuffix)
    ? domainSuffix
    : restaurant.domain_suffix || '.iroas.com'

  if (subdomain) {
    const taken = db
      .prepare(
        'SELECT id FROM restaurants WHERE subdomain = ? AND domain_suffix = ? AND id != ?',
      )
      .get(subdomain, suffix, restaurant.id)
    if (taken) {
      return res.status(409).json({ error: 'That subdomain is already taken.' })
    }
  }

  db.prepare(
    `UPDATE restaurants SET subdomain = ?, domain_suffix = ?, custom_domain = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(subdomain ?? null, suffix, customDomain ?? null, restaurant.id)

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

export default router
