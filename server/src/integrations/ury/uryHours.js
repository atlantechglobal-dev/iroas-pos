// Opening hours READ from URY (version-16 DocTypes, fields confirmed live via getdoctype):
//   URY Branch Operating Schedule (autoname = branch): enabled, timezone,
//     monday … sunday : Table of URY Branch Service Window (service_name, open_time, close_time, enabled)
//   URY Branch Operating Exception: branch, exception_date, is_closed, open_time, close_time, reason
// Reads only. No IROAS-side hours are stored or substituted: a missing or
// disabled schedule is reported as such so the site can show a warning.

import { UryError } from './uryClient.js'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const CACHE_TTL_MS = 15 * 60_000
const STALE_LIMIT_MS = 24 * 60 * 60_000
const EXCEPTION_FIELDS = ['name', 'branch', 'exception_date', 'is_closed', 'open_time', 'close_time', 'reason']
const cache = new Map()

/** Frappe Time "09:00:00" / "9:00:00.000000" -> "09:00". */
export function hhmm(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''))
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

function capitalize(day) {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export function mapSchedule(doc) {
  return DAYS.map((day) => {
    const windows = (Array.isArray(doc[day]) ? doc[day] : [])
      .filter((row) => row.parent === doc.name && row.enabled === 1)
      .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
      .map((row) => ({ name: row.service_name || '', open: hhmm(row.open_time), close: hhmm(row.close_time) }))
      .filter((w) => w.open && w.close)
    return { day: capitalize(day), windows }
  })
}

export function mapException(row) {
  const closed = row.is_closed === 1
  return {
    date: row.exception_date,
    closed,
    open: closed ? null : hhmm(row.open_time),
    close: closed ? null : hhmm(row.close_time),
    reason: row.reason || '',
  }
}

/** IROAS site shape ({day, open, close, closed}) derived from URY windows, plus the raw windows. */
export function toSiteHours(weekly) {
  return weekly.map(({ day, windows }) =>
    windows.length
      ? { day, open: windows[0].open, close: windows[windows.length - 1].close, closed: false, windows }
      : { day, open: '', close: '', closed: true, windows: [] },
  )
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

async function load({ client, branch }) {
  let doc
  try {
    doc = (await client.getDoc('URY Branch Operating Schedule', branch)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') {
      return { status: 'not_configured', message: 'Opening hours have not been set up in the POS yet.' }
    }
    throw err
  }
  if (doc.branch !== branch) {
    return { status: 'not_configured', message: 'Opening hours in the POS do not belong to this branch.' }
  }
  if (doc.enabled !== 1) {
    return { status: 'disabled', message: 'Opening hours are switched off in the POS.' }
  }

  // Yesterday (UTC) so a closure today in a timezone ahead of UTC is not dropped.
  const since = isoDate(new Date(Date.now() - 24 * 60 * 60_000))
  const rows = await client.getList('URY Branch Operating Exception', {
    fields: EXCEPTION_FIELDS,
    filters: { branch, exception_date: ['>=', since] },
    orderBy: 'exception_date asc',
    limit: 60,
  })
  const weekly = mapSchedule(doc)
  return {
    status: 'ok',
    timezone: doc.timezone || null,
    weekly,
    exceptions: rows.filter((r) => r.branch === branch).map(mapException),
    message: weekly.some((d) => d.windows.length) ? null : 'No enabled service windows are set in the POS.',
  }
}

/** Opening hours for a verified tenant. URY failures serve the last good copy (flagged stale) for up to 24 h. */
export async function getUryHours(tenant) {
  const key = `${tenant.restaurantId}\u0000${tenant.branch}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data
  try {
    const data = { ...(await load(tenant)), fetchedAt: new Date().toISOString(), stale: false }
    cache.set(key, { data, at: Date.now() })
    return data
  } catch (err) {
    if (err instanceof UryError && hit && Date.now() - hit.at < STALE_LIMIT_MS) {
      return { ...hit.data, stale: true }
    }
    throw err
  }
}

export function clearUryHoursCache() {
  cache.clear()
}
