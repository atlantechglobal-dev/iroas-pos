import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-progress-')), 'test.db')
let server
let base
let db
let ids
let tokens
let getOnboardingProgress

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: tmpDb, JWT_SECRET: 'test-jwt-secret' })
  ;({ db } = await import('../src/infra/db.js'))
  ;({ getOnboardingProgress } = await import('../src/services/onboardingProgress.js'))
  const { signToken } = await import('../src/middleware/auth.js')
  const { createApp } = await import('../src/app.js')
  const user = (name, role) => Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'x', ?)`).run(name, `${name}@t.local`, role).lastInsertRowid)
  const empty = user('empty', 'owner')
  const full = user('full', 'owner')
  const admin = user('admin', 'admin')
  const specialist = user('specialist', 'specialist')
  const hours = JSON.stringify([{ day: 'Mon', open: '11:00', close: '22:00', closed: false }])
  const restaurant = (owner, name, extra = {}) =>
    Number(
      db
        .prepare(
          `INSERT INTO restaurants (owner_id, name, status, phone, address, city, operating_hours, logo_data_url, subdomain, settings_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(owner, name, extra.status || 'onboarding', extra.phone || null, extra.address || null, extra.city || null, extra.hours || null, extra.logo || null, extra.subdomain || null, extra.settings || null).lastInsertRowid,
    )
  ids = {
    empty: restaurant(empty, 'Empty Resto'),
    full: restaurant(full, 'Full Resto', {
      status: 'live',
      phone: '021 555 0100',
      address: '1 Long St',
      city: 'Cape Town',
      hours,
      logo: 'data:image/png;base64,AAAA',
      subdomain: 'full',
      settings: JSON.stringify({ onboardingPayment: { paid: true } }),
    }),
  }
  db.prepare(`INSERT INTO menu_categories (restaurant_id, name) VALUES (?, 'Mains')`).run(ids.full)
  db.prepare(`INSERT INTO menu_items (restaurant_id, category_id, name, price) VALUES (?, 1, 'Burger', 99)`).run(ids.full)
  db.prepare(`INSERT INTO dining_tables (restaurant_id, name, seats, active) VALUES (?, 'T1', 4, 1)`).run(ids.full)
  db.prepare(
    `INSERT INTO restaurant_integrations (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile, credential_ref, status, verified_at)
     VALUES (?, 'ury', 'R', 'B', 'P', 'T1', 'active', datetime('now'))`,
  ).run(ids.full)
  tokens = {
    empty: signToken({ id: empty, role: 'owner', email: 'empty@t.local' }),
    admin: signToken({ id: admin, role: 'admin', email: 'admin@t.local' }),
    specialist: signToken({ id: specialist, role: 'specialist', email: 'specialist@t.local' }),
  }
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

const get = (url, token) => fetch(`${base}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

test('a new restaurant starts with nothing done and is told what to add', () => {
  const p = getOnboardingProgress(ids.empty)
  assert.equal(p.done, 0)
  assert.equal(p.total, 8)
  assert.equal(p.nextStep, 'profile')
  const profile = p.steps.find((s) => s.key === 'profile')
  assert.match(profile.detail, /phone, address, city, opening hours/)
})

test('a fully set up live restaurant has every step done', () => {
  const p = getOnboardingProgress(ids.full)
  assert.deepEqual(p.steps.filter((s) => !s.done).map((s) => s.key), [])
  assert.equal(p.complete, true)
  assert.equal(p.nextStep, null)
})

test('a closed-all-week schedule does not count as opening hours', () => {
  db.prepare(`UPDATE restaurants SET operating_hours = ? WHERE id = ?`).run(JSON.stringify([{ day: 'Mon', closed: true }]), ids.full)
  assert.equal(getOnboardingProgress(ids.full).steps.find((s) => s.key === 'profile').done, false)
  db.prepare(`UPDATE restaurants SET operating_hours = ? WHERE id = ?`).run(JSON.stringify([{ day: 'Mon', open: '11:00', close: '22:00', closed: false }]), ids.full)
})

test('owner endpoint returns their own progress only', async () => {
  const res = await get('/api/restaurant/onboarding-progress', tokens.empty)
  assert.equal(res.status, 200)
  const { progress } = await res.json()
  assert.equal(progress.restaurantId, ids.empty)
  assert.equal((await get('/api/restaurant/onboarding-progress')).status, 401)
})

test('admin sees any tenant; specialist can read it; an owner cannot', async () => {
  const asAdmin = await get(`/api/admin/tenants/${ids.full}/onboarding`, tokens.admin)
  assert.equal(asAdmin.status, 200)
  assert.equal((await asAdmin.json()).progress.done, 8)
  assert.equal((await get(`/api/admin/tenants/${ids.empty}/onboarding`, tokens.specialist)).status, 200)
  assert.equal((await get(`/api/admin/tenants/${ids.empty}/onboarding`, tokens.empty)).status, 403)
  assert.equal((await get('/api/admin/tenants/99999/onboarding', tokens.admin)).status, 404)
})

test('the tenant list carries a done/total count per tenant', async () => {
  const { tenants } = await (await get('/api/admin/tenants', tokens.admin)).json()
  const byId = Object.fromEntries(tenants.map((t) => [t.id, t]))
  assert.deepEqual([byId[ids.empty].onboardingDone, byId[ids.empty].onboardingTotal], [0, 8])
  assert.deepEqual([byId[ids.full].onboardingDone, byId[ids.full].onboardingTotal], [8, 8])
})
