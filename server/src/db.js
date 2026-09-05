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
    domain_suffix TEXT DEFAULT 'iroas.com',
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

  CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'draft', 'archived')),
    tint TEXT DEFAULT 'tint-green',
    image_data_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    veg INTEGER NOT NULL DEFAULT 1,
    tag TEXT,
    prep_minutes INTEGER DEFAULT 15,
    stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low', 'out')),
    stock_count INTEGER,
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'draft', 'archived')),
    image_data_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON menu_categories(restaurant_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id, category_id, sort_order);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    guests INTEGER NOT NULL DEFAULT 2,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reservations_restaurant ON reservations(restaurant_id, date, time);
  CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id, status);
`)

// Migration: older databases created before settings_json / domain_suffix existed.
const restaurantColumns = db.prepare('PRAGMA table_info(restaurants)').all()
if (!restaurantColumns.some((col) => col.name === 'settings_json')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN settings_json TEXT')
}
if (!restaurantColumns.some((col) => col.name === 'domain_suffix')) {
  db.exec(`ALTER TABLE restaurants ADD COLUMN domain_suffix TEXT DEFAULT 'iroas.com'`)
}

export default db
