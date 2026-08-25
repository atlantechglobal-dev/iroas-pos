import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'iroas.db')

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    cuisine TEXT,
    description TEXT,
    phone TEXT,
    website TEXT,
    email TEXT,
    city TEXT,
    country TEXT,
    timezone TEXT,
    address TEXT,
    operating_hours TEXT,
    subdomain TEXT,
    custom_domain TEXT,
    logo_data_url TEXT,
    primary_color TEXT DEFAULT '#F97316',
    secondary_color TEXT DEFAULT '#F0F72A',
    accent_color TEXT DEFAULT '#BDB8A4',
    font TEXT DEFAULT 'Plus Jakarta Sans',
    theme TEXT DEFAULT 'modern',
    status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'live')),
    plan TEXT NOT NULL DEFAULT 'Starter',
    settings_json TEXT,
    launched_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Migration: older databases created before settings_json existed.
const restaurantColumns = db.prepare('PRAGMA table_info(restaurants)').all()
if (!restaurantColumns.some((col) => col.name === 'settings_json')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN settings_json TEXT')
}

export default db
