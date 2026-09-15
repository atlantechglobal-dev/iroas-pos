/** Shared reservation slot + covers capacity helpers. */

export const DEFAULT_MAX_COVERS = 40
export const DEFAULT_SLOT_MINUTES = 30
export const DEFAULT_DWELL_MINUTES = 90

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function parseHoursJson(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function maxCoversFromSettings(settings) {
  const n = Number(settings?.reservationMaxCovers)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  return DEFAULT_MAX_COVERS
}

/** Parse "11:00", "11:00 AM", "11a", "23:30" → minutes from midnight, or null. */
export function parseTimeToMinutes(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)\.?$/i)
  if (ampm) {
    let hour = Number(ampm[1])
    const minute = Number(ampm[2] || 0)
    const suffix = ampm[3].toLowerCase().startsWith('p')
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 1 || hour > 12 || minute > 59) {
      return null
    }
    if (suffix && hour < 12) hour += 12
    if (!suffix && hour === 12) hour = 0
    return hour * 60 + minute
  }

  const h24 = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (h24) {
    const hour = Number(h24[1])
    const minute = Number(h24[2])
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null
    return hour * 60 + minute
  }

  return null
}

export function formatMinutesAsTime(totalMinutes) {
  const minutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function dayRowForDate(hours, dateStr) {
  if (!Array.isArray(hours) || !dateStr) return null
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const key = DAY_KEYS[d.getDay()]
  return hours.find((row) => String(row.day || '').slice(0, 3) === key) || null
}

function activeReservations(rows) {
  return (rows || []).filter((r) => r.status === 'pending' || r.status === 'confirmed')
}

function coversUsedAt(slotStart, dwellMinutes, reservations) {
  const slotEnd = slotStart + dwellMinutes
  let used = 0
  for (const row of reservations) {
    const start = parseTimeToMinutes(row.time)
    if (start == null) continue
    const end = start + dwellMinutes
    // Overlap if intervals intersect
    if (start < slotEnd && end > slotStart) {
      used += Math.max(1, Number(row.guests) || 1)
    }
  }
  return used
}

/**
 * List bookable slots for a date + party size.
 * @returns {{ slots: Array<{ time: string, remainingCovers: number }>, closed: boolean, reason?: string }}
 */
export function listSlots({
  hours,
  date,
  guests = 2,
  existingRows = [],
  maxCovers = DEFAULT_MAX_COVERS,
  slotMinutes = DEFAULT_SLOT_MINUTES,
  dwellMinutes = DEFAULT_DWELL_MINUTES,
}) {
  const party = Math.max(1, Math.min(20, Number(guests) || 2))
  const day = dayRowForDate(hours, date)

  if (!day) {
    return { slots: [], closed: true, reason: 'No opening hours set for this day.' }
  }
  if (day.closed) {
    return { slots: [], closed: true, reason: 'Closed on this day.' }
  }

  const openMin = parseTimeToMinutes(day.open)
  const closeMin = parseTimeToMinutes(day.close)
  if (openMin == null || closeMin == null || closeMin <= openMin) {
    return { slots: [], closed: true, reason: 'Opening hours are incomplete for this day.' }
  }

  const reservations = activeReservations(existingRows).filter((r) => String(r.date) === String(date))
  const slots = []
  // Last start must leave room for dwell before close
  const lastStart = closeMin - dwellMinutes

  for (let t = openMin; t <= lastStart; t += slotMinutes) {
    const used = coversUsedAt(t, dwellMinutes, reservations)
    const remaining = Math.max(0, maxCovers - used)
    if (remaining >= party) {
      slots.push({ time: formatMinutesAsTime(t), remainingCovers: remaining })
    } else {
      slots.push({ time: formatMinutesAsTime(t), remainingCovers: remaining, full: true })
    }
  }

  return { slots, closed: false }
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function assertBookable({
  hours,
  date,
  time,
  guests = 2,
  existingRows = [],
  maxCovers = DEFAULT_MAX_COVERS,
  slotMinutes = DEFAULT_SLOT_MINUTES,
  dwellMinutes = DEFAULT_DWELL_MINUTES,
}) {
  if (!date || !time) {
    return { ok: false, status: 400, error: 'Date and time are required.' }
  }

  const party = Math.max(1, Math.min(20, Number(guests) || 2))
  const { slots, closed, reason } = listSlots({
    hours,
    date,
    guests: party,
    existingRows,
    maxCovers,
    slotMinutes,
    dwellMinutes,
  })

  if (closed) {
    return { ok: false, status: 409, error: reason || 'No availability on this day.' }
  }

  const normalized = formatMinutesAsTime(parseTimeToMinutes(time) ?? -1)
  const match = slots.find((s) => s.time === normalized || s.time === String(time))
  if (!match) {
    return { ok: false, status: 409, error: 'That time is outside opening hours.' }
  }
  if (match.full || match.remainingCovers < party) {
    return {
      ok: false,
      status: 409,
      error: 'That time slot is full. Please choose another time.',
    }
  }

  return { ok: true }
}
