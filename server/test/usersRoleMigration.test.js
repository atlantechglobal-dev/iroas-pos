// An existing database (users.role limited to owner/admin) is upgraded in place
// to allow 'specialist' without losing users or breaking restaurant ownership.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

test('old users table is rebuilt, data and foreign keys survive', async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'iroas-usermig-')), 'old.db')

  const old = new Database(dbPath)
  old.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      google_id TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users (name, email, password_hash, role) VALUES ('Boss', 'boss@t.local', 'h1', 'admin');
    INSERT INTO users (name, email, password_hash, role) VALUES ('Owner', 'own@t.local', 'h2', 'owner');
  `)
  old.close()

  Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: dbPath, JWT_SECRET: 'test-jwt-secret' })
  const { db } = await import('../src/infra/db.js')

  const users = db.prepare('SELECT id, email, role, password_hash FROM users ORDER BY id').all()
  assert.deepEqual(users.map((u) => [u.email, u.role, u.password_hash]), [
    ['boss@t.local', 'admin', 'h1'],
    ['own@t.local', 'owner', 'h2'],
  ])

  // new role is accepted, bogus roles still rejected
  db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('S', 's@t.local', 'h3', 'specialist')`).run()
  assert.throws(() => db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES ('B', 'b@t.local', 'h', 'root')`).run())

  // foreign keys still point at the rebuilt table and are enforced
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1)
  const ownerId = users[1].id
  db.prepare(`INSERT INTO restaurants (owner_id, name) VALUES (?, 'R')`).run(ownerId)
  assert.throws(() => db.prepare(`INSERT INTO restaurants (owner_id, name) VALUES (9999, 'Orphan')`).run())
  assert.equal(db.pragma('foreign_key_check').length, 0)
  db.close()
})
