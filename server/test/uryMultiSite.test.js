// Per-tenant URY site routing: each customer gets its own Frappe site (own
// database) on a multi-site bench. The IROAS app stays single; the mapping row
// carries the site. A fake bench records which site (Host header) each request
// asked for and answers with data that belongs to that site only.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-multisite-')), 'test.db')
const seen = []

const bench = http.createServer((req, res) => {
  const site = String(req.headers.host || '').split(':')[0]
  seen.push({ site, url: req.url })
  const url = new URL(req.url, 'http://fake')
  res.setHeader('Content-Type', 'application/json')
  if (url.pathname.endsWith('/frappe.auth.get_logged_user')) {
    res.end(JSON.stringify({ message: `integration@${site}` }))
    return
  }
  res.end(JSON.stringify({ message: [] }))
})

let getTenantClient
let isValidSiteName
let db
let linkUryRestaurant

before(async () => {
  await new Promise((r) => bench.listen(0, '127.0.0.1', r))
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_PATH: tmpDb,
    JWT_SECRET: 'test-jwt-secret',
    URY_BASE_URL: `http://127.0.0.1:${bench.address().port}`,
    URY_CRED_SITEA_API_KEY: 'key-a',
    URY_CRED_SITEA_API_SECRET: 'secret-a',
    URY_CRED_SITEB_API_KEY: 'key-b',
    URY_CRED_SITEB_API_SECRET: 'secret-b',
  })
  ;({ db } = await import('../src/infra/db.js'))
  ;({ getTenantClient } = await import('../src/integrations/ury/uryCredentials.js'))
  ;({ isValidSiteName } = await import('../src/integrations/ury/uryClient.js'))
  ;({ linkUryRestaurant } = await import('../src/integrations/ury/uryTenant.js'))
})

after(() => {
  bench.close()
  db.close()
})

const baseUrl = () => `http://127.0.0.1:${bench.address().port}`

test('each tenant client asks the bench for its own site and never another', async () => {
  const a = getTenantClient('SITEA', { baseUrl: baseUrl(), siteName: 'alpha.pos.test' })
  const b = getTenantClient('SITEB', { baseUrl: baseUrl(), siteName: 'beta.pos.test' })
  assert.equal(await a.getLoggedUser(), 'integration@alpha.pos.test')
  assert.equal(await b.getLoggedUser(), 'integration@beta.pos.test')
  assert.deepEqual([...new Set(seen.map((r) => r.site))].sort(), ['alpha.pos.test', 'beta.pos.test'])
})

test('without a site name the single-site demo setup still works (global URY_BASE_URL)', async () => {
  seen.length = 0
  const client = getTenantClient('SITEA')
  await client.getLoggedUser()
  assert.equal(seen.length, 1)
  assert.equal(seen[0].site, '127.0.0.1')
})

test('invalid site names and base URLs are refused, not passed through', () => {
  assert.equal(isValidSiteName('alpha.pos.test'), true)
  for (const bad of ['', 'a b', 'a/b', 'a\r\nX: y', '-bad', 'bad-', 'a'.repeat(300)]) {
    assert.equal(isValidSiteName(bad), false, JSON.stringify(bad))
  }
  assert.equal(getTenantClient('SITEA', { baseUrl: baseUrl(), siteName: 'bad name' }), null)
  assert.equal(getTenantClient('SITEA', { baseUrl: 'javascript:alert(1)', siteName: 'alpha.pos.test' }), null)
})

test('the same URY restaurant name may exist on two sites but not twice on one site', () => {
  const owner = db
    .prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@test.local', 'x', 'owner')`)
    .run().lastInsertRowid
  const rid = (name) => Number(db.prepare(`INSERT INTO restaurants (owner_id, name) VALUES (?, ?)`).run(owner, name).lastInsertRowid)
  const mapping = (ref, site) => ({
    external_restaurant: 'Demo Restaurant',
    ury_branch: 'Demo Branch',
    ury_pos_profile: 'Demo Profile',
    credential_ref: ref,
    ury_base_url: baseUrl(),
    ury_site_name: site,
  })
  linkUryRestaurant(rid('R1'), mapping('SITEA', 'alpha.pos.test'), { verifiedUser: 'integration@alpha.pos.test' })
  linkUryRestaurant(rid('R2'), mapping('SITEB', 'beta.pos.test'), { verifiedUser: 'integration@beta.pos.test' })
  assert.throws(
    () => linkUryRestaurant(rid('R3'), { ...mapping('SITEC', 'alpha.pos.test') }, { verifiedUser: 'other@alpha.pos.test' }),
    /UNIQUE/,
  )
})
