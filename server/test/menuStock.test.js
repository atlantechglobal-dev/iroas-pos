import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { createFakeBench } from './helpers/fakeBench.js'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-menustock-')), 'test.db')
const bench = createFakeBench()
const STOCK = 'iroas_ury_ext.api.menu.stock_menu_item'
let db
let app
let appBase
let ownerToken
let mode = 'ok'

before(async () => {
  const url = await bench.start()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_PATH: tmpDb,
    JWT_SECRET: 'test-jwt-secret',
    URY_BASE_URL: url,
    URY_CRED_T1_API_KEY: 'k',
    URY_CRED_T1_API_SECRET: 's',
  })
  ;({ db } = await import('../src/infra/db.js'))
  const { signToken } = await import('../src/middleware/auth.js')
  const { createApp } = await import('../src/app.js')
  const owner = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@t.local', 'x', 'owner')`).run().lastInsertRowid)
  const rid = Number(db.prepare(`INSERT INTO restaurants (owner_id, name, status) VALUES (?, 'Resto', 'live')`).run(owner).lastInsertRowid)
  db.prepare(
    `INSERT INTO restaurant_integrations (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile, credential_ref, status)
     VALUES (?, 'ury', 'Resto', 'B', 'P', 'T1', 'active')`,
  ).run(rid)
  ownerToken = signToken({ id: owner, email: 'o@t.local', name: 'O', role: 'owner' })
  bench.onRequest(({ method, reply }) => {
    if (method !== STOCK) return false
    if (mode === 'missing') reply(404, {})
    else if (mode === 'rejected') reply(417, { exc_type: 'ValidationError', _server_messages: JSON.stringify([JSON.stringify({ message: 'No stock warehouse', raise_exception: 1 })]) })
    else reply(200, { message: { status: 'Success' } })
    return true
  })
  app = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => app.once('listening', r))
  appBase = `http://127.0.0.1:${app.address().port}`
})

after(() => {
  bench.stop()
  app.close()
})

beforeEach(async () => {
  bench.reset()
  mode = 'ok'
  bench.put({ doctype: 'URY Menu', name: 'M', branch: 'B', enabled: 1, price_list: 'PL', items: [] })
  bench.put({ doctype: 'UOM', name: 'Nos' })
  const { clearUryTenantCache } = await import('../src/integrations/ury/uryTenant.js')
  const { clearUryMenuCache } = await import('../src/integrations/ury/uryMenu.js')
  clearUryTenantCache()
  clearUryMenuCache()
})

const post = (url, body) =>
  fetch(`${appBase}/api/restaurant${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(body),
  })
const stockCalls = () => bench.calls.filter((c) => c.method === STOCK)

test('add stock: calls the POS method for the item with the quantity', async () => {
  const res = await post('/pos-menu/items/BG/stock', { qty: 12 })
  assert.equal(res.status, 200)
  assert.deepEqual(stockCalls().map((c) => c.body), [{ item_code: 'BG', qty: 12 }])
})

test('add stock: bad quantities are refused before the POS is called', async () => {
  for (const qty of [-1, 'lots', 1_000_000, {}]) {
    const res = await post('/pos-menu/items/BG/stock', { qty })
    assert.equal(res.status, 400, JSON.stringify(qty))
    assert.equal((await res.json()).code, 'invalid_stock')
  }
  assert.equal(stockCalls().length, 0)
})

test('add stock: an item that is not on the branch menu is 404, a POS rejection is 422, an outage is 502', async () => {
  mode = 'missing'
  assert.equal((await post('/pos-menu/items/NOPE/stock', { qty: 1 })).status, 404)
  mode = 'rejected'
  const rejected = await post('/pos-menu/items/BG/stock', { qty: 1 })
  assert.equal(rejected.status, 422)
  assert.match((await rejected.json()).error, /No stock warehouse/)
  mode = 'ok'
  bench.state.down = true
  assert.equal((await post('/pos-menu/items/BG/stock', { qty: 1 })).status, 502)
})

test('create item: the new item is set up for sale with its opening stock', async () => {
  const res = await post('/pos-menu/items', { menu: 'M', name: 'Beef Burger', course: 'Mains', rate: 85, openingStock: 25 })
  assert.equal(res.status, 201)
  assert.deepEqual(stockCalls().map((c) => c.body), [{ item_code: 'BEEFBURGER', qty: 25 }])
  assert.equal(bench.get('Item', 'BEEFBURGER').is_stock_item, 1)
  assert.deepEqual(bench.get('URY Menu', 'M').items.map((i) => i.item), ['BEEFBURGER'])
})

test('create item: opening stock defaults to 0 and invalid stock stops before anything is created', async () => {
  const bad = await post('/pos-menu/items', { menu: 'M', name: 'Beef Burger', rate: 85, openingStock: -5 })
  assert.equal(bad.status, 400)
  assert.equal(bench.get('Item', 'BEEFBURGER'), undefined)
  const ok = await post('/pos-menu/items', { menu: 'M', name: 'Fish Taco', rate: 60 })
  assert.equal(ok.status, 201)
  assert.deepEqual(stockCalls().map((c) => c.body.qty), [0])
})

test('create item: if the POS cannot set the item up, the owner is told how to finish', async () => {
  mode = 'rejected'
  const res = await post('/pos-menu/items', { menu: 'M', name: 'Beef Burger', rate: 85, openingStock: 5 })
  assert.equal(res.status, 502)
  const body = await res.json()
  assert.equal(body.code, 'item_setup_failed')
  assert.match(body.error, /Add stock/)
  assert.deepEqual(bench.get('URY Menu', 'M').items.map((i) => i.item), ['BEEFBURGER'])
})
