// Phase 1 — per-tenant URY identity and isolation.
// Runs the real IROAS app and URY client against a local fake Frappe server
// (two URY restaurants/branches, separate integration users). No network
// access to the real URY instance and no production data is touched.
//
//   cd server && npm test

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ---------------------------------------------------------------- fake URY
const SECRETS = { alphaPw: 'pw-alpha-S3CRET', betaKey: 'kb-KEY', betaSecret: 'sb-S3CRET', adminPw: 'pw-admin-S3CRET', strayPw: 'pw-stray-S3CRET' }
const PASSWORDS = { 'alpha@int': SECRETS.alphaPw, Administrator: SECRETS.adminPw, 'stray@int': SECRETS.strayPw }
const TOKENS = { [`${SECRETS.betaKey}:${SECRETS.betaSecret}`]: 'beta@int' }

const DOCS = {
  'URY Restaurant': {
    'Alpha Restaurant': { name: 'Alpha Restaurant', branch: 'Alpha Branch', company: 'Co', active_menu: 'Alpha Menu' },
    'Beta Restaurant': { name: 'Beta Restaurant', branch: 'Beta Branch', company: 'Co', active_menu: 'Beta Menu' },
  },
  Branch: {
    'Alpha Branch': {
      name: 'Alpha Branch',
      user: [
        { parent: 'Alpha Branch', user: 'alpha@int' },
        { parent: 'Alpha Branch', user: 'Administrator' },
      ],
    },
    'Beta Branch': { name: 'Beta Branch', user: [{ parent: 'Beta Branch', user: 'beta@int' }] },
  },
  'URY Menu': {
    'Alpha Menu': {
      name: 'Alpha Menu', branch: 'Alpha Branch', enabled: 1, price_list: 'Std',
      items: [{ parent: 'Alpha Menu', name: 'am1', item_name: 'Alpha Curry', rate: 10, course: 'Mains', idx: 1 }],
    },
    'Beta Menu': {
      name: 'Beta Menu', branch: 'Beta Branch', enabled: 1, price_list: 'Std',
      items: [{ parent: 'Beta Menu', name: 'bm1', item_name: 'Beta Soup', rate: 7, course: 'Starters', idx: 1 }],
    },
  },
  'Price List': { Std: { name: 'Std', currency: 'USD' } },
}

const LISTS = {
  'POS Profile': [
    { name: 'Alpha Profile', restaurant: 'Alpha Restaurant', branch: 'Alpha Branch', disabled: 0 },
    { name: 'Beta Profile', restaurant: 'Beta Restaurant', branch: 'Beta Branch', disabled: 0 },
    { name: 'Alpha Old Profile', restaurant: 'Alpha Restaurant', branch: 'Alpha Branch', disabled: 1 },
  ],
  'URY Self Ordering Profile': [
    { name: 'Alpha Self', restaurant: 'Alpha Restaurant', branch: 'Alpha Branch', pos_profile: 'Alpha Profile', enabled: 1, qr_signing_secret: 'QR-S3CRET', staff_pin: '9999' },
    { name: 'Beta Self', restaurant: 'Beta Restaurant', branch: 'Beta Branch', pos_profile: 'Beta Profile', enabled: 1, qr_signing_secret: 'QR-S3CRET', staff_pin: '9999' },
    { name: 'Alpha Self Off', restaurant: 'Alpha Restaurant', branch: 'Alpha Branch', pos_profile: 'Alpha Profile', enabled: 0, qr_signing_secret: 'QR-S3CRET', staff_pin: '9999' },
  ],
  'URY Table': [
    { name: 'A1', restaurant: 'Alpha Restaurant', restaurant_room: 'Hall', occupied: 0, no_of_seats: 4, is_take_away: 0 },
    { name: 'A2', restaurant: 'Alpha Restaurant', restaurant_room: 'Hall', occupied: 1, no_of_seats: 2, is_take_away: 0 },
    { name: 'B1', restaurant: 'Beta Restaurant', restaurant_room: 'Patio', occupied: 0, no_of_seats: 6, is_take_away: 0 },
  ],
}

const fake = { requests: [], leakTableFilter: false, sessions: new Map() }

function branchOf(user) {
  return Object.values(DOCS.Branch).find((b) => b.user.some((u) => u.user === user))?.name || null
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

function project(row, fields) {
  if (!fields || fields.includes('*')) return { ...row }
  return Object.fromEntries(fields.filter((f) => f in row).map((f) => [f, row[f]]))
}

const fakeServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://fake')
  const method = url.pathname.replace('/api/method/', '')
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (method === 'login') {
      const form = new URLSearchParams(body)
      const usr = form.get('usr')
      if (!PASSWORDS[usr] || PASSWORDS[usr] !== form.get('pwd')) return send(res, 401, { message: 'Invalid login credentials' })
      const sid = `sid-${Math.random().toString(36).slice(2)}`
      fake.sessions.set(sid, usr)
      return send(res, 200, { message: 'Logged In' }, { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly` })
    }

    let user = 'Guest'
    const auth = req.headers.authorization || ''
    if (auth.startsWith('token ')) {
      user = TOKENS[auth.slice(6)]
      if (!user) return send(res, 401, { exc_type: 'AuthenticationError' })
    } else {
      const sid = /sid=([^;]+)/.exec(req.headers.cookie || '')?.[1]
      if (sid && fake.sessions.has(sid)) user = fake.sessions.get(sid)
    }
    fake.requests.push({ user, method, doctype: url.searchParams.get('doctype'), fields: url.searchParams.get('fields') })

    if (method === 'frappe.auth.get_logged_user') return send(res, 200, { message: user })
    if (user === 'Guest') return send(res, 403, { exc_type: 'PermissionError' })

    if (method === 'frappe.desk.form.load.getdoc') {
      const doc = DOCS[url.searchParams.get('doctype')]?.[url.searchParams.get('name')]
      if (!doc) return send(res, 404, { exc_type: 'DoesNotExistError' })
      return send(res, 200, { docs: [doc] })
    }
    if (method === 'frappe.desk.reportview.get_list') {
      const doctype = url.searchParams.get('doctype')
      const fields = JSON.parse(url.searchParams.get('fields') || 'null')
      const filters = JSON.parse(url.searchParams.get('filters') || '{}')
      let rows = LISTS[doctype] || []
      if (!(doctype === 'URY Table' && fake.leakTableFilter)) {
        rows = rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v))
      }
      return send(res, 200, { message: rows.map((r) => project(r, fields)) })
    }
    if (method === 'ury.ury_pos.api.getPosProfile') {
      const branch = branchOf(user)
      if (!branch) return send(res, 417, { exc_type: 'ValidationError' })
      const profile = LISTS['POS Profile'].find((p) => p.branch === branch)
      return send(res, 200, { message: { pos_profile: profile.name, branch, waiter: user } })
    }
    return send(res, 404, { exc_type: 'DoesNotExistError' })
  })
})

// ---------------------------------------------------------------- IROAS app
const tmpDb = path.join(os.tmpdir(), `iroas-ury-test-${process.pid}-${Date.now()}.db`)
let api
let appServer
let db
let signToken
let uryTenant
let users = {}
let restaurants = {}
const logs = []
const originalConsole = { warn: console.warn, info: console.info, error: console.error, log: console.log }

async function call(pathname, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${api}${pathname}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
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
function updateMapping(restaurantId, fields) {
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`)
  db.prepare(
    `UPDATE restaurant_integrations SET ${[...sets, 'updated_at = @stamp'].join(', ')} WHERE restaurant_id = @rid`,
  ).run({ ...fields, stamp: `t${(stamp += 1)}`, rid: restaurantId })
}

const ALPHA = { external_restaurant: 'Alpha Restaurant', ury_branch: 'Alpha Branch', ury_pos_profile: 'Alpha Profile', ury_self_ordering_profile: 'Alpha Self', credential_ref: 'ALPHA', status: 'active' }
const BETA = { external_restaurant: 'Beta Restaurant', ury_branch: 'Beta Branch', ury_pos_profile: 'Beta Profile', ury_self_ordering_profile: 'Beta Self', credential_ref: 'BETA', status: 'active' }

before(async () => {
  await new Promise((r) => fakeServer.listen(0, '127.0.0.1', r))
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_PATH: tmpDb,
    JWT_SECRET: 'test-jwt-secret',
    URY_BASE_URL: `http://127.0.0.1:${fakeServer.address().port}`,
    URY_USERNAME: 'Administrator',
    URY_PASSWORD: SECRETS.adminPw,
    URY_CRED_ALPHA_USERNAME: 'alpha@int',
    URY_CRED_ALPHA_PASSWORD: SECRETS.alphaPw,
    URY_CRED_BETA_API_KEY: SECRETS.betaKey,
    URY_CRED_BETA_API_SECRET: SECRETS.betaSecret,
    URY_CRED_ADMIN_USERNAME: 'Administrator',
    URY_CRED_ADMIN_PASSWORD: SECRETS.adminPw,
    URY_CRED_STRAY_USERNAME: 'stray@int',
    URY_CRED_STRAY_PASSWORD: SECRETS.strayPw,
    URY_CRED_BADPW_USERNAME: 'alpha@int',
    URY_CRED_BADPW_PASSWORD: 'wrong-password',
  })
  delete process.env.URY_ALLOW_ADMINISTRATOR_CREDENTIAL

  for (const k of Object.keys(originalConsole)) console[k] = (...args) => logs.push(args.map(String).join(' '))

  ;({ db } = await import('../src/infra/db.js'))
  ;({ signToken } = await import('../src/middleware/auth.js'))
  uryTenant = await import('../src/integrations/ury/uryTenant.js')
  const bcrypt = (await import('bcryptjs')).default
  const { createApp } = await import('../src/app.js')

  const hash = bcrypt.hashSync('Owner@123', 4)
  for (const key of ['a', 'b', 'c', 'nobody']) {
    const info = db
      .prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'owner')`)
      .run(`Owner ${key}`, `owner-${key}@test.local`, hash)
    users[key] = { id: Number(info.lastInsertRowid), email: `owner-${key}@test.local`, name: `Owner ${key}`, role: 'owner' }
  }
  for (const key of ['a', 'b', 'c']) {
    const info = db.prepare(`INSERT INTO restaurants (owner_id, name) VALUES (?, ?)`).run(users[key].id, `Rest ${key}`)
    restaurants[key] = Number(info.lastInsertRowid)
  }
  const insert = db.prepare(
    `INSERT INTO restaurant_integrations
       (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile, ury_self_ordering_profile, credential_ref, status)
     VALUES (@rid, 'ury', @external_restaurant, @ury_branch, @ury_pos_profile, @ury_self_ordering_profile, @credential_ref, @status)`,
  )
  insert.run({ rid: restaurants.a, ...ALPHA })
  insert.run({ rid: restaurants.b, ...BETA })

  appServer = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => appServer.once('listening', r))
  api = `http://127.0.0.1:${appServer.address().port}`
})

after(() => {
  Object.assign(console, originalConsole)
  appServer?.close()
  fakeServer.close()
  try {
    db?.close()
    for (const f of [tmpDb, `${tmpDb}-wal`, `${tmpDb}-shm`]) fs.rmSync(f, { force: true })
  } catch {
    // best effort
  }
})

beforeEach(() => {
  updateMapping(restaurants.a, ALPHA)
  updateMapping(restaurants.b, BETA)
  fake.leakTableFilter = false
  fake.requests.length = 0
  uryTenant.clearUryTenantCache()
})

const token = (key) => signToken(users[key])

// ---------------------------------------------------------------- tests

test('1. two IROAS restaurants mapped to different URY restaurants each see only their own tables and menu', async () => {
  const a = await call('/api/restaurant/pos-tables', { token: token('a') })
  const b = await call('/api/restaurant/pos-tables', { token: token('b') })
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
  assert.deepEqual(a.json.data.tables.map((t) => t.id), ['A1', 'A2'])
  assert.deepEqual(b.json.data.tables.map((t) => t.id), ['B1'])

  const ma = await call('/api/restaurant/pos-menu', { token: token('a') })
  const mb = await call('/api/restaurant/pos-menu', { token: token('b') })
  assert.equal(ma.status, 200)
  assert.deepEqual(ma.json.data.categories.flatMap((c) => c.items.map((i) => i.name)), ['Alpha Curry'])
  assert.deepEqual(mb.json.data.categories.flatMap((c) => c.items.map((i) => i.name)), ['Beta Soup'])
})

test('1b. each tenant authenticates to URY as its own integration user (never the operator/Administrator)', async () => {
  await call('/api/restaurant/pos-tables', { token: token('a') })
  const aUsers = new Set(fake.requests.map((r) => r.user))
  assert.deepEqual([...aUsers], ['alpha@int'])

  fake.requests.length = 0
  await call('/api/restaurant/pos-tables', { token: token('b') })
  assert.deepEqual([...new Set(fake.requests.map((r) => r.user))], ['beta@int'])
})

test('2. restaurant A cannot read restaurant B tables or menu via browser-supplied ids', async () => {
  for (const p of ['/api/restaurant/pos-tables', '/api/restaurant/pos-menu']) {
    const res = await call(`${p}?restaurantId=${restaurants.b}&restaurant=Beta%20Restaurant`, { token: token('a') })
    assert.equal(res.status, 200)
    assert.ok(!res.text.includes('Beta'), `${p} leaked Beta data`)
  }
})

test('2b. tables stay isolated even if URY ignores the restaurant filter', async () => {
  fake.leakTableFilter = true
  const a = await call('/api/restaurant/pos-tables', { token: token('a') })
  assert.deepEqual(a.json.data.tables.map((t) => t.id), ['A1', 'A2'])
})

test('3. a mismatched POS Profile is rejected', async () => {
  updateMapping(restaurants.a, { ury_pos_profile: 'Beta Profile', ury_self_ordering_profile: null })
  const res = await call('/api/restaurant/pos-tables', { token: token('a') })
  assert.equal(res.status, 409)
  assert.equal(res.json.code, 'pos_mapping_invalid')
  assert.equal(res.json.data, undefined)
  assert.ok(logs.some((l) => l.includes('reason=pos_profile_mismatch')))

  // A disabled profile of the same restaurant is also refused.
  updateMapping(restaurants.a, { ury_pos_profile: 'Alpha Old Profile', ury_self_ordering_profile: null })
  const r2 = await call('/api/restaurant/pos-menu', { token: token('a') })
  assert.equal(r2.status, 409)
  assert.equal(r2.json.code, 'pos_mapping_invalid')
})

test('4. a mismatched, disabled or missing self-ordering profile is rejected', async () => {
  for (const [profile, reason] of [
    ['Beta Self', 'self_ordering_profile_mismatch'],
    ['Alpha Self Off', 'self_ordering_profile_disabled'],
    ['No Such Profile', 'self_ordering_profile_not_found'],
  ]) {
    uryTenant.clearUryTenantCache()
    updateMapping(restaurants.a, { ury_self_ordering_profile: profile })
    const res = await call('/api/restaurant/pos-tables', { token: token('a') })
    assert.equal(res.status, 409, profile)
    assert.equal(res.json.code, 'pos_mapping_invalid')
    assert.ok(logs.some((l) => l.includes(`reason=${reason}`)), reason)
  }
})

test('4b. self-ordering secrets are never requested from URY', async () => {
  const res = await call('/api/restaurant/pos-tables', { token: token('a') })
  assert.equal(res.status, 200)
  const selfReads = fake.requests.filter((r) => r.doctype === 'URY Self Ordering Profile')
  assert.equal(selfReads.length, 1)
  const fields = JSON.parse(selfReads[0].fields)
  assert.ok(!fields.includes('*') && !fields.includes('qr_signing_secret') && !fields.includes('staff_pin'))
  assert.ok(!res.text.includes('QR-S3CRET'))
})

test('5. missing credentials, rejected credentials, incomplete or disabled mappings fail safely', async () => {
  const cases = [
    [{ credential_ref: 'MISSING' }, 409, 'pos_mapping_invalid', 'credentials_missing'],
    [{ credential_ref: 'BADPW' }, 409, 'pos_mapping_invalid', 'credentials_rejected'],
    [{ credential_ref: 'not a ref' }, 409, 'pos_mapping_invalid', 'mapping_incomplete:credential_ref'],
    [{ ury_branch: null, ury_pos_profile: null }, 409, 'pos_mapping_invalid', 'mapping_incomplete:branch,pos_profile'],
    [{ status: 'disabled' }, 409, 'pos_not_connected', null],
  ]
  for (const [fields, status, code, reason] of cases) {
    uryTenant.clearUryTenantCache()
    updateMapping(restaurants.a, fields)
    const res = await call('/api/restaurant/pos-tables', { token: token('a') })
    assert.equal(res.status, status, JSON.stringify(fields))
    assert.equal(res.json.code, code)
    assert.equal(res.json.data, undefined)
    if (reason) assert.ok(logs.some((l) => l.includes(`reason=${reason}`)), reason)
    updateMapping(restaurants.a, ALPHA)
  }

  const saved = process.env.URY_BASE_URL
  process.env.URY_BASE_URL = ''
  try {
    const res = await call('/api/restaurant/pos-tables', { token: token('a') })
    assert.equal(res.json.code, 'pos_not_connected')
  } finally {
    process.env.URY_BASE_URL = saved
  }
})

test('5b. swapped, shared, branchless and Administrator credentials are rejected', async () => {
  const { verifyUryMapping } = uryTenant
  const { getTenantClient } = await import('../src/integrations/ury/uryCredentials.js')
  const mapping = (ref) => ({ ...ALPHA, credential_ref: ref })
  const reasonOf = async (ref, rid = 999999) => {
    try {
      await verifyUryMapping(mapping(ref), getTenantClient(ref), { restaurantId: rid })
      return 'ok'
    } catch (err) {
      return err.reason || err.code
    }
  }

  // Tenant B's credential pointed at restaurant A: B's user is not in Alpha Branch.
  assert.equal(await reasonOf('BETA', restaurants.b), 'user_not_in_branch')
  // A URY user already verified for another IROAS restaurant cannot back a second one.
  await call('/api/restaurant/pos-tables', { token: token('a') })
  assert.equal(await reasonOf('ALPHA', 999999), 'credential_shared')
  // A user in no branch at all.
  assert.equal(await reasonOf('STRAY'), 'user_not_in_branch')
  // Administrator is refused by default...
  assert.equal(await reasonOf('ADMIN'), 'administrator_credential')
  // ...and in production even with the dev override set.
  process.env.URY_ALLOW_ADMINISTRATOR_CREDENTIAL = 'true'
  process.env.NODE_ENV = 'production'
  try {
    assert.equal(await reasonOf('ADMIN'), 'administrator_credential')
  } finally {
    process.env.NODE_ENV = 'test'
    delete process.env.URY_ALLOW_ADMINISTRATOR_CREDENTIAL
  }
})

test('5c. a restaurant whose URY branch no longer matches the mapping is rejected', async () => {
  updateMapping(restaurants.a, { ury_branch: 'Beta Branch', ury_self_ordering_profile: null })
  const res = await call('/api/restaurant/pos-tables', { token: token('a') })
  assert.equal(res.status, 409)
  assert.ok(logs.some((l) => l.includes('reason=restaurant_branch_mismatch')))
})

test('6. unauthenticated and unauthorized requests are rejected', async () => {
  for (const p of ['/api/restaurant/pos-tables', '/api/restaurant/pos-menu', '/api/restaurant/pos-orders', '/api/restaurant/pos-staff']) {
    assert.equal((await call(p)).status, 401, p)
    assert.equal((await call(p, { token: 'not-a-jwt' })).status, 401, p)
  }
  // Signed in but owns no restaurant.
  assert.equal((await call('/api/restaurant/pos-tables', { token: token('nobody') })).status, 404)
  // Owns a restaurant with no URY mapping: never falls back to another tenant.
  const c = await call(`/api/restaurant/pos-tables?restaurantId=${restaurants.a}`, { token: token('c') })
  assert.equal(c.status, 409)
  assert.equal(c.json.code, 'pos_not_connected')
  assert.equal(fake.requests.length, 0)
})

test('6b. no credential material appears in responses, logs or the database', async () => {
  updateMapping(restaurants.a, { credential_ref: 'BADPW' })
  await call('/api/restaurant/pos-tables', { token: token('a') })
  updateMapping(restaurants.a, ALPHA)
  uryTenant.clearUryTenantCache()
  const ok = await call('/api/restaurant/pos-tables', { token: token('a') })
  const dbDump = JSON.stringify(db.prepare('SELECT * FROM restaurant_integrations').all())
  for (const secret of [...Object.values(SECRETS), 'wrong-password']) {
    assert.ok(!ok.text.includes(secret))
    assert.ok(!logs.some((l) => l.includes(secret)), 'secret in logs')
    assert.ok(!dbDump.includes(secret), 'secret in DB')
  }
})

test('6c. verified mapping records the integration user (non-secret) for audit', async () => {
  await call('/api/restaurant/pos-tables', { token: token('b') })
  const row = db.prepare('SELECT verified_user, verified_at FROM restaurant_integrations WHERE restaurant_id = ?').get(restaurants.b)
  assert.equal(row.verified_user, 'beta@int')
  assert.ok(row.verified_at)
})

test('7. existing IROAS auth, restaurant, local tables and reservations still work', async () => {
  const login = await call('/api/auth/login', { method: 'POST', body: { email: users.c.email, password: 'Owner@123' } })
  assert.equal(login.status, 200, login.text)
  assert.ok(login.json.token)
  const bad = await call('/api/auth/login', { method: 'POST', body: { email: users.c.email, password: 'nope' } })
  assert.equal(bad.status, 401)

  const me = await call('/api/auth/me', { token: login.json.token })
  assert.equal(me.status, 200)
  assert.equal((await call('/api/restaurant', { token: token('c') })).status, 200)

  const created = await call('/api/restaurant/tables', { method: 'POST', token: token('c'), body: { name: 'T1', seats: 4 } })
  assert.equal(created.status, 201, created.text)
  const list = await call('/api/restaurant/tables', { token: token('c') })
  assert.equal(list.status, 200)
  assert.deepEqual(list.json.tables.map((t) => t.name), ['T1'])
  // Local tables are per restaurant.
  const other = await call('/api/restaurant/tables', { token: token('a') })
  assert.deepEqual(other.json.tables, [])

  const reservations = await call('/api/restaurant/reservations', { token: token('c') })
  assert.equal(reservations.status, 200, reservations.text)
  assert.equal(fake.requests.length, 0, 'local features must not call URY')
})
