import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-sync-')), 'test.db')
const docs = new Map()
const writes = []
let reads = 0
let down = false

const key = (doctype, name) => `${doctype}::${name}`
const put = (doc) => docs.set(key(doc.doctype, doc.name), structuredClone(doc))

function seed() {
  docs.clear()
  writes.length = 0
  reads = 0
  put({ doctype: 'URY Restaurant', name: 'Resto', branch: 'B', address: null, active_menu: 'M' })
  put({ doctype: 'Branch', name: 'B', user: [{ parent: 'B', user: 'int@site' }] })
  put({ doctype: 'POS Profile', name: 'P', restaurant: 'Resto', branch: 'B', disabled: 0 })
  for (const name of ['South Africa', 'Botswana']) put({ doctype: 'Country', name })
}

function stamp(doc) {
  for (const value of Object.values(doc)) {
    if (!Array.isArray(value)) continue
    value.forEach((row, i) => {
      if (row && typeof row === 'object') Object.assign(row, { parent: doc.name, idx: i + 1, name: row.name || `${doc.name}-${i}` })
    })
  }
  return doc
}

const server = http.createServer((req, res) => {
  reads += 1
  const url = new URL(req.url, 'http://fake')
  const method = url.pathname.replace('/api/method/', '')
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {}
    const reply = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    }
    if (down) return reply(503, {})
    if (method === 'frappe.auth.get_logged_user') return reply(200, { message: 'int@site' })
    if (method === 'ury.ury_pos.api.getPosProfile') return reply(200, { message: { branch: 'B', pos_profile: 'P' } })
    if (method === 'frappe.desk.form.load.getdoc') {
      const doc = docs.get(key(url.searchParams.get('doctype'), url.searchParams.get('name')))
      return reply(200, doc ? { docs: [structuredClone(doc)] } : { message: [] })
    }
    if (method === 'frappe.desk.reportview.get_list') {
      const doctype = url.searchParams.get('doctype')
      const filters = JSON.parse(url.searchParams.get('filters') || '{}')
      const rows = [...docs.values()].filter(
        (d) => d.doctype === doctype && Object.entries(filters).every(([k, v]) => d[k] === v),
      )
      return reply(200, { message: rows })
    }
    if (method === 'frappe.client.save') {
      writes.push({ method, doc: body.doc })
      put(stamp(body.doc))
      return reply(200, { message: body.doc })
    }
    if (method === 'frappe.client.insert') {
      const doc = { ...body.doc }
      doc.name = doc.name || `${doc.address_title || doc.branch}-${doc.address_type || ''}`.replace(/-$/, '')
      writes.push({ method, doc })
      put(stamp(doc))
      return reply(200, { message: doc })
    }
    if (method === 'frappe.client.set_value') {
      writes.push({ method, doc: body })
      const doc = docs.get(key(body.doctype, body.name))
      doc[body.fieldname] = body.value
      return reply(200, { message: doc })
    }
    return reply(404, {})
  })
})

let db
let syncProfileToPos
let restaurantId
let signToken
let app
let appBase
let ownerToken

before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_PATH: tmpDb,
    JWT_SECRET: 'test-jwt-secret',
    URY_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    URY_CRED_T1_API_KEY: 'k',
    URY_CRED_T1_API_SECRET: 's',
  })
  ;({ db } = await import('../src/infra/db.js'))
  ;({ syncProfileToPos } = await import('../src/integrations/ury/uryProfileSync.js'))
  ;({ signToken } = await import('../src/middleware/auth.js'))
  const { createApp } = await import('../src/app.js')

  const owner = Number(
    db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@t.local', 'x', 'owner')`).run().lastInsertRowid,
  )
  restaurantId = Number(db.prepare(`INSERT INTO restaurants (owner_id, name, status) VALUES (?, 'Resto', 'live')`).run(owner).lastInsertRowid)
  db.prepare(
    `INSERT INTO restaurant_integrations
       (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile, credential_ref, status, feature_hours, feature_contact)
     VALUES (?, 'ury', 'Resto', 'B', 'P', 'T1', 'active', 1, 1)`,
  ).run(restaurantId)
  ownerToken = signToken({ id: owner, email: 'o@t.local', name: 'O', role: 'owner' })
  app = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => app.once('listening', r))
  appBase = `http://127.0.0.1:${app.address().port}`
})

after(() => {
  server.close()
  app.close()
})

beforeEach(async () => {
  seed()
  down = false
  const { clearUryTenantCache } = await import('../src/integrations/ury/uryTenant.js')
  const { clearUryHoursCache } = await import('../src/integrations/ury/uryHours.js')
  const { clearUryContactCache } = await import('../src/integrations/ury/uryContact.js')
  clearUryTenantCache()
  clearUryHoursCache()
  clearUryContactCache()
  db.prepare(`UPDATE restaurant_integrations SET feature_hours = 1, feature_contact = 1 WHERE restaurant_id = ?`).run(restaurantId)
})

const week = (overrides = {}) =>
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({ day, open: '11:00', close: '22:00', closed: false, ...overrides[day] }))
const contact = { phone: '+27 21 555 0100', email: 'hi@resto.test', address: '12 Long Street', city: 'Cape Town', country: 'South Africa' }
const schedule = () => docs.get(key('URY Branch Operating Schedule', 'B'))

test('hours: creates the schedule for the mapped branch, closed days empty', async () => {
  const res = await syncProfileToPos(restaurantId, { hours: week({ Mon: { closed: true } }), timezone: 'Africa/Johannesburg' })
  assert.equal(res.hours.status, 'synced')
  const doc = schedule()
  assert.equal(doc.branch, 'B')
  assert.equal(doc.enabled, 1)
  assert.equal(doc.monday.length, 0)
  assert.deepEqual([doc.tuesday[0].open_time, doc.tuesday[0].close_time], ['11:00:00', '22:00:00'])
})

test('hours: a second identical save writes nothing', async () => {
  await syncProfileToPos(restaurantId, { hours: week() })
  writes.length = 0
  const res = await syncProfileToPos(restaurantId, { hours: week() })
  assert.equal(res.hours.status, 'unchanged')
  assert.equal(writes.length, 0)
})

test('hours: split shifts survive when the overall day is unchanged, and are replaced when it changes', async () => {
  put({
    doctype: 'URY Branch Operating Schedule', name: 'B', branch: 'B', enabled: 1, timezone: 'Africa/Johannesburg',
    monday: [
      { doctype: 'URY Branch Service Window', parent: 'B', idx: 1, service_name: 'Lunch', open_time: '12:00:00', close_time: '15:00:00', enabled: 1 },
      { doctype: 'URY Branch Service Window', parent: 'B', idx: 2, service_name: 'Dinner', open_time: '18:00:00', close_time: '22:00:00', enabled: 1 },
    ],
    tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
  })
  const closedElsewhere = Object.fromEntries(['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => [d, { closed: true }]))
  let res = await syncProfileToPos(restaurantId, { hours: week({ ...closedElsewhere, Mon: { open: '12:00', close: '22:00' } }) })
  assert.equal(res.hours.status, 'unchanged')
  assert.deepEqual(schedule().monday.map((w) => w.service_name), ['Lunch', 'Dinner'])

  res = await syncProfileToPos(restaurantId, { hours: week({ ...closedElsewhere, Mon: { open: '12:00', close: '23:00' } }) })
  assert.equal(res.hours.status, 'synced')
  assert.deepEqual(schedule().monday.map((w) => [w.service_name, w.close_time]), [['Open', '23:00:00']])
})

test('hours: invalid times are refused with a readable message and nothing is written', async () => {
  const res = await syncProfileToPos(restaurantId, { hours: week({ Wed: { open: '25:99', close: '22:00' } }) })
  assert.equal(res.hours.status, 'failed')
  assert.match(res.hours.message, /Wed/)
  assert.equal(writes.length, 0)
})

test('contact: creates an Address linked to the restaurant, then is idempotent', async () => {
  let res = await syncProfileToPos(restaurantId, contact)
  assert.equal(res.contact.status, 'synced')
  const resto = docs.get(key('URY Restaurant', 'Resto'))
  const address = docs.get(key('Address', resto.address))
  assert.equal(address.city, 'Cape Town')
  assert.deepEqual(address.links.map((l) => [l.link_doctype, l.link_name]), [['URY Restaurant', 'Resto']])

  writes.length = 0
  res = await syncProfileToPos(restaurantId, contact)
  assert.equal(res.contact.status, 'unchanged')
  assert.equal(writes.length, 0)

  res = await syncProfileToPos(restaurantId, { ...contact, phone: '+27 21 555 0199' })
  assert.equal(res.contact.status, 'synced')
  assert.equal(docs.get(key('Address', resto.address)).phone, '+27 21 555 0199')
})

test('contact: an Address shared with something else is never edited', async () => {
  put({ doctype: 'Address', name: 'Shared-Office', address_line1: 'Other', city: 'Other', country: 'South Africa', phone: '1', email_id: '',
    links: [{ doctype: 'Dynamic Link', parent: 'Shared-Office', link_doctype: 'Customer', link_name: 'Somebody' }] })
  docs.get(key('URY Restaurant', 'Resto')).address = 'Shared-Office'
  await syncProfileToPos(restaurantId, contact)
  assert.equal(docs.get(key('Address', 'Shared-Office')).city, 'Other')
  assert.notEqual(docs.get(key('URY Restaurant', 'Resto')).address, 'Shared-Office')
})

test('contact: incomplete address is skipped; bad phone, email or country fail without writing', async () => {
  assert.equal((await syncProfileToPos(restaurantId, { ...contact, address: '' })).contact.status, 'skipped')
  assert.equal((await syncProfileToPos(restaurantId, { ...contact, phone: 'call me' })).contact.status, 'failed')
  assert.equal((await syncProfileToPos(restaurantId, { ...contact, email: 'nope' })).contact.status, 'failed')
  const bad = await syncProfileToPos(restaurantId, { ...contact, country: 'Atlantis' })
  assert.equal(bad.contact.status, 'failed')
  assert.match(bad.contact.message, /Atlantis/)
  assert.equal(writes.length, 0)
})

test('country matching ignores case and defaults to South Africa', async () => {
  await syncProfileToPos(restaurantId, { ...contact, country: 'botswana' })
  const resto = docs.get(key('URY Restaurant', 'Resto'))
  assert.equal(docs.get(key('Address', resto.address)).country, 'Botswana')
})

test('nothing is sent to the POS when the feature switches are off', async () => {
  db.prepare(`UPDATE restaurant_integrations SET feature_hours = 0, feature_contact = 0 WHERE restaurant_id = ?`).run(restaurantId)
  assert.equal(await syncProfileToPos(restaurantId, { hours: week(), ...contact }), null)
  assert.equal(reads, 0)
})

test('PUT /profile saves locally and reports the sync result', async () => {
  const res = await fetch(`${appBase}/api/restaurant/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ restaurantName: 'Resto', hours: week(), ...contact }),
  })
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.posSync.hours.status, 'synced')
  assert.equal(body.posSync.contact.status, 'synced')
  assert.equal(db.prepare('SELECT city FROM restaurants WHERE id = ?').get(restaurantId).city, 'Cape Town')
})

test('PUT /profile still saves when the POS is down, and says the POS was not updated', async () => {
  down = true
  const res = await fetch(`${appBase}/api/restaurant/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ restaurantName: 'Resto', hours: week(), ...contact, city: 'Durban' }),
  })
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.posSync.hours.status, 'failed')
  assert.equal(body.posSync.contact.status, 'failed')
  assert.equal(db.prepare('SELECT city FROM restaurants WHERE id = ?').get(restaurantId).city, 'Durban')
})

function seedPosProfile() {
  put({
    doctype: 'URY Branch Operating Schedule', name: 'B', branch: 'B', enabled: 1, timezone: 'Africa/Johannesburg',
    monday: [
      { doctype: 'URY Branch Service Window', parent: 'B', idx: 1, service_name: 'Lunch', open_time: '12:00:00', close_time: '15:00:00', enabled: 1 },
      { doctype: 'URY Branch Service Window', parent: 'B', idx: 2, service_name: 'Dinner', open_time: '18:00:00', close_time: '22:00:00', enabled: 1 },
    ],
    tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
  })
  put({
    doctype: 'Address', name: 'Resto-Office', address_line1: '9 Beach Road', address_line2: 'Unit 4', city: 'Durban',
    country: 'South Africa', phone: '+27 31 555 0000', email_id: 'pos@resto.test',
    links: [{ doctype: 'Dynamic Link', parent: 'Resto-Office', link_doctype: 'URY Restaurant', link_name: 'Resto' }],
  })
  docs.get(key('URY Restaurant', 'Resto')).address = 'Resto-Office'
}

const getProfile = async () =>
  (await (await fetch(`${appBase}/api/restaurant`, { headers: { Authorization: `Bearer ${ownerToken}` } })).json()).restaurant

test('profile load shows the POS values, not stale local ones', async () => {
  seedPosProfile()
  db.prepare(`UPDATE restaurants SET phone = '+91 stale', city = 'Mumbai' WHERE id = ?`).run(restaurantId)
  const r = await getProfile()
  assert.equal(r.city, 'Durban')
  assert.equal(r.phone, '+27 31 555 0000')
  assert.equal(r.email, 'pos@resto.test')
  assert.equal(r.timezone, 'Africa/Johannesburg')
  const hours = JSON.parse(r.operating_hours)
  assert.deepEqual(hours[0], { day: 'Mon', open: '12:00', close: '22:00', closed: false })
  assert.equal(hours[1].closed, true)
})

test('opening the profile and saving it unchanged writes nothing to the POS', async () => {
  seedPosProfile()
  const r = await getProfile()
  writes.length = 0
  const res = await fetch(`${appBase}/api/restaurant/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      restaurantName: r.name, phone: r.phone, email: r.email, address: r.address, city: r.city,
      country: r.country, timezone: r.timezone, hours: JSON.parse(r.operating_hours),
    }),
  })
  const body = await res.json()
  assert.equal(body.posSync.hours.status, 'unchanged')
  assert.equal(body.posSync.contact.status, 'unchanged')
  assert.equal(writes.length, 0)
  assert.deepEqual(docs.get(key('URY Branch Operating Schedule', 'B')).monday.map((w) => w.service_name), ['Lunch', 'Dinner'])
})

test('profile load falls back to local values when the POS is down or the switches are off', async () => {
  seedPosProfile()
  db.prepare(`UPDATE restaurants SET city = 'Local City' WHERE id = ?`).run(restaurantId)
  down = true
  assert.equal((await getProfile()).city, 'Local City')
  down = false
  db.prepare(`UPDATE restaurant_integrations SET feature_hours = 0, feature_contact = 0 WHERE restaurant_id = ?`).run(restaurantId)
  assert.equal((await getProfile()).city, 'Local City')
})
