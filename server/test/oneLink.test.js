import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-onelink-')), 'test.db')
let server
let base
let db
let auth

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: tmpDb, JWT_SECRET: 'test-jwt-secret' })
  ;({ db } = await import('../src/infra/db.js'))
  const { createApp } = await import('../src/app.js')
  const ownerId = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@t.local', 'x', 'owner')`).run().lastInsertRowid)
  db.prepare(`INSERT INTO restaurants (owner_id, name, status, subdomain) VALUES (?, 'Resto', 'live', 'resto')`).run(ownerId)
  const otherOwner = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('P', 'p@t.local', 'x', 'owner')`).run().lastInsertRowid)
  db.prepare(`INSERT INTO restaurants (owner_id, name, status, subdomain) VALUES (?, 'Draft', 'onboarding', 'draft')`).run(otherOwner)
  auth = { Authorization: `Bearer ${jwt.sign({ id: ownerId, role: 'owner', email: 'o@t.local' }, 'test-jwt-secret')}` }
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
})

const send = (slug, body) =>
  fetch(`${base}/api/public/${slug}/link-events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('hub views and taps are counted per link for the owner, last 30 days only', async () => {
  assert.equal((await send('resto', { kind: 'view' })).status, 204)
  assert.equal((await send('resto', { kind: 'view' })).status, 204)
  assert.equal((await send('resto', { kind: 'click', key: 'menu' })).status, 204)
  assert.equal((await send('resto', { kind: 'click', key: 'menu' })).status, 204)
  assert.equal((await send('resto', { kind: 'click', key: 'book' })).status, 204)
  db.prepare(`INSERT INTO link_events (restaurant_id, kind, dest_key, created_at) VALUES (1, 'click', 'menu', datetime('now', '-45 days'))`).run()

  const stats = await (await fetch(`${base}/api/restaurant/one-link/stats`, { headers: auth })).json()
  assert.deepEqual(stats, { views: 2, clicks: 3, byKey: { menu: 2, book: 1 } })
})

test('bad events, unknown or unpublished restaurants are refused; stats need a login', async () => {
  assert.equal((await send('resto', { kind: 'click' })).status, 400)
  assert.equal((await send('resto', { kind: 'bogus', key: 'x' })).status, 400)
  assert.equal((await send('nobody', { kind: 'view' })).status, 404)
  assert.equal((await send('draft', { kind: 'view' })).status, 404)
  assert.equal((await fetch(`${base}/api/restaurant/one-link/stats`)).status, 401)
})
