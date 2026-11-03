import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import {
  advanceDaysFromSettings,
  assertBookable,
  checkBookingDate,
  listSlots,
  zonedNow,
} from '../src/services/reservationAvailability.js'

const HOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => ({ day, open: '11:00', close: '22:00', closed: false }))
const TZ = 'Africa/Johannesburg'
const NOW = new Date('2026-10-30T10:00:00Z')

test('zonedNow uses the restaurant timezone, not the server clock', () => {
  assert.deepEqual(zonedNow(TZ, new Date('2026-10-30T22:30:00Z')), { date: '2026-10-31', minutes: 30 })
  assert.deepEqual(zonedNow('America/New_York', new Date('2026-10-30T22:30:00Z')), { date: '2026-10-30', minutes: 18 * 60 + 30 })
  assert.equal(zonedNow('Not/AZone', NOW).date, '2026-10-30')
})

test('dates: past, malformed and too far ahead are refused; today and the last allowed day pass', () => {
  const ok = (d, opts = {}) => checkBookingDate(d, { timezone: TZ, now: NOW, ...opts })
  assert.equal(ok('2026-10-30'), null)
  assert.equal(ok('2026-10-29').error, 'That date has already passed.')
  assert.equal(ok('2026-01-05').status, 400)
  assert.equal(ok('2027-01-28'), null)
  assert.match(ok('2027-01-29').error, /up to 90 days ahead/)
  assert.match(ok('2026-11-10', { advanceDays: 7 }).error, /up to 7 days ahead/)
  for (const bad of ['', 'tomorrow', '2026-13-01', '2026-02-30', '30/10/2026', undefined]) {
    assert.equal(ok(bad).error, 'Invalid date.', String(bad))
  }
})

test('advance window setting is clamped and defaults to 90 days', () => {
  assert.equal(advanceDaysFromSettings({}), 90)
  assert.equal(advanceDaysFromSettings({ reservationAdvanceDays: 30 }), 30)
  assert.equal(advanceDaysFromSettings({ reservationAdvanceDays: 9999 }), 365)
  assert.equal(advanceDaysFromSettings({ reservationAdvanceDays: 0 }), 90)
})

test('listSlots reports a closed day with the reason instead of offering slots', () => {
  const past = listSlots({ hours: HOURS, date: '2026-10-01', timezone: TZ, now: NOW })
  assert.equal(past.closed, true)
  assert.equal(past.slots.length, 0)
  const far = listSlots({ hours: HOURS, date: '2027-06-01', timezone: TZ, now: NOW })
  assert.equal(far.closed, true)
  const day = listSlots({ hours: HOURS, date: '2026-11-02', timezone: TZ, now: NOW })
  assert.equal(day.closed, false)
  assert.ok(day.slots.length > 10)
})

test('owner calendar can still look at a past day with includePast', () => {
  const r = listSlots({ hours: HOURS, date: '2026-10-29', timezone: TZ, now: NOW, includePast: true })
  assert.equal(r.closed, false)
})

test('today: slots already started are hidden using the restaurant clock', () => {
  const r = listSlots({ hours: HOURS, date: '2026-10-30', timezone: TZ, now: NOW })
  assert.ok(r.slots.every((s) => s.time > '12:00'))
  const late = assertBookable({ hours: HOURS, date: '2026-10-30', time: '11:30', timezone: TZ, now: NOW })
  assert.equal(late.ok, false)
  assert.match(late.error, /already passed/)
})

test('assertBookable: past and far-future dates are 400, a normal future slot is accepted', () => {
  const run = (date, time = '19:00') => assertBookable({ hours: HOURS, date, time, guests: 2, timezone: TZ, now: NOW })
  assert.equal(run('2026-01-05').status, 400)
  assert.equal(run('2027-06-01').status, 400)
  assert.deepEqual(run('2026-11-03'), { ok: true })
})

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-booking-')), 'test.db')
let server
let base
let db

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: tmpDb, JWT_SECRET: 'test-jwt-secret' })
  ;({ db } = await import('../src/infra/db.js'))
  const { createApp } = await import('../src/app.js')
  const owner = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@t.local', 'x', 'owner')`).run().lastInsertRowid)
  db.prepare(`INSERT INTO restaurants (owner_id, name, status, subdomain, timezone, operating_hours) VALUES (?, 'Resto', 'live', 'resto', ?, ?)`).run(
    owner,
    TZ,
    JSON.stringify(HOURS),
  )
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
})

const book = (date, time = '19:00') =>
  fetch(`${base}/api/public/resto/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Guest', phone: '0710000000', guests: 2, date, time }),
  })

const dayFromNow = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

test('public booking API: past date and 400 days ahead are refused, next week is accepted', async () => {
  assert.equal((await book('2026-01-05')).status, 400)
  assert.equal((await book(dayFromNow(-1))).status, 400)
  assert.equal((await book(dayFromNow(400))).status, 400)
  assert.equal((await book(dayFromNow(7))).status, 201)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM reservations').get().n, 1)
})

test('public availability API: past date is reported closed with a reason', async () => {
  const res = await fetch(`${base}/api/public/resto/availability?date=2026-01-05&guests=2`)
  const body = await res.json()
  assert.equal(body.closed, true)
  assert.match(body.reason, /already passed/)
})
