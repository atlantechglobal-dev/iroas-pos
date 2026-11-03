// POS provisioning status: requests are recorded, everything else is derived
// from the real integration row so the status cannot disagree with reality.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-prov-')), 'test.db')
let server
let base
let db
let liveId
let pendingId
let otherLiveId
const tokens = {}

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: tmpDb, JWT_SECRET: 'test-jwt-secret' })
  ;({ db } = await import('../src/infra/db.js'))
  const { signToken } = await import('../src/middleware/auth.js')
  const { createApp } = await import('../src/app.js')
  const { createPlatformStaff } = await import('../src/services/platformAdminService.js')

  const admin = createPlatformStaff({ name: 'Admin', email: 'admin@t.local', password: 'password-1', role: 'admin' })
  const spec = createPlatformStaff({ name: 'Spec', email: 'spec@t.local', password: 'password-2', role: 'specialist' })
  const mkOwner = (email) =>
    Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', ?, 'x', 'owner')`).run(email).lastInsertRowid)
  const mkRestaurant = (ownerId, name, status) =>
    Number(db.prepare(`INSERT INTO restaurants (owner_id, name, status) VALUES (?, ?, ?)`).run(ownerId, name, status).lastInsertRowid)
  const o1 = mkOwner('o1@t.local')
  liveId = mkRestaurant(o1, 'Live Resto', 'live')
  pendingId = mkRestaurant(mkOwner('o2@t.local'), 'Pending Resto', 'pending_approval')
  otherLiveId = mkRestaurant(mkOwner('o3@t.local'), 'Other Live', 'live')

  tokens.admin = signToken({ id: admin.id, email: admin.email, name: admin.name, role: 'admin' })
  tokens.specialist = signToken({ id: spec.id, email: spec.email, name: spec.name, role: 'specialist' })
  tokens.owner = signToken({ id: o1, email: 'o1@t.local', name: 'O', role: 'owner' })

  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
  db.close()
})

const call = (role, method, url, body) =>
  fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  })

test('a new tenant starts as not_requested with the four steps undone', async () => {
  const res = await call('admin', 'GET', `/api/admin/tenants/${liveId}/provisioning`)
  assert.equal(res.status, 200)
  const { provisioning: p } = await res.json()
  assert.equal(p.state, 'not_requested')
  assert.deepEqual(p.steps.map((s) => s.done), [false, false, false, false])
  assert.ok(p.operatorPlan.some((line) => line.includes('provision_tenant.sh')))
  assert.ok(!JSON.stringify(p).match(/API_SECRET=|password=[^<]/i), 'plan must not contain secrets')
})

test('only an approved (live) tenant can request a site', async () => {
  const res = await call('admin', 'POST', `/api/admin/tenants/${pendingId}/provisioning`, { siteName: 'pending.pos.test' })
  assert.equal(res.status, 409)
})

test('site name must be a valid hostname', async () => {
  for (const siteName of ['', 'has space', 'a/b', '-bad.test', 'x'.repeat(300)]) {
    const res = await call('admin', 'POST', `/api/admin/tenants/${liveId}/provisioning`, { siteName })
    assert.equal(res.status, 400, JSON.stringify(siteName))
  }
})

test('request is recorded, normalised, audited and idempotent per tenant', async () => {
  const res = await call('admin', 'POST', `/api/admin/tenants/${liveId}/provisioning`, { siteName: 'Acme.POS.Test' })
  assert.equal(res.status, 201)
  const { provisioning: p } = await res.json()
  assert.equal(p.state, 'requested')
  assert.equal(p.request.siteName, 'acme.pos.test')
  assert.deepEqual(p.steps.map((s) => s.done), [true, false, false, false])

  const again = await call('admin', 'POST', `/api/admin/tenants/${liveId}/provisioning`, { siteName: 'acme2.pos.test' })
  assert.equal(again.status, 201)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ury_provisioning_requests WHERE restaurant_id = ?').get(liveId).n, 1)

  const audit = db.prepare(`SELECT action FROM platform_audit WHERE action = 'provisioning.request'`).all()
  assert.ok(audit.length >= 2)
})

test('two tenants cannot request the same site name', async () => {
  const res = await call('admin', 'POST', `/api/admin/tenants/${otherLiveId}/provisioning`, { siteName: 'acme2.pos.test' })
  assert.equal(res.status, 409)
})

test('cancel removes the request', async () => {
  const res = await call('admin', 'DELETE', `/api/admin/tenants/${liveId}/provisioning`)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).provisioning.state, 'not_requested')
})

test('state becomes linked only from a real, verified, active integration', async () => {
  await call('admin', 'POST', `/api/admin/tenants/${liveId}/provisioning`, { siteName: 'acme.pos.test' })

  // integration row exists but was never verified -> not "linked"
  db.prepare(
    `INSERT INTO restaurant_integrations (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile, ury_site_name, status, feature_menu)
     VALUES (?, 'ury', 'Acme', 'Acme Branch', 'Acme Profile', 'acme.pos.test', 'active', 1)`,
  ).run(liveId)
  let p = (await (await call('admin', 'GET', `/api/admin/tenants/${liveId}/provisioning`)).json()).provisioning
  assert.equal(p.state, 'disabled')

  db.prepare(`UPDATE restaurant_integrations SET verified_at = datetime('now') WHERE restaurant_id = ?`).run(liveId)
  p = (await (await call('admin', 'GET', `/api/admin/tenants/${liveId}/provisioning`)).json()).provisioning
  assert.equal(p.state, 'linked')
  assert.deepEqual(p.integration.features, ['menu'])
  assert.deepEqual(p.steps.map((s) => s.done), [true, true, true, true])
  assert.equal(p.integration.siteName, 'acme.pos.test')

  // a linked site can be neither cancelled nor re-requested here
  assert.equal((await call('admin', 'DELETE', `/api/admin/tenants/${liveId}/provisioning`)).status, 409)
  assert.equal((await call('admin', 'POST', `/api/admin/tenants/${liveId}/provisioning`, { siteName: 'x.pos.test' })).status, 409)

  // a different tenant cannot take a site name that is already linked
  assert.equal((await call('admin', 'POST', `/api/admin/tenants/${otherLiveId}/provisioning`, { siteName: 'acme.pos.test' })).status, 409)

  db.prepare('DELETE FROM restaurant_integrations WHERE restaurant_id = ?').run(liveId)
})

test('list endpoint reports a state for every non-deleted tenant', async () => {
  const { tenants } = await (await call('admin', 'GET', '/api/admin/provisioning')).json()
  assert.deepEqual(
    tenants.map((t) => t.restaurantId).sort((a, b) => a - b),
    [liveId, pendingId, otherLiveId].sort((a, b) => a - b),
  )
})

test('specialist can read but not change provisioning; owner and anonymous cannot do either', async () => {
  assert.equal((await call('specialist', 'GET', `/api/admin/tenants/${liveId}/provisioning`)).status, 200)
  assert.equal((await call('specialist', 'GET', '/api/admin/provisioning')).status, 200)
  assert.equal((await call('specialist', 'POST', `/api/admin/tenants/${otherLiveId}/provisioning`, { siteName: 's.pos.test' })).status, 403)
  assert.equal((await call('specialist', 'DELETE', `/api/admin/tenants/${liveId}/provisioning`)).status, 403)
  assert.equal((await call('owner', 'GET', `/api/admin/tenants/${liveId}/provisioning`)).status, 403)
  assert.equal((await call(undefined, 'GET', `/api/admin/tenants/${liveId}/provisioning`)).status, 401)
})

test('unknown tenant gives 404', async () => {
  assert.equal((await call('admin', 'GET', '/api/admin/tenants/999999/provisioning')).status, 404)
})
