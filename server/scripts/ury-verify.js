// Verifies the URY connection and captures real menu responses for mapping.
// Usage (from server/): node scripts/ury-verify.js
// Raw responses are written to server/data/ury-captures/<host>/ (gitignored).

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getUryConfig, getLoggedUser, getDocType, getDoc, getList, UryError } from '../src/integrations/ury/uryClient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const host = (() => {
  try {
    return new URL(getUryConfig().baseUrl).host.replace(/[^a-z0-9.-]+/gi, '_')
  } catch {
    return 'unknown-host'
  }
})()
const outDir = path.join(__dirname, '..', 'data', 'ury-captures', host)

function save(name, data) {
  fs.mkdirSync(outDir, { recursive: true })
  const file = path.join(outDir, `${name.replace(/[^a-z0-9_-]+/gi, '_')}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
  return file
}

function summarizeDocType(body) {
  const docs = body?.docs || []
  for (const meta of docs) {
    console.log(`  DocType "${meta.name}" (istable=${meta.istable ? 1 : 0})`)
    for (const f of meta.fields || []) {
      if (['Section Break', 'Column Break', 'Tab Break'].includes(f.fieldtype)) continue
      console.log(`    - ${f.fieldname} : ${f.fieldtype}${f.options ? ` -> ${f.options}` : ''}${f.reqd ? ' (required)' : ''}`)
    }
  }
}

function summarizeDoc(body) {
  const doc = body?.docs?.[0]
  if (!doc) return console.log('  (no docs[0])')
  for (const [key, value] of Object.entries(doc)) {
    if (Array.isArray(value)) {
      console.log(`    ${key}: [${value.length} rows] row keys = ${Object.keys(value[0] || {}).join(', ')}`)
    } else {
      console.log(`    ${key}: ${JSON.stringify(value)}`)
    }
  }
}

async function step(label, fn, summarize) {
  process.stdout.write(`\n${label}\n`)
  try {
    const body = await fn()
    console.log(`  saved: ${save(label, body)}`)
    summarize?.(body)
    return body
  } catch (err) {
    console.log(`  FAILED: ${err instanceof UryError ? `${err.code} — ${err.message}` : err.message}`)
    return null
  }
}

const cfg = getUryConfig()
console.log(`URY base URL: ${cfg.baseUrl || '(URY_BASE_URL not set)'}`)
console.log(`Auth mode:    ${cfg.authMode || '(no credentials set)'}`)
if (!cfg.baseUrl || !cfg.authMode) {
  console.log('\nSet URY_BASE_URL and either URY_API_KEY + URY_API_SECRET or URY_USERNAME + URY_PASSWORD in server/.env')
  process.exit(1)
}

try {
  const user = await getLoggedUser()
  console.log(`\nAuthenticated as URY user: ${user}`)
} catch (err) {
  console.log(`\nAuthentication FAILED: ${err.code || ''} ${err.message}`)
  process.exit(1)
}

if (cfg.baseUrl.startsWith('http://')) {
  console.log('\nWARNING: URY_BASE_URL uses plain HTTP — the URY login and session cookie travel unencrypted.')
}

for (const dt of ['URY Restaurant', 'URY Menu', 'URY Menu Course', 'URY Table', 'Price List']) {
  await step(`getdoctype ${dt}`, () => getDocType(dt), summarizeDocType)
}

const restaurants = await step(
  'get_list URY Restaurant',
  () => getList('URY Restaurant', { fields: ['name', 'company', 'branch', 'active_menu'] }),
  (rows) => rows.forEach((r) => console.log(`    ${JSON.stringify(r)}`)),
)
for (const r of restaurants || []) {
  if (!r.active_menu) continue
  const menu = await step(`getdoc URY Menu ${r.active_menu}`, () => getDoc('URY Menu', r.active_menu), summarizeDoc)
  const priceList = menu?.docs?.[0]?.price_list
  if (priceList) await step(`getdoc Price List ${priceList}`, () => getDoc('Price List', priceList), summarizeDoc)
  await step(
    `get_list URY Table ${r.name}`,
    () => getList('URY Table', { fields: ['name', 'occupied', 'restaurant', 'restaurant_room'], filters: { restaurant: r.name } }),
    (rows) => console.log(`    ${rows.length} tables`),
  )
}
