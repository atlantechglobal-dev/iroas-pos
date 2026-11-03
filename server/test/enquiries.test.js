import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { buildVCard, internationalDigits, mapsHref, telHref, whatsappHref } from '../../src/shared/utils/contactLinks.js'

test('vCard: required fields, CRLF lines, escaped values, folded long lines', () => {
  const v = buildVCard({
    name: 'Saffron, Fig & Co; Bistro',
    tagline: 'Fire,\nspice',
    phone: '+27 21 555 0100',
    email: 'hello@saffron.test',
    website: 'https://saffron.test',
    pageUrl: 'https://www.iroasdigital.com/l/saffronfig',
    street: '12 Long Street',
    city: 'Cape Town',
    country: 'South Africa',
  })
  assert.ok(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'))
  assert.ok(v.endsWith('END:VCARD\r\n'))
  assert.ok(v.includes('N:Saffron\\, Fig & Co\\; Bistro;;;;\r\n'), 'N is present and escaped')
  assert.ok(v.includes('FN:Saffron\\, Fig & Co\\; Bistro\r\n'))
  assert.ok(v.includes('TEL;TYPE=WORK,VOICE:+27215550100\r\n'))
  assert.ok(v.includes('ADR;TYPE=WORK:;;12 Long Street;Cape Town;;;South Africa\r\n'))
  assert.ok(v.includes('NOTE:Fire\\,\\nspice\r\n'), 'newline and comma escaped')
  assert.equal(v.split('\r\n').filter((l) => !l.startsWith(' ')).every((l) => l.length <= 75), true)
  assert.ok(!/[^\r]\n/.test(v), 'no bare LF line endings')
  const long = buildVCard({ name: 'X', tagline: 'a'.repeat(200) })
  assert.ok(long.split('\r\n').every((l) => l.length <= 75))
  assert.equal(long.replace(/\r\n /g, '').includes('a'.repeat(200)), true, 'unfolds to the original text')
})

test('vCard leaves out empty fields', () => {
  const v = buildVCard({ name: 'Plain' })
  assert.equal(v, 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Plain;;;;\r\nFN:Plain\r\nORG:Plain\r\nEND:VCARD\r\n')
})

test('phone links: South African numbers become international for WhatsApp', () => {
  assert.equal(internationalDigits('071 555 0101'), '27715550101')
  assert.equal(internationalDigits('+27 71 555 0101'), '27715550101')
  assert.equal(internationalDigits('0027715550101'), '27715550101')
  assert.equal(whatsappHref('071 555 0101', 'Hi there'), 'https://wa.me/27715550101?text=Hi%20there')
  assert.equal(whatsappHref('123'), '')
  assert.equal(telHref('+27 21 555 0100'), 'tel:+27215550100')
  assert.equal(telHref(''), '')
  assert.equal(mapsHref('12 Long Street, Cape Town'), 'https://www.google.com/maps/search/?api=1&query=12%20Long%20Street%2C%20Cape%20Town')
})

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-enq-')), 'test.db')
let server
let base
let db
let owner

before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: tmpDb, JWT_SECRET: 'test-jwt-secret' })
  ;({ db } = await import('../src/infra/db.js'))
  const { createApp } = await import('../src/app.js')
  const uid = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('O', 'o@t.local', 'x', 'owner')`).run().lastInsertRowid)
  db.prepare(`INSERT INTO restaurants (owner_id, name, status, subdomain) VALUES (?, 'Resto', 'live', 'resto')`).run(uid)
  const other = Number(db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('P', 'p@t.local', 'x', 'owner')`).run().lastInsertRowid)
  db.prepare(`INSERT INTO restaurants (owner_id, name, status, subdomain) VALUES (?, 'Other', 'live', 'other')`).run(other)
  owner = { Authorization: `Bearer ${jwt.sign({ id: uid, role: 'owner', email: 'o@t.local' }, 'test-jwt-secret')}` }
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

const send = (slug, body) =>
  fetch(`${base}/api/public/${slug}/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('an enquiry is stored, the guest is added, and the owner is notified', async () => {
  const res = await send('resto', { name: 'Zodwa', phone: '071 555 0199', email: 'zodwa@t.local', message: 'Do you take groups of 12?' })
  assert.equal(res.status, 201)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM enquiries').get().n, 1)
  const note = db.prepare(`SELECT title, body FROM notifications WHERE type = 'enquiry'`).get()
  assert.equal(note.title, 'New enquiry from Zodwa')
  assert.match(note.body, /groups of 12/)
  assert.ok(db.prepare(`SELECT 1 FROM guests WHERE name = 'Zodwa'`).get(), 'guest record created from the phone number')

  const list = await (await fetch(`${base}/api/restaurant/enquiries`, { headers: owner })).json()
  assert.equal(list.enquiries.length, 1)
  assert.equal(list.enquiries[0].message, 'Do you take groups of 12?')
})

test('bad enquiries are refused with a reason; nothing is stored', async () => {
  const before = db.prepare('SELECT COUNT(*) n FROM enquiries').get().n
  const cases = [
    [{ phone: '0715550199', message: 'hello there' }, /name/i],
    [{ name: 'A', message: 'hello there' }, /email address or a phone/i],
    [{ name: 'A', email: 'not-an-email', message: 'hello there' }, /email/i],
    [{ name: 'A', phone: '12', message: 'hello there' }, /phone number/i],
    [{ name: 'A', phone: '0715550199', message: 'hi' }, /message/i],
  ]
  for (const [body, pattern] of cases) {
    const res = await send('resto', body)
    assert.equal(res.status, 400)
    assert.match((await res.json()).error, pattern)
  }
  assert.equal(db.prepare('SELECT COUNT(*) n FROM enquiries').get().n, before)
})

test('the hidden trap field silently drops bot submissions', async () => {
  const before = db.prepare('SELECT COUNT(*) n FROM enquiries').get().n
  const res = await send('resto', { name: 'Bot', phone: '0715550000', message: 'buy cheap things', website: 'http://spam.test' })
  assert.equal(res.status, 201)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM enquiries').get().n, before)
})

test('unknown restaurants are 404; the owner list is private and per restaurant', async () => {
  assert.equal((await send('nobody', { name: 'A', phone: '0715550199', message: 'hello there' })).status, 404)
  assert.equal((await fetch(`${base}/api/restaurant/enquiries`)).status, 401)
  await send('other', { name: 'Elsewhere', phone: '0715550123', message: 'for the other place' })
  const mine = await (await fetch(`${base}/api/restaurant/enquiries`, { headers: owner })).json()
  assert.ok(mine.enquiries.every((q) => q.name !== 'Elsewhere'))
})

test('a long message is cut to 1000 characters', async () => {
  await send('resto', { name: 'Long', phone: '0715550177', message: 'x'.repeat(5000) })
  const row = db.prepare(`SELECT message FROM enquiries WHERE name = 'Long'`).get()
  assert.equal(row.message.length, 1000)
})

test('too many messages from one place are rate limited', async () => {
  let last
  for (let i = 0; i < 12; i += 1) last = await send('resto', { name: `Spam${i}`, phone: '0715550166', message: 'repeated message' })
  assert.equal(last.status, 429)
})
