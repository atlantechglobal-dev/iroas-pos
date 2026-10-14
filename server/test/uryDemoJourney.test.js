// Single demo restaurant journey: public site hours/contact/menu from URY and
// guest pickup ordering through ury.ury.api.self_ordering. Runs the real IROAS
// app and URY client against a local fake Frappe server; no network access to
// the real URY instance and no production data is touched.
//
//   cd server && npm test

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ---------------------------------------------------------------- fake URY
const KEY = 'demo-key'
const SECRET = 'demo-S3CRET'
const USER = 'demo@int'
const SO = 'ury.ury.api.self_ordering'

const DOCS = {
  'URY Restaurant': {
    'Demo Restaurant': { name: 'Demo Restaurant', branch: 'Demo Branch', company: 'Co', active_menu: 'Demo Menu', address: 'Demo Address' },
  },
  Branch: { 'Demo Branch': { name: 'Demo Branch', user: [{ parent: 'Demo Branch', user: USER }] } },
  'URY Menu': {
    'Demo Menu': {
      name: 'Demo Menu', branch: 'Demo Branch', enabled: 1, price_list: 'Std',
      items: [
        { parent: 'Demo Menu', name: 'r1', item: 'GR', item_name: 'Ghee Rice', rate: 150, course: 'Demo Course', idx: 1 },
        { parent: 'Demo Menu', name: 'r2', item: 'WNG', item_name: 'Wings', rate: 99, course: 'Demo Course', idx: 2 },
        { parent: 'Demo Menu', name: 'r3', item: 'MOM', item_name: 'Momo', rate: 40, course: 'Starters', idx: 3, disabled: 1 },
      ],
    },
  },
  'Price List': { Std: { name: 'Std', currency: 'ZAR' } },
  Address: {
    'Demo Address': {
      name: 'Demo Address', address_line1: '1 Long St', address_line2: '', city: 'Cape Town', state: 'WC',
      country: 'South Africa', pincode: '8001', phone: '+27 21 000 0000', email_id: 'hello@demo.test', disabled: 0,
    },
  },
  'URY Branch Operating Schedule': {},
  'POS Invoice': {},
}

const SCHEDULE = {
  name: 'Demo Branch', branch: 'Demo Branch', enabled: 1, timezone: 'Africa/Johannesburg',
  monday: [
    { parent: 'Demo Branch', idx: 1, service_name: 'Lunch', open_time: '11:00:00', close_time: '15:00:00', enabled: 1 },
    { parent: 'Demo Branch', idx: 2, service_name: 'Dinner', open_time: '18:00:00', close_time: '22:30:00', enabled: 1 },
  ],
  tuesday: [{ parent: 'Demo Branch', idx: 1, service_name: 'All day', open_time: '9:00:00', close_time: '17:00:00', enabled: 1 }],
  wednesday: [{ parent: 'Demo Branch', idx: 1, service_name: 'Off', open_time: '9:00:00', close_time: '17:00:00', enabled: 0 }],
  thursday: [], friday: [], saturday: [], sunday: [],
}

const LISTS = {
  'POS Profile': [{ name: 'Demo Profile', restaurant: 'Demo Restaurant', branch: 'Demo Branch', disabled: 0 }],
  'URY Self Ordering Profile': [
    { name: 'Demo Website', restaurant: 'Demo Restaurant', branch: 'Demo Branch', pos_profile: 'Demo Profile', enabled: 1, qr_signing_secret: 'QR-S3CRET', staff_pin: '9999' },
  ],
  'URY Branch Operating Exception': [],
  'URY Table': [],
}

const fake = {
  requests: [],
  sessions: new Map(), // session -> { invoice }
  invoiceSeq: 0,
  sessionSeq: 0,
  addMode: 'ok', // ok | closed | error500 | slow | slow_ok
  contextMode: 'ok', // ok | error500
  statusForbidden: false,
  addCalls: [],
  slowMs: 400,
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function validation(res, message) {
  send(res, 417, {
    exc_type: 'ValidationError',
    _server_messages: JSON.stringify([JSON.stringify({ message, raise_exception: 1 })]),
  })
}

function project(row, fields) {
  if (!fields || fields.includes('*')) return { ...row }
  return Object.fromEntries(fields.filter((f) => f in row).map((f) => [f, row[f]]))
}

function matches(row, filters) {
  return Object.entries(filters).every(([k, v]) => {
    if (Array.isArray(v)) {
      const [op, val] = v
      if (op === '>=') return String(row[k]) >= String(val)
      if (op === 'in') return val.includes(row[k])
      return false
    }
    return row[k] === v
  })
}

function orderOf(session) {
  const s = fake.sessions.get(session)
  const inv = DOCS['POS Invoice'][s.invoice]
  return {
    invoice: s.invoice, table: null, order_type: 'Take Away', pickup_code: `P-${s.invoice}`,
    items: inv.items, grand_total: inv.grand_total, billed: 0,
  }
}

const fakeServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://fake')
  const method = url.pathname.replace('/api/method/', '')
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const auth = req.headers.authorization || ''
    if (auth !== `token ${KEY}:${SECRET}`) return send(res, 401, { exc_type: 'AuthenticationError' })
    const body = raw ? JSON.parse(raw) : {}
    fake.requests.push({ method, doctype: url.searchParams.get('doctype'), body })
    const q = (k) => url.searchParams.get(k)

    if (method === 'frappe.auth.get_logged_user') return send(res, 200, { message: USER })
    if (method === 'frappe.desk.form.load.getdoc') {
      const doc = DOCS[q('doctype')]?.[q('name')]
      return doc ? send(res, 200, { docs: [doc] }) : send(res, 404, { exc_type: 'DoesNotExistError' })
    }
    if (method === 'frappe.desk.reportview.get_list') {
      const fields = JSON.parse(q('fields') || 'null')
      const filters = JSON.parse(q('filters') || '{}')
      const rows = (LISTS[q('doctype')] || []).filter((r) => matches(r, filters))
      return send(res, 200, { message: rows.map((r) => project(r, fields)) })
    }
    if (method === 'ury.ury_pos.api.getPosProfile') {
      return send(res, 200, { message: { pos_profile: 'Demo Profile', branch: 'Demo Branch', waiter: USER } })
    }

    if (method === `${SO}.generate_qr_token`) {
      if (body.profile !== 'Demo Website') return send(res, 404, { exc_type: 'DoesNotExistError' })
      return send(res, 200, { message: `TOKEN-${body.profile}` })
    }
    if (method === `${SO}.get_ordering_context`) {
      if (fake.contextMode === 'error500') return send(res, 500, { exc_type: 'InternalServerError' })
      if (body.token !== 'TOKEN-Demo Website') return send(res, 403, { exc_type: 'PermissionError' })
      const session = `SES-${(fake.sessionSeq += 1)}`
      fake.sessions.set(session, { invoice: null })
      return send(res, 200, { message: { session, source: 'pickup', restaurant: 'Demo Restaurant' } })
    }
    if (method === `${SO}.add_customer_items`) {
      fake.addCalls.push(body)
      const s = fake.sessions.get(body.session)
      if (!s) return send(res, 403, { exc_type: 'PermissionError' })
      if (s.invoice) return validation(res, 'Adding further items to this order is not allowed.')
      if (fake.addMode === 'closed') {
        return validation(res, 'POS Opening Entry POS-OPE-2026-00001 is outdated. Please close the POS and create a new POS Opening Entry.')
      }
      if (fake.addMode === 'error500') return send(res, 500, { exc_type: 'InternalServerError' })
      const menu = DOCS['URY Menu']['Demo Menu'].items
      const items = []
      for (const line of body.items || []) {
        const row = menu.find((m) => m.item === line.item && m.disabled !== 1)
        if (!row) return validation(res, `Item ${line.item} is not available on this menu.`)
        items.push({ item_code: row.item, item_name: row.item_name, qty: line.qty, comment: line.comment || '', rate: row.rate, amount: row.rate * line.qty })
      }
      const invoice = `POS-INV-${String((fake.invoiceSeq += 1)).padStart(5, '0')}`
      DOCS['POS Invoice'][invoice] = {
        name: invoice, branch: 'Demo Branch', restaurant: 'Demo Restaurant', docstatus: 0, status: 'Draft',
        items, grand_total: items.reduce((n, i) => n + i.amount, 0),
      }
      s.invoice = invoice
      const reply = () => send(res, 200, { message: orderOf(body.session) })
      if (fake.addMode === 'slow' || fake.addMode === 'slow_ok') return setTimeout(reply, fake.slowMs)
      return reply()
    }
    if (method === `${SO}.get_order_status`) {
      const s = fake.sessions.get(q('session'))
      if (!s || fake.statusForbidden) return send(res, 403, { exc_type: 'PermissionError' })
      return send(res, 200, { message: { session_status: 'Active', invoice: s.invoice, billed: 0, submitted: Boolean(s.invoice), open_requests: [] } })
    }
    if (method === `${SO}.get_customer_order`) {
      const s = fake.sessions.get(q('session'))
      if (!s?.invoice) return send(res, 200, { message: null })
      return send(res, 200, { message: orderOf(q('session')) })
    }
    return send(res, 404, { exc_type: 'DoesNotExistError' })
  })
})

// ---------------------------------------------------------------- IROAS app
const tmpDb = path.join(os.tmpdir(), `iroas-ury-demo-${process.pid}-${Date.now()}.db`)
let api
let appServer
let db
let caches
let restaurantId
let ipSeq = 0
const logs = []
const originalConsole = { warn: console.warn, info: console.info, error: console.error, log: console.log }
const SLUG = 'saffron-test'
const LOCAL_HOURS = [{ day: 'Monday', open: '08:00', close: '09:00', closed: false }]

async function call(pathname, { method = 'GET', body, ip } = {}) {
  const res = await fetch(`${api}${pathname}`, {
    method,
    headers: {
      'X-Forwarded-For': ip || `10.0.0.${(ipSeq += 1)}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // non-JSON
  }
  return { status: res.status, json, text }
}

let stamp = 0
function setFeatures(fields) {
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`)
  db.prepare(
    `UPDATE restaurant_integrations SET ${[...sets, 'updated_at = @stamp'].join(', ')} WHERE restaurant_id = @rid`,
  ).run({ ...fields, stamp: `t${(stamp += 1)}`, rid: restaurantId })
}

const ALL_ON = { feature_hours: 1, feature_contact: 1, feature_menu: 1, feature_guest_ordering: 1, status: 'active' }
let subSeq = 0
const newSubmission = () => `test-sub-${Date.now()}-${(subSeq += 1)}-abcdef`
const order = (submissionId, items = [{ code: 'GR', qty: 2 }], extra = {}) =>
  call(`/api/public/${SLUG}/ury-orders`, {
    method: 'POST',
    body: { submissionId, items, guestName: 'Thandi Guest', guestPhone: '+27 82 555 0101', ...extra },
  })
const status = (submissionId) => call(`/api/public/${SLUG}/ury-orders/${submissionId}`)
const invoiceCount = () => Object.keys(DOCS['POS Invoice']).length

before(async () => {
  await new Promise((r) => fakeServer.listen(0, '127.0.0.1', r))
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_PATH: tmpDb,
    JWT_SECRET: 'test-jwt-secret',
    URY_BASE_URL: `http://127.0.0.1:${fakeServer.address().port}`,
    URY_CRED_DEMO_API_KEY: KEY,
    URY_CRED_DEMO_API_SECRET: SECRET,
  })
  for (const k of ['URY_USERNAME', 'URY_PASSWORD', 'URY_REQUEST_TIMEOUT_MS', 'URY_GUEST_ORDER_RETRY_AFTER_MS', 'URY_ALLOW_ADMINISTRATOR_CREDENTIAL']) {
    delete process.env[k]
  }
  for (const k of Object.keys(originalConsole)) console[k] = (...args) => logs.push(args.map(String).join(' '))

  ;({ db } = await import('../src/infra/db.js'))
  const bcrypt = (await import('bcryptjs')).default
  const { createApp } = await import('../src/app.js')
  caches = {
    tenant: (await import('../src/integrations/ury/uryTenant.js')).clearUryTenantCache,
    hours: (await import('../src/integrations/ury/uryHours.js')).clearUryHoursCache,
    contact: (await import('../src/integrations/ury/uryContact.js')).clearUryContactCache,
    menu: (await import('../src/integrations/ury/uryMenu.js')).clearUryMenuCache,
    tokens: (await import('../src/integrations/ury/urySelfOrdering.js')).clearPickupTokens,
  }

  const owner = db
    .prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('Owner', 'owner@demo.test', ?, 'owner')`)
    .run(bcrypt.hashSync('Owner@123', 4))
  restaurantId = Number(
    db
      .prepare(
        `INSERT INTO restaurants (owner_id, name, status, phone, email, city, operating_hours)
         VALUES (?, 'Saffron Test', 'live', '+91 local', 'local@iroas.test', 'Mumbai', ?)`,
      )
      .run(Number(owner.lastInsertRowid), JSON.stringify(LOCAL_HOURS)).lastInsertRowid,
  )
  db.prepare(
    `INSERT INTO restaurant_integrations
       (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile, ury_self_ordering_profile, credential_ref, status)
     VALUES (?, 'ury', 'Demo Restaurant', 'Demo Branch', 'Demo Profile', 'Demo Website', 'DEMO', 'active')`,
  ).run(restaurantId)

  appServer = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => appServer.once('listening', r))
  api = `http://127.0.0.1:${appServer.address().port}`
})

after(() => {
  Object.assign(console, originalConsole)
  appServer?.close()
  fakeServer.closeAllConnections?.()
  fakeServer.close()
  try {
    db?.close()
    for (const f of [tmpDb, `${tmpDb}-wal`, `${tmpDb}-shm`]) fs.rmSync(f, { force: true })
  } catch {
    // best effort
  }
})

beforeEach(() => {
  setFeatures(ALL_ON)
  Object.assign(fake, { addMode: 'ok', contextMode: 'ok', statusForbidden: false, slowMs: 400 })
  fake.requests.length = 0
  fake.addCalls.length = 0
  DOCS['URY Branch Operating Schedule'] = { 'Demo Branch': structuredClone(SCHEDULE) }
  LISTS['URY Branch Operating Exception'] = []
  DOCS['URY Restaurant']['Demo Restaurant'].address = 'Demo Address'
  delete process.env.URY_REQUEST_TIMEOUT_MS
  delete process.env.URY_GUEST_ORDER_RETRY_AFTER_MS
  for (const clear of Object.values(caches)) clear()
})

// ---------------------------------------------------------------- public site

test('hours, contact and menu come from URY when the demo switches are on', async () => {
  const today = new Date().toISOString().slice(0, 10)
  LISTS['URY Branch Operating Exception'] = [
    { name: 'x1', branch: 'Demo Branch', exception_date: '2099-12-25', is_closed: 1, reason: 'Christmas' },
    { name: 'x2', branch: 'Demo Branch', exception_date: '2000-01-01', is_closed: 1, reason: 'old' },
    { name: 'x3', branch: 'Other Branch', exception_date: today, is_closed: 1, reason: 'other' },
  ]
  const res = await call(`/api/public/${SLUG}`)
  assert.equal(res.status, 200, res.text)
  const { restaurant, ury, menu } = res.json

  assert.equal(ury.hours.status, 'ok')
  assert.equal(ury.hours.timezone, 'Africa/Johannesburg')
  assert.deepEqual(ury.hours.exceptions, [{ date: '2099-12-25', closed: true, open: null, close: null, reason: 'Christmas' }])
  const monday = restaurant.hours.find((d) => d.day === 'Monday')
  assert.deepEqual([monday.open, monday.close, monday.closed], ['11:00', '22:30', false])
  assert.deepEqual(monday.windows.map((w) => `${w.open}-${w.close}`), ['11:00-15:00', '18:00-22:30'])
  assert.equal(restaurant.hours.find((d) => d.day === 'Tuesday').open, '09:00')
  assert.equal(restaurant.hours.find((d) => d.day === 'Wednesday').closed, true, 'disabled window ignored')

  assert.equal(restaurant.phone, '+27 21 000 0000')
  assert.equal(restaurant.email, 'hello@demo.test')
  assert.equal(restaurant.address, '1 Long St')
  assert.equal(restaurant.city, 'Cape Town')

  assert.equal(ury.menu.status, 'ok')
  assert.equal(ury.menu.currency, 'ZAR')
  const items = ury.menu.categories.flatMap((c) => c.items)
  assert.deepEqual(items.map((i) => [i.code, i.price, i.available]), [['GR', 150, true], ['WNG', 99, true], ['MOM', 40, false]])
  assert.equal(ury.guestOrdering.enabled, true)
  assert.ok(Array.isArray(menu), 'local menu kept for QR table ordering')
  assert.ok(!res.text.includes('QR-S3CRET') && !res.text.includes(SECRET) && !res.text.includes('9999'))
})

test('missing schedule and address show a not-configured warning, never local or invented values', async () => {
  DOCS['URY Branch Operating Schedule'] = {}
  DOCS['URY Restaurant']['Demo Restaurant'].address = null
  const res = await call(`/api/public/${SLUG}`)
  const { restaurant, ury } = res.json
  assert.equal(ury.hours.status, 'not_configured')
  assert.match(ury.hours.message, /not been set up/)
  assert.deepEqual(restaurant.hours, [])
  assert.equal(ury.contact.status, 'not_configured')
  for (const k of ['phone', 'email', 'address', 'city', 'country']) assert.equal(restaurant[k], '', k)
})

test('a disabled schedule is reported as disabled', async () => {
  DOCS['URY Branch Operating Schedule']['Demo Branch'].enabled = 0
  const res = await call(`/api/public/${SLUG}`)
  assert.equal(res.json.ury.hours.status, 'disabled')
  assert.deepEqual(res.json.restaurant.hours, [])
})

test('URY outage: sections report unavailable and ordering is disabled (no local fallback)', async () => {
  process.env.URY_BASE_URL = 'http://127.0.0.1:1'
  try {
    const res = await call(`/api/public/${SLUG}`)
    assert.equal(res.status, 200)
    const { restaurant, ury } = res.json
    assert.equal(ury.hours.status, 'unavailable')
    assert.equal(ury.menu.status, 'unavailable')
    assert.equal(ury.guestOrdering.enabled, false)
    assert.deepEqual(restaurant.hours, [])
    assert.equal(restaurant.phone, '')
  } finally {
    process.env.URY_BASE_URL = `http://127.0.0.1:${fakeServer.address().port}`
  }
})

test('with the switches off the site is unchanged and makes no URY calls', async () => {
  setFeatures({ feature_hours: 0, feature_contact: 0, feature_menu: 0, feature_guest_ordering: 0 })
  const res = await call(`/api/public/${SLUG}`)
  assert.equal(res.status, 200)
  assert.equal(res.json.ury, undefined)
  assert.deepEqual(res.json.restaurant.hours, LOCAL_HOURS)
  assert.equal(res.json.restaurant.phone, '+91 local')
  assert.equal(fake.requests.length, 0)

  const blocked = await order(newSubmission())
  assert.equal(blocked.status, 404)
  assert.equal(blocked.json.code, 'ordering_unavailable')
  assert.equal(fake.addCalls.length, 0)
})

// ---------------------------------------------------------------- guest ordering

test('guest order is priced by URY, placed once, and replayed on duplicate submit', async () => {
  const id = newSubmission()
  const res = await order(id, [{ code: 'GR', qty: 2, price: 1 }, { code: 'WNG', qty: 1 }])
  assert.equal(res.status, 201, res.text)
  const data = res.json.data
  assert.equal(data.status, 'placed')
  assert.match(data.invoice, /^POS-INV-/)
  assert.equal(data.pickupCode, `P-${data.invoice}`)
  assert.equal(data.total, 399, 'total from URY rates, browser price ignored')
  assert.equal(data.guestDetailsStoredInPos, false)
  assert.ok(!res.text.includes('SES-'), 'URY session never exposed')

  assert.equal(fake.addCalls.length, 1)
  assert.deepEqual(fake.addCalls[0].items, [{ item: 'GR', qty: 2 }, { item: 'WNG', qty: 1 }])
  assert.ok(!JSON.stringify(fake.addCalls[0]).includes('555'), 'guest phone not sent to URY')
  const row = db.prepare('SELECT guest_name, guest_phone FROM ury_guest_orders WHERE submission_id = ?').get(id)
  assert.deepEqual(row, { guest_name: 'Thandi Guest', guest_phone: '+27825550101' })

  const again = await order(id, [{ code: 'GR', qty: 2 }, { code: 'WNG', qty: 1 }])
  assert.equal(again.status, 200)
  assert.equal(again.json.data.invoice, data.invoice)
  assert.equal(again.json.data.replay, true)
  assert.equal(fake.addCalls.length, 1, 'duplicate did not reach URY')

  const conflict = await order(id, [{ code: 'GR', qty: 5 }])
  assert.equal(conflict.status, 409)
  assert.equal(conflict.json.code, 'submission_conflict')

  const st = await status(id)
  assert.equal(st.status, 200)
  assert.equal(st.json.data.status, 'placed')
  assert.equal(st.json.data.live.state, 'open')
})

test('concurrent submits with the same id create one URY order', async () => {
  fake.addMode = 'slow_ok'
  fake.slowMs = 150
  const id = newSubmission()
  const [a, b] = await Promise.all([order(id), order(id)])
  const statuses = [a.status, b.status].sort()
  assert.deepEqual(statuses, [201, 202])
  assert.equal(fake.addCalls.length, 1)
  const st = await status(id)
  assert.equal(st.json.data.status, 'placed')
})

test('closed POS shift: order is rejected with a clear message and never reported as placed', async () => {
  fake.addMode = 'closed'
  const before = invoiceCount()
  const id = newSubmission()
  const res = await order(id)
  assert.equal(res.status, 409)
  assert.equal(res.json.success, false)
  assert.equal(res.json.code, 'pos_closed')
  assert.match(res.json.error, /POS shift is not open/)
  assert.equal(res.json.data.status, 'rejected')
  assert.equal(invoiceCount(), before)

  const st = await status(id)
  assert.equal(st.status, 409)
  assert.equal(st.json.data.status, 'rejected')
})

test('an item URY does not offer is rejected as unavailable', async () => {
  const res = await order(newSubmission(), [{ code: 'MOM', qty: 1 }])
  assert.equal(res.status, 422)
  assert.equal(res.json.code, 'item_unavailable')
})

test('invalid input is refused before contacting URY', async () => {
  const cases = [
    [{ submissionId: 'short' }, 'invalid_submission'],
    [{ items: [] }, 'items_required'],
    [{ items: [{ code: 'GR', qty: 0 }] }, 'invalid_qty'],
    [{ items: [{ code: 'GR', qty: 1.5 }] }, 'invalid_qty'],
    [{ guestName: '' }, 'invalid_name'],
    [{ guestPhone: '12' }, 'invalid_phone'],
  ]
  for (const [patch, code] of cases) {
    const res = await call(`/api/public/${SLUG}/ury-orders`, {
      method: 'POST',
      body: { submissionId: newSubmission(), items: [{ code: 'GR', qty: 1 }], guestName: 'A', guestPhone: '0825550101', ...patch },
    })
    assert.equal(res.status, 400, code)
    assert.equal(res.json.code, code)
  }
  assert.equal(fake.addCalls.length, 0)
})

test('URY failure before items are sent: not placed, retryable, retry with the same id succeeds', async () => {
  fake.contextMode = 'error500'
  const id = newSubmission()
  const res = await order(id)
  assert.equal(res.status, 502)
  assert.equal(res.json.code, 'pos_unavailable')
  assert.equal(res.json.data.retryable, true)
  assert.equal(fake.addCalls.length, 0)

  fake.contextMode = 'ok'
  const retry = await order(id)
  assert.equal(retry.status, 201, retry.text)
  assert.equal(fake.addCalls.length, 1)
})

test('URY 500 on add: outcome unknown, verified before any resend, resent only after the wait window', async () => {
  fake.addMode = 'error500'
  const id = newSubmission()
  const res = await order(id)
  assert.equal(res.status, 202)
  assert.equal(res.json.data.status, 'unknown')
  assert.equal(res.json.success, true)
  assert.equal(fake.addCalls.length, 1)

  fake.addMode = 'ok'
  const early = await order(id)
  assert.equal(early.status, 202, 'still inside the wait window: verify only')
  assert.equal(fake.addCalls.length, 1)
  assert.ok(fake.requests.some((r) => r.method === `${SO}.get_order_status`))

  process.env.URY_GUEST_ORDER_RETRY_AFTER_MS = '1'
  await new Promise((r) => setTimeout(r, 5))
  const late = await order(id)
  assert.equal(late.status, 201, late.text)
  assert.equal(fake.addCalls.length, 2)
  assert.equal(new Set(fake.addCalls.map((c) => c.session)).size, 1, 'retry reuses the same URY session')
})

test('timeout after URY saved the order: reconciled to placed without a second order', async () => {
  fake.addMode = 'slow'
  fake.slowMs = 500
  process.env.URY_REQUEST_TIMEOUT_MS = '150'
  const before = invoiceCount()
  const id = newSubmission()
  const res = await order(id)
  delete process.env.URY_REQUEST_TIMEOUT_MS
  assert.equal(res.status, 202, res.text)
  assert.equal(res.json.data.status, 'unknown')
  assert.match(res.json.data.message, /do not order again/i)

  const st = await status(id)
  assert.equal(st.status, 200, st.text)
  assert.equal(st.json.data.status, 'placed')
  assert.equal(invoiceCount(), before + 1)

  const resubmit = await order(id)
  assert.equal(resubmit.status, 200)
  assert.equal(fake.addCalls.length, 1)
})

test('expired URY session during verification: reported as unverified, never as placed or resent', async () => {
  fake.addMode = 'error500'
  const id = newSubmission()
  await order(id)
  fake.statusForbidden = true
  fake.addMode = 'ok'
  process.env.URY_GUEST_ORDER_RETRY_AFTER_MS = '1'
  const res = await order(id)
  assert.equal(res.status, 202)
  assert.equal(res.json.data.status, 'unknown')
  assert.equal(res.json.data.code, 'order_unverified')
  assert.equal(fake.addCalls.length, 1)
})

test('order status for an unknown submission id is 404', async () => {
  const res = await status(newSubmission())
  assert.equal(res.status, 404)
})

test('no URY credential material appears in responses or logs', async () => {
  const res = await order(newSubmission())
  assert.equal(res.status, 201)
  for (const s of [KEY, SECRET, 'QR-S3CRET', 'TOKEN-Demo']) {
    assert.ok(!res.text.includes(s))
    assert.ok(!logs.some((l) => l.includes(s)), `${s} in logs`)
  }
})

test('existing auth, QR table lookup and local flows still work', async () => {
  const login = await call('/api/auth/login', { method: 'POST', body: { email: 'owner@demo.test', password: 'Owner@123' } })
  assert.equal(login.status, 200, login.text)
  assert.ok(login.json.token)

  const tables = await call(`/api/public/${SLUG}/tables`)
  assert.equal(tables.status, 200)
  assert.ok(Array.isArray(tables.json.tables))
  const missing = await call(`/api/public/${SLUG}/table/NOPE`)
  assert.equal(missing.status, 404)
  assert.equal(fake.addCalls.length, 0)
})
