// Platform roles: Super Admin vs Onboarding Specialist vs restaurant owner.
// Specialist may follow tenants through onboarding; everything else in
// /api/admin is Super Admin only (default-deny).

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-roles-')), 'test.db')
let server
let base
let db
const tokens = {}

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: tmpDb, JWT_SECRET: 'test-jwt-secret' })
  ;({ db } = await import('../src/infra/db.js'))
  const { signToken } = await import('../src/middleware/auth.js')
  const { createApp } = await import('../src/app.js')
  const { createPlatformStaff } = await import('../src/services/platformAdminService.js')
  const bcrypt = (await import('bcryptjs')).default

  const admin = createPlatformStaff({ name: 'Admin', email: 'admin@t.local', password: 'password-1', role: 'admin' })
  const specialist = createPlatformStaff({ name: 'Spec', email: 'spec@t.local', password: 'password-2', role: 'specialist' })
  const ownerId = Number(
    db
      .prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('Owner', 'owner@t.local', ?, 'owner')`)
      .run(bcrypt.hashSync('password-3', 4)).lastInsertRowid,
  )
  db.prepare(`INSERT INTO restaurants (owner_id, name, status) VALUES (?, 'Resto', 'pending_approval')`).run(ownerId)
  tokens.admin = signToken({ id: admin.id, email: admin.email, name: admin.name, role: 'admin' })
  tokens.specialist = signToken({ id: specialist.id, email: specialist.email, name: specialist.name, role: 'specialist' })
  tokens.owner = signToken({ id: ownerId, email: 'owner@t.local', name: 'Owner', role: 'owner' })

  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
})

const call = (role, method, url, body) =>
  fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  })

test('createPlatformStaff stores the requested role and defaults to admin', async () => {
  const { createPlatformStaff } = await import('../src/services/platformAdminService.js')
  assert.equal(createPlatformStaff({ name: 'X', email: 'x@t.local', password: 'password-9' }).role, 'admin')
  assert.equal(createPlatformStaff({ name: 'Y', email: 'y@t.local', password: 'password-9', role: 'specialist' }).role, 'specialist')
  assert.equal(createPlatformStaff({ name: 'Z', email: 'z@t.local', password: 'password-9', role: 'owner' }).role, 'admin')
})

test('specialist can read tenants, stats and identities', async () => {
  for (const url of ['/api/admin/stats', '/api/admin/tenants', '/api/admin/identities', '/api/admin/feed']) {
    const res = await call('specialist', 'GET', url)
    assert.equal(res.status, 200, url)
  }
})

test('specialist cannot approve, reject, delete or change tenant status', async () => {
  const id = db.prepare('SELECT id FROM restaurants LIMIT 1').get().id
  const attempts = [
    ['POST', `/api/admin/tenants/${id}/approve`],
    ['POST', `/api/admin/tenants/${id}/reject`],
    ['DELETE', `/api/admin/tenants/${id}`],
    ['PATCH', `/api/admin/tenants/${id}/status`],
    ['PATCH', `/api/admin/tenants/${id}`],
  ]
  for (const [method, url] of attempts) {
    const res = await call('specialist', method, url, { status: 'live' })
    assert.equal(res.status, 403, `${method} ${url}`)
  }
  assert.equal(db.prepare('SELECT status FROM restaurants WHERE id = ?').get(id).status, 'pending_approval')
})

test('specialist cannot touch platform configuration, plans, flags, audit or staff', async () => {
  const attempts = [
    ['GET', '/api/admin/plans'],
    ['POST', '/api/admin/plans'],
    ['PUT', '/api/admin/feature-flags'],
    ['GET', '/api/admin/audit'],
    ['GET', '/api/admin/staff'],
    ['POST', '/api/admin/staff'],
    ['PUT', '/api/admin/payment-settings'],
    ['PUT', '/api/admin/email-settings'],
    ['GET', '/api/admin/health'],
  ]
  for (const [method, url] of attempts) {
    const res = await call('specialist', method, url, { name: 'n', email: 'n@t.local', password: 'password-1' })
    assert.equal(res.status, 403, `${method} ${url}`)
  }
})

test('super admin keeps full access', async () => {
  for (const url of ['/api/admin/stats', '/api/admin/tenants', '/api/admin/plans', '/api/admin/audit', '/api/admin/staff']) {
    assert.equal((await call('admin', 'GET', url)).status, 200, url)
  }
  const created = await call('admin', 'POST', '/api/admin/staff', {
    name: 'New Spec', email: 'newspec@t.local', password: 'password-5', role: 'specialist',
  })
  assert.equal(created.status, 201)
  assert.equal((await created.json()).user.role, 'specialist')
})

test('restaurant owner and anonymous users cannot reach /api/admin at all', async () => {
  assert.equal((await call('owner', 'GET', '/api/admin/stats')).status, 403)
  assert.equal((await call('owner', 'GET', '/api/admin/tenants')).status, 403)
  assert.equal((await call(undefined, 'GET', '/api/admin/stats')).status, 401)
})

test('specialist logs in without the restaurant account-approval gate', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'spec@t.local', password: 'password-2' }),
  })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).user.role, 'specialist')
})
