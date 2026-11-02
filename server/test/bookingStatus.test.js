import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { checkStatusChange } from '../src/services/reservationAvailability.js'

const HOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => ({ day, open: '00:00', close: '23:59', closed: false }))
const TZ = 'Africa/Johannesburg'

test('status transitions: allowed, refused, and not before the booking day', () => {
  const today = '2026-11-02'
  assert.equal(checkStatusChange('pending', 'confirmed', { date: '2026-11-05', today }), null)
  assert.equal(checkStatusChange('confirmed', 'seated', { date: today, today }), null)
  assert.equal(checkStatusChange('seated', 'completed', { date: today, today }), null)
  assert.equal(checkStatusChange('confirmed', 'no_show', { date: '2026-11-01', today }), null)
  assert.match(checkStatusChange('confirmed', 'no_show', { date: '2026-11-05', today }), /on or after the booking date/)
  assert.match(checkStatusChange('pending', 'completed', { date: today, today }), /cannot be changed/)
  assert.match(checkStatusChange('completed', 'confirmed', { date: today, today }), /cannot be changed/)
  assert.match(checkStatusChange('no_show', 'completed', { date: today, today }), /no-show booking cannot/)
  assert.equal(checkStatusChange('cancelled', 'cancelled'), null)
})

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-status-')), 'test.db')
let server
let base
let db
let restaurantId
let auth

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: tmpDb, JWT_SECRET: 'test-jwt-secret' })
  ;({ db } = await import('../src/infra/db.js'))
  const { createApp } = await import('../src/app.js')
  const ownerId = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@t.local', 'x', 'owner')`).run().lastInsertRowid)
  restaurantId = Number(
    db
      .prepare(`INSERT INTO restaurants (owner_id, name, status, subdomain, timezone, operating_hours) VALUES (?, 'Resto', 'live', 'resto', ?, ?)`)
      .run(ownerId, TZ, JSON.stringify(HOURS)).lastInsertRowid,
  )
  auth = { Authorization: `Bearer ${jwt.sign({ sub: ownerId, id: ownerId, userId: ownerId, role: 'owner', email: 'o@t.local' }, 'test-jwt-secret')}` }
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
})

const json = { 'Content-Type': 'application/json' }
const dayFromNow = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

function insertBooking({ date, time = '19:00', status = 'confirmed', token = null }) {
  return Number(
    db
      .prepare(
        `INSERT INTO reservations (restaurant_id, guest_name, phone, guests, date, time, status, cancel_token) VALUES (?, 'Guest', '0710000000', 2, ?, ?, ?, ?)`,
      )
      .run(restaurantId, date, time, status, token).lastInsertRowid,
  )
}

const patch = (id, body) => fetch(`${base}/api/restaurant/reservations/${id}`, { method: 'PATCH', headers: { ...json, ...auth }, body: JSON.stringify(body) })

test('migration: reservations table accepts the new statuses and keeps its columns', () => {
  const sql = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'reservations'`).get().sql
  for (const s of ['seated', 'completed', 'no_show']) assert.ok(sql.includes(s), s)
  for (const c of ['guest_email', 'table_id', 'cancel_token']) assert.ok(sql.includes(c), c)
})

test('staff can walk a booking through seated and completed, and mark no-shows', async () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const a = insertBooking({ date: today })
  assert.equal((await patch(a, { status: 'seated' })).status, 200)
  assert.equal((await patch(a, { status: 'completed' })).status, 200)
  assert.equal((await patch(a, { status: 'confirmed' })).status, 409)

  const b = insertBooking({ date: today })
  const res = await patch(b, { status: 'no_show' })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).reservation.status, 'no_show')
})

test('no-show or seated cannot be set before the booking day; unknown status is 400', async () => {
  const future = insertBooking({ date: dayFromNow(5) })
  assert.equal((await patch(future, { status: 'no_show' })).status, 409)
  assert.equal((await patch(future, { status: 'seated' })).status, 409)
  assert.equal((await patch(future, { status: 'banana' })).status, 400)
  assert.equal(db.prepare('SELECT status FROM reservations WHERE id = ?').get(future).status, 'confirmed')
})

test('completed and no-show bookings free their capacity and table', async () => {
  const day = dayFromNow(3)
  const id = insertBooking({ date: day, time: '19:00' })
  const busy = await (await fetch(`${base}/api/public/resto/availability?date=${day}&guests=2`)).json()
  const slot = (r) => r.slots.find((s) => s.time === '19:00').remainingCovers
  const before = slot(busy)
  db.prepare(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`).run(id)
  const freed = await (await fetch(`${base}/api/public/resto/availability?date=${day}&guests=2`)).json()
  assert.equal(slot(freed), before + 2)
  db.prepare(`UPDATE reservations SET status = 'seated' WHERE id = ?`).run(id)
  const seated = await (await fetch(`${base}/api/public/resto/availability?date=${day}&guests=2`)).json()
  assert.equal(slot(seated), before)
})

test('guest cancels through the link; owner is told; second cancel and wrong token are refused', async () => {
  const book = await fetch(`${base}/api/public/resto/reservations`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ name: 'Zodwa', phone: '0710000001', guests: 2, date: dayFromNow(4), time: '20:00' }),
  })
  assert.equal(book.status, 201)
  const { reservation } = await book.json()
  assert.match(reservation.cancelToken, /^[0-9a-f]{32}$/)

  const view = await (await fetch(`${base}/api/public/resto/bookings/${reservation.cancelToken}`)).json()
  assert.equal(view.booking.canCancel, true)
  assert.equal(view.booking.restaurantName, 'Resto')
  assert.equal(view.booking.phone, undefined)

  const cancel = await fetch(`${base}/api/public/resto/bookings/${reservation.cancelToken}/cancel`, { method: 'POST' })
  assert.equal(cancel.status, 200)
  assert.equal((await cancel.json()).booking.status, 'cancelled')
  assert.equal(db.prepare('SELECT status FROM reservations WHERE id = ?').get(reservation.id).status, 'cancelled')
  assert.ok(db.prepare(`SELECT 1 FROM notifications WHERE title = 'Guest cancelled a booking'`).get())

  assert.equal((await fetch(`${base}/api/public/resto/bookings/${reservation.cancelToken}/cancel`, { method: 'POST' })).status, 409)
  assert.equal((await fetch(`${base}/api/public/resto/bookings/${'0'.repeat(32)}`)).status, 404)
  assert.equal((await fetch(`${base}/api/public/resto/bookings/not-a-token`)).status, 404)
})

test('guest cannot cancel a booking that has already started', async () => {
  const token = 'a'.repeat(32)
  insertBooking({ date: '2026-01-05', token })
  const res = await fetch(`${base}/api/public/resto/bookings/${token}/cancel`, { method: 'POST' })
  assert.equal(res.status, 409)
})

test('a token from one restaurant does not open a booking under another slug', async () => {
  const ownerId = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('P', 'p@t.local', 'x', 'owner')`).run().lastInsertRowid)
  db.prepare(`INSERT INTO restaurants (owner_id, name, status, subdomain, timezone, operating_hours) VALUES (?, 'Other', 'live', 'other', ?, ?)`).run(ownerId, TZ, JSON.stringify(HOURS))
  const token = 'b'.repeat(32)
  insertBooking({ date: dayFromNow(6), token })
  assert.equal((await fetch(`${base}/api/public/other/bookings/${token}`)).status, 404)
  assert.equal((await fetch(`${base}/api/public/resto/bookings/${token}`)).status, 200)
})

test('a booking creates the guest once; phone formats match; no-shows and cancellations are counted', async () => {
  const day = dayFromNow(8)
  const make = (phone, name) =>
    fetch(`${base}/api/public/resto/reservations`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ name, phone, email: name === 'Lerato M' ? 'lerato@t.local' : '', guests: 2, date: day, time: '12:00' }),
    })
  assert.equal((await make('071 555 0101', 'Lerato')).status, 201)
  assert.equal((await make('+27715550101', 'Lerato M')).status, 201)
  assert.equal((await make('0829990000', 'Thabo')).status, 201)

  const list = async () => (await (await fetch(`${base}/api/restaurant/guests`, { headers: auth })).json()).guests
  const lerato = (await list()).find((g) => g.name === 'Lerato M')
  assert.ok(lerato)
  assert.equal(lerato.bookings, 2)
  assert.equal(lerato.email, 'lerato@t.local')
  assert.equal((await list()).filter((g) => g.name.startsWith('Lerato')).length, 1)

  const rows = db.prepare(`SELECT id FROM reservations WHERE phone IN ('071 555 0101', '+27715550101') ORDER BY id`).all()
  db.prepare(`UPDATE reservations SET status = 'no_show' WHERE id = ?`).run(rows[0].id)
  db.prepare(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`).run(rows[1].id)
  const after = (await list()).find((g) => g.name === 'Lerato M')
  assert.equal(after.noShows, 1)
  assert.equal(after.cancellations, 1)
  assert.equal((await list()).find((g) => g.name === 'Thabo').noShows, 0)
})

test('guest list is private to the owner of the restaurant', async () => {
  assert.equal((await fetch(`${base}/api/restaurant/guests`)).status, 401)
})
