import { db } from '../infra/db.js'

/** Same national number in any format (+27…, 0…, spaces) maps to one key. */
export function phoneKey(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits.length > 9 ? digits.slice(-9) : digits
}

/** Creates the guest on their first booking; later bookings fill in missing details. */
export function upsertGuest(restaurantId, { name, phone, email }) {
  const key = phoneKey(phone)
  if (!key) return null
  const cleanName = String(name || '').trim()
  const cleanEmail = String(email || '').trim() || null
  db.prepare(
    `INSERT INTO guests (restaurant_id, phone_key, phone, name, email)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (restaurant_id, phone_key) DO UPDATE SET
       name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE guests.name END,
       email = COALESCE(excluded.email, guests.email)`,
  ).run(restaurantId, key, String(phone).trim(), cleanName, cleanEmail)
  return key
}

/** Guests of one restaurant with booking history counted from its reservations. */
export function listGuests(restaurantId) {
  const reservations = db
    .prepare(
      `SELECT guest_name, phone, guest_email, date, status FROM reservations
       WHERE restaurant_id = ? ORDER BY date ASC, id ASC`,
    )
    .all(restaurantId)
  for (const r of reservations) {
    upsertGuest(restaurantId, { name: r.guest_name, phone: r.phone, email: r.guest_email })
  }

  const stats = new Map()
  for (const r of reservations) {
    const key = phoneKey(r.phone)
    const s = stats.get(key) || { bookings: 0, visits: 0, noShows: 0, cancellations: 0, lastBooking: null }
    s.bookings += 1
    if (r.status === 'completed' || r.status === 'seated') s.visits += 1
    if (r.status === 'no_show') s.noShows += 1
    if (r.status === 'cancelled') s.cancellations += 1
    if (!s.lastBooking || r.date > s.lastBooking) s.lastBooking = r.date
    stats.set(key, s)
  }

  return db
    .prepare('SELECT phone_key, phone, name, email, created_at FROM guests WHERE restaurant_id = ? ORDER BY id DESC')
    .all(restaurantId)
    .map((g) => ({
      key: g.phone_key,
      name: g.name || g.phone,
      phone: g.phone,
      email: g.email || '',
      since: g.created_at,
      bookings: 0,
      visits: 0,
      noShows: 0,
      cancellations: 0,
      lastBooking: null,
      ...stats.get(g.phone_key),
    }))
}
