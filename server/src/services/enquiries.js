import { db } from '../infra/db.js'
import { createNotification, queueEmail } from './identityService.js'
import { upsertGuest } from './guestRecords.js'

export class EnquiryError extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function parseSettings(restaurant) {
  try {
    return restaurant?.settings_json ? JSON.parse(restaurant.settings_json) : {}
  } catch {
    return {}
  }
}

/** A guest's message from the One Link page. Stored, added to the guest list, and the owner is told. */
export function submitEnquiry(restaurant, input = {}) {
  if (clean(input.website, 200)) return { id: null } // honeypot: bots fill hidden fields, people never see them
  const name = clean(input.name, 80)
  const email = clean(input.email, 120)
  const phone = clean(input.phone, 30)
  const message = String(input.message ?? '').trim().slice(0, 1000)
  if (!name) throw new EnquiryError('Please enter your name.')
  if (!email && !phone) throw new EnquiryError('Please enter an email address or a phone number so the restaurant can reply.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new EnquiryError('That email address does not look right.')
  if (phone && phone.replace(/\D/g, '').length < 7) throw new EnquiryError('That phone number does not look right.')
  if (message.length < 3) throw new EnquiryError('Please write a short message.')

  const id = Number(
    db
      .prepare('INSERT INTO enquiries (restaurant_id, name, email, phone, message) VALUES (?, ?, ?, ?, ?)')
      .run(restaurant.id, name, email || null, phone || null, message).lastInsertRowid,
  )
  if (phone) upsertGuest(restaurant.id, { name, phone, email })

  const title = `New enquiry from ${name}`
  const reach = [phone, email].filter(Boolean).join(' · ')
  createNotification({
    userId: restaurant.owner_id,
    type: 'enquiry',
    title,
    body: `${reach} — ${message.slice(0, 140)}`,
    meta: { enquiryId: id },
  })
  if (parseSettings(restaurant).emailNotifs !== false) {
    const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(restaurant.owner_id)
    const to = restaurant.email || owner?.email
    if (to) queueEmail({ to, subject: `${title} — ${restaurant.name || 'your restaurant'}`, body: `${name}\n${reach}\n\n${message}` })
  }
  return { id }
}

export function listEnquiries(restaurantId, limit = 20) {
  return db
    .prepare('SELECT id, name, email, phone, message, created_at AS createdAt FROM enquiries WHERE restaurant_id = ? ORDER BY id DESC LIMIT ?')
    .all(restaurantId, limit)
}
