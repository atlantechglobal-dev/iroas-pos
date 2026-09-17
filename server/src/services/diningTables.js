import { db } from '../db.js'
import { DEFAULT_DWELL_MINUTES, parseTimeToMinutes } from './reservationAvailability.js'

export function listDiningTables(restaurantId) {
  return db
    .prepare(
      `SELECT id, restaurant_id AS restaurantId, name, seats, zone, sort_order AS sortOrder,
              active, public_code AS publicCode, created_at AS createdAt
       FROM dining_tables
       WHERE restaurant_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(restaurantId)
}

function ensurePublicCode(id) {
  const code = `t${id}${Math.random().toString(36).slice(2, 6)}`
  db.prepare('UPDATE dining_tables SET public_code = ? WHERE id = ?').run(code, id)
  return code
}

export function upsertDiningTable(restaurantId, payload = {}) {
  const name = String(payload.name || '').trim()
  if (!name) {
    return { ok: false, status: 400, error: 'Table name is required.' }
  }
  const seats = Math.max(1, Math.min(40, Number(payload.seats) || 2))
  const zone = String(payload.zone || '').trim() || null
  const active = payload.active === false || payload.active === 0 ? 0 : 1
  const sortOrder = Number.isFinite(Number(payload.sortOrder))
    ? Number(payload.sortOrder)
    : Number(payload.sort_order) || 0

  if (payload.id) {
    const existing = db
      .prepare('SELECT id FROM dining_tables WHERE id = ? AND restaurant_id = ?')
      .get(payload.id, restaurantId)
    if (!existing) return { ok: false, status: 404, error: 'Table not found.' }
    db.prepare(
      `UPDATE dining_tables
       SET name = ?, seats = ?, zone = ?, sort_order = ?, active = ?
       WHERE id = ?`,
    ).run(name, seats, zone, sortOrder, active, payload.id)
    return {
      ok: true,
      table: listDiningTables(restaurantId).find((t) => t.id === Number(payload.id)),
    }
  }

  const maxSort = db
    .prepare(
      `SELECT COALESCE(MAX(sort_order), -1) AS m FROM dining_tables WHERE restaurant_id = ?`,
    )
    .get(restaurantId)
  const nextSort = payload.sortOrder != null ? sortOrder : (maxSort?.m ?? -1) + 1
  const info = db
    .prepare(
      `INSERT INTO dining_tables (restaurant_id, name, seats, zone, sort_order, active, public_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(restaurantId, name, seats, zone, nextSort, active, `tmp${Date.now()}`)

  const newId = Number(info.lastInsertRowid)
  ensurePublicCode(newId)

  return {
    ok: true,
    table: listDiningTables(restaurantId).find((t) => t.id === newId),
  }
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Prefer smallest active table that fits the party and is free for the dwell window.
 * Returns table id or null (caller falls back to covers-only).
 */
export function assignTableForParty({
  restaurantId,
  date,
  time,
  guests,
  excludeReservationId = null,
  dwellMinutes = DEFAULT_DWELL_MINUTES,
}) {
  const party = Math.max(1, Number(guests) || 1)
  const start = parseTimeToMinutes(time)
  if (start == null) return null
  const end = start + dwellMinutes

  const tables = db
    .prepare(
      `SELECT id, seats FROM dining_tables
       WHERE restaurant_id = ? AND active = 1 AND seats >= ?
       ORDER BY seats ASC, sort_order ASC, id ASC`,
    )
    .all(restaurantId, party)

  if (!tables.length) return null

  const bookings = db
    .prepare(
      `SELECT id, table_id, time, guests, status FROM reservations
       WHERE restaurant_id = ? AND date = ? AND status IN ('pending', 'confirmed')
         AND table_id IS NOT NULL`,
    )
    .all(restaurantId, String(date))
    .filter((r) =>
      excludeReservationId == null ? true : Number(r.id) !== Number(excludeReservationId),
    )

  for (const table of tables) {
    const conflict = bookings.some((b) => {
      if (Number(b.table_id) !== Number(table.id)) return false
      const bStart = parseTimeToMinutes(b.time)
      if (bStart == null) return false
      return intervalsOverlap(start, end, bStart, bStart + dwellMinutes)
    })
    if (!conflict) return table.id
  }

  return null
}

/**
 * Ensure a specific table is free for the dwell window (manual assign).
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function assertTableAvailable({
  restaurantId,
  tableId,
  date,
  time,
  guests = 2,
  excludeReservationId = null,
  dwellMinutes = DEFAULT_DWELL_MINUTES,
}) {
  if (tableId == null || tableId === '') return { ok: true }

  const id = Number(tableId)
  if (!Number.isFinite(id)) {
    return { ok: false, status: 400, error: 'Invalid table.' }
  }

  const table = db
    .prepare(
      `SELECT id, name, seats, active FROM dining_tables
       WHERE id = ? AND restaurant_id = ?`,
    )
    .get(id, restaurantId)
  if (!table || table.active === 0) {
    return { ok: false, status: 404, error: 'Table not found.' }
  }

  const party = Math.max(1, Number(guests) || 1)
  if (party > Number(table.seats)) {
    return {
      ok: false,
      status: 409,
      error: `${table.name} seats ${table.seats} — too small for a party of ${party}.`,
    }
  }

  const start = parseTimeToMinutes(time)
  if (start == null) {
    return { ok: false, status: 400, error: 'Invalid time.' }
  }
  const end = start + dwellMinutes

  const bookings = db
    .prepare(
      `SELECT id, time FROM reservations
       WHERE restaurant_id = ? AND date = ? AND table_id = ?
         AND status IN ('pending', 'confirmed')`,
    )
    .all(restaurantId, String(date), id)
    .filter((r) =>
      excludeReservationId == null ? true : Number(r.id) !== Number(excludeReservationId),
    )

  const conflict = bookings.some((b) => {
    const bStart = parseTimeToMinutes(b.time)
    if (bStart == null) return false
    return intervalsOverlap(start, end, bStart, bStart + dwellMinutes)
  })

  if (conflict) {
    return {
      ok: false,
      status: 409,
      error: `${table.name} is already booked for that time. Choose another table or slot.`,
    }
  }

  return { ok: true }
}
