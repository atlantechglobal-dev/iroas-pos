import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function getOwnRestaurant(ownerId) {
  return db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(ownerId)
}

router.use(requireAuth)

router.get('/', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  res.json({ restaurant })
})

router.put('/profile', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const {
    restaurantName,
    cuisine,
    description,
    country,
    timezone,
    hours,
  } = req.body || {}

  db.prepare(
    `UPDATE restaurants
     SET name = ?, cuisine = ?, description = ?, country = ?, timezone = ?,
         operating_hours = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    restaurantName ?? restaurant.name,
    cuisine ?? restaurant.cuisine,
    description ?? restaurant.description,
    country ?? restaurant.country,
    timezone ?? restaurant.timezone,
    hours ? JSON.stringify(hours) : restaurant.operating_hours,
    restaurant.id,
  )

  res.json({ ok: true })
})

router.put('/domain', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { subdomain, customDomain } = req.body || {}

  if (subdomain) {
    const taken = db
      .prepare('SELECT id FROM restaurants WHERE subdomain = ? AND id != ?')
      .get(subdomain, restaurant.id)
    if (taken) {
      return res.status(409).json({ error: 'That subdomain is already taken.' })
    }
  }

  db.prepare(
    `UPDATE restaurants SET subdomain = ?, custom_domain = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(subdomain ?? null, customDomain ?? null, restaurant.id)

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

router.post('/launch', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  if (!restaurant.name) {
    return res.status(400).json({ error: 'Complete the restaurant profile before launching.' })
  }

  db.prepare(
    `UPDATE restaurants SET status = 'live', launched_at = datetime('now'),
     updated_at = datetime('now') WHERE id = ?`,
  ).run(restaurant.id)

  res.json({ ok: true })
})

export default router
