import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { createFakeBench } from './helpers/fakeBench.js'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-staff-')), 'test.db')
const bench = createFakeBench()
let db
let app
let appBase
let restaurantId
let otherRestaurantId
let ownerToken
let placeOnce
let OrderingError
let UryError

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
  ;({ placeOnce } = await import('../src/integrations/ury/staffOrderGuard.js'))
  ;({ OrderingError } = await import('../src/integrations/ury/uryOrdering.js'))
  ;({ UryError } = await import('../src/integrations/ury/uryClient.js'))
  const { signToken } = await import('../src/middleware/auth.js')
  const { createApp } = await import('../src/app.js')

  const owner = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@t.local', 'x', 'owner')`).run().lastInsertRowid)
  const owner2 = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O2', 'o2@t.local', 'x', 'owner')`).run().lastInsertRowid)
  restaurantId = Number(db.prepare(`INSERT INTO restaurants (owner_id, name, status) VALUES (?, 'Resto', 'live')`).run(owner).lastInsertRowid)
  otherRestaurantId = Number(db.prepare(`INSERT INTO restaurants (owner_id, name, status) VALUES (?, 'Other', 'live')`).run(owner2).lastInsertRowid)
  db.prepare(
    `INSERT INTO restaurant_integrations (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile, credential_ref, status)
     VALUES (?, 'ury', 'Resto', 'B', 'P', 'T1', 'active')`,
  ).run(restaurantId)
  ownerToken = signToken({ id: owner, email: 'o@t.local', name: 'O', role: 'owner' })
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
  db.prepare('DELETE FROM ury_staff_orders').run()
  const { clearUryTenantCache } = await import('../src/integrations/ury/uryTenant.js')
  clearUryTenantCache()
})

const ID = (n) => `req-${String(n).padStart(16, '0')}`

test('placeOnce: first call places, a replay returns the same result without placing again', async () => {
  let placed = 0
  const place = async () => ({ invoice: `INV-${++placed}`, table: 'T1' })
  const first = await placeOnce(restaurantId, ID(1), place)
  const again = await placeOnce(restaurantId, ID(1), place)
  assert.equal(first.invoice, 'INV-1')
  assert.equal(again.invoice, 'INV-1')
  assert.equal(again.replayed, true)
  assert.equal(placed, 1)
})

test('placeOnce: concurrent calls with one id place exactly once', async () => {
  let placed = 0
  const place = async () => {
    placed += 1
    await new Promise((r) => setTimeout(r, 40))
    return { invoice: 'INV-1' }
  }
  const results = await Promise.allSettled([1, 2, 3].map(() => placeOnce(restaurantId, ID(2), place)))
  assert.equal(placed, 1)
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  for (const r of results.filter((x) => x.status === 'rejected')) assert.equal(r.reason.code, 'order_in_progress')
})

test('placeOnce: a rejected order can be retried with the same id', async () => {
  await assert.rejects(
    placeOnce(restaurantId, ID(3), async () => {
      throw new OrderingError('table_occupied', 'busy', { status: 409 })
    }),
    /busy/,
  )
  const ok = await placeOnce(restaurantId, ID(3), async () => ({ invoice: 'INV-9' }))
  assert.equal(ok.invoice, 'INV-9')
})

test('placeOnce: an unknown outcome (timeout) is never re-sent', async () => {
  await assert.rejects(
    placeOnce(restaurantId, ID(4), async () => {
      throw new UryError('timeout', 'slow')
    }),
  )
  let sent = false
  await assert.rejects(
    placeOnce(restaurantId, ID(4), async () => {
      sent = true
      return { invoice: 'DUP' }
    }),
    (err) => err.code === 'order_in_progress',
  )
  assert.equal(sent, false)
})

test('placeOnce: ids are scoped per restaurant and must look like real ids', async () => {
  await placeOnce(restaurantId, ID(5), async () => ({ invoice: 'A' }))
  const other = await placeOnce(otherRestaurantId, ID(5), async () => ({ invoice: 'B' }))
  assert.equal(other.invoice, 'B')
  for (const bad of [undefined, '', 'short', 'x'.repeat(65), 'has space in it 1234']) {
    await assert.rejects(placeOnce(restaurantId, bad, async () => ({})), (err) => err.code === 'invalid_request')
  }
})

test('placeOnce: old records are purged', async () => {
  db.prepare(`INSERT INTO ury_staff_orders (restaurant_id, request_id, status, created_at) VALUES (?, ?, 'placed', datetime('now', '-30 days'))`).run(restaurantId, ID(6))
  await placeOnce(restaurantId, ID(7), async () => ({ invoice: 'N' }))
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ury_staff_orders WHERE request_id = ?').get(ID(6)).n, 0)
})

function seedInvoice(overrides = {}) {
  bench.put({ doctype: 'POS Invoice', name: 'INV-1', restaurant: 'Resto', status: 'Draft', docstatus: 0, restaurant_table: 'T1', ...overrides })
  bench.onRequest(({ method, body, reply, get }) => {
    if (method !== 'iroas_ury_ext.api.orders.cancel_open_order') return false
    const inv = get('POS Invoice', body.invoice_id)
    inv.status = 'Cancelled'
    reply(200, { message: { status: 'Success' } })
    return true
  })
}

const cancel = (invoiceId, body) =>
  fetch(`${appBase}/api/restaurant/pos-orders/${invoiceId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(body),
  })

test('cancel: an open order is cancelled in the POS with the reason', async () => {
  seedInvoice()
  const res = await cancel('INV-1', { reason: 'Guest left' })
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).data, { invoice: 'INV-1', cancelled: true })
  const call = bench.calls.find((c) => c.method.endsWith('cancel_open_order'))
  assert.deepEqual(call.body, { invoice_id: 'INV-1', reason: 'Guest left' })
  assert.equal(bench.get('POS Invoice', 'INV-1').status, 'Cancelled')
})

test('cancel: a reason is required and nothing is sent without one', async () => {
  seedInvoice()
  for (const reason of [undefined, '', '  ', 'ab']) {
    const res = await cancel('INV-1', { reason })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, 'reason_required')
  }
  assert.equal(bench.calls.some((c) => c.method.endsWith('cancel_open_order')), false)
})

test('cancel: paid, consolidated and already-cancelled orders are refused', async () => {
  for (const [status, docstatus] of [['Paid', 1], ['Consolidated', 1], ['Cancelled', 0]]) {
    bench.reset()
    seedInvoice({ status, docstatus })
    const res = await cancel('INV-1', { reason: 'mistake' })
    assert.equal(res.status, 409, status)
    assert.equal((await res.json()).code, 'not_cancellable')
    assert.equal(bench.calls.some((c) => c.method.endsWith('cancel_open_order')), false)
  }
})

test('cancel: an order of another restaurant is not found and never cancelled', async () => {
  seedInvoice({ restaurant: 'Someone Else' })
  const res = await cancel('INV-1', { reason: 'mistake' })
  assert.equal(res.status, 404)
  assert.equal(bench.calls.some((c) => c.method.endsWith('cancel_open_order')), false)
})

test('cancel: a POS rejection is reported and a POS outage changes nothing', async () => {
  seedInvoice()
  bench.onRequest(() => false)
  bench.state.down = true
  const down = await cancel('INV-1', { reason: 'mistake' })
  assert.equal(down.status, 502)
  bench.state.down = false
  assert.equal(bench.get('POS Invoice', 'INV-1').status, 'Draft')
})

test('POST /pos-orders requires a request id', async () => {
  const res = await fetch(`${appBase}/api/restaurant/pos-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ table: 'T1', customer: 'C1', items: [{ item: 'X', qty: 1 }] }),
  })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).code, 'invalid_request')
})
