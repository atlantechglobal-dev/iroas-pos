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
    status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'pending_approval', 'live', 'rejected', 'deleted')),
    plan TEXT NOT NULL DEFAULT 'Starter',
    settings_json TEXT,
    launched_at TEXT,
    submitted_at TEXT,
    rejection_reason TEXT,
    rejected_at TEXT,
    reviewed_at TEXT,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TEXT,
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
if (!restaurantColumns.some((col) => col.name === 'submitted_at')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN submitted_at TEXT')
}

const restaurantTableSql =
  db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'restaurants'`).get()
    ?.sql || ''
if (restaurantTableSql && !restaurantTableSql.includes('pending_approval')) {
  const existingCols = db.prepare('PRAGMA table_info(restaurants)').all().map((col) => col.name)
  db.pragma('foreign_keys = OFF')
  const migrateStatus = db.transaction(() => {
    db.exec(`
      CREATE TABLE restaurants__status_mig (
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
        status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'pending_approval', 'live', 'rejected', 'deleted')),
        plan TEXT NOT NULL DEFAULT 'Starter',
        settings_json TEXT,
        launched_at TEXT,
        submitted_at TEXT,
        rejection_reason TEXT,
        rejected_at TEXT,
        reviewed_at TEXT,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    const nextCols = db
      .prepare('PRAGMA table_info(restaurants__status_mig)')
      .all()
      .map((col) => col.name)
    const shared = nextCols.filter((col) => existingCols.includes(col))
    db.exec(
      `INSERT INTO restaurants__status_mig (${shared.join(', ')}) SELECT ${shared.join(', ')} FROM restaurants`,
    )
    db.exec('DROP TABLE restaurants')
    db.exec('ALTER TABLE restaurants__status_mig RENAME TO restaurants')
  })
  migrateStatus()
  db.pragma('foreign_keys = ON')
}

const restaurantSqlAfterStatus =
  db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'restaurants'`).get()
    ?.sql || ''
if (restaurantSqlAfterStatus && !restaurantSqlAfterStatus.includes("'rejected'")) {
  const existingCols = db.prepare('PRAGMA table_info(restaurants)').all().map((col) => col.name)
  db.pragma('foreign_keys = OFF')
  const migrateReview = db.transaction(() => {
    db.exec(`
      CREATE TABLE restaurants__review_mig (
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
        status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'pending_approval', 'live', 'rejected', 'deleted')),
        plan TEXT NOT NULL DEFAULT 'Starter',
        settings_json TEXT,
        launched_at TEXT,
        submitted_at TEXT,
        rejection_reason TEXT,
        rejected_at TEXT,
        reviewed_at TEXT,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    const nextCols = db
      .prepare('PRAGMA table_info(restaurants__review_mig)')
      .all()
      .map((col) => col.name)
    const shared = nextCols.filter((col) => existingCols.includes(col))
    db.exec(
      `INSERT INTO restaurants__review_mig (${shared.join(', ')}) SELECT ${shared.join(', ')} FROM restaurants`,
    )
    db.exec('DROP TABLE restaurants')
    db.exec('ALTER TABLE restaurants__review_mig RENAME TO restaurants')
  })
  migrateReview()
  db.pragma('foreign_keys = ON')
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tenant_review_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    note TEXT,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tenant_review_events_restaurant
    ON tenant_review_events(restaurant_id, created_at);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS digital_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    reference_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'completed')),
    business_name TEXT,
    category TEXT,
    category_other TEXT,
    business_type TEXT,
    description TEXT,
    year_established TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    brand_name TEXT,
    primary_brand_info TEXT,
    logo_data_url TEXT,
    social_json TEXT,
    online_presence_json TEXT,
    vertical_fields_json TEXT,
    admin_notes TEXT,
    assets_json TEXT,
    submitted_at TEXT,
    reviewed_at TEXT,
    approved_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS digital_identity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id INTEGER NOT NULL REFERENCES digital_identities(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id INTEGER NOT NULL REFERENCES digital_identities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_type TEXT NOT NULL
      CHECK (product_type IN ('website', 'digital_business_card', 'mobile_app')),
    status TEXT NOT NULL DEFAULT 'not_started',
    payload_json TEXT,
    admin_notes TEXT,
    submitted_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (identity_id, product_type)
  );

  CREATE TABLE IF NOT EXISTS product_request_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'identity',
    title TEXT NOT NULL,
    body TEXT,
    meta_json TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    identity_id INTEGER REFERENCES digital_identities(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES product_requests(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_digital_identities_status ON digital_identities(status);
  CREATE INDEX IF NOT EXISTS idx_digital_identities_category ON digital_identities(category);
  CREATE INDEX IF NOT EXISTS idx_digital_identity_events_identity ON digital_identity_events(identity_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_product_requests_user ON product_requests(user_id, product_type);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
`)

// Reservation messaging + guest email + dining tables (M2-T04/T06)
const reservationColumns = db.prepare('PRAGMA table_info(reservations)').all()
if (!reservationColumns.some((col) => col.name === 'guest_email')) {
  db.exec('ALTER TABLE reservations ADD COLUMN guest_email TEXT')
}
if (!reservationColumns.some((col) => col.name === 'table_id')) {
  db.exec('ALTER TABLE reservations ADD COLUMN table_id INTEGER')
}

db.exec(`
  CREATE TABLE IF NOT EXISTS message_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    to_address TEXT,
    subject TEXT,
    body TEXT NOT NULL,
    send_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'cancelled', 'failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_message_jobs_due
    ON message_jobs(status, send_at);

  CREATE TABLE IF NOT EXISTS dining_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 2,
    zone TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    public_code TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_dining_tables_restaurant
    ON dining_tables(restaurant_id, sort_order);

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    public_code TEXT NOT NULL,
    service_mode TEXT NOT NULL DEFAULT 'pickup'
      CHECK (service_mode IN ('dinein', 'pickup', 'delivery')),
    dining_table_id INTEGER REFERENCES dining_tables(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address_json TEXT,
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
    payment_method TEXT NOT NULL DEFAULT 'cash'
      CHECK (payment_method IN ('upi', 'cash', 'cod')),
    payment_status TEXT NOT NULL DEFAULT 'payment_pending'
      CHECK (payment_status IN ('payment_pending', 'paid', 'failed', 'refunded')),
    payment_timing TEXT NOT NULL DEFAULT 'bill_now',
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    fees REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    eta_minutes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_code
    ON orders(restaurant_id, public_code);
  CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
    ON orders(restaurant_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER,
    name TEXT NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0,
    qty INTEGER NOT NULL DEFAULT 1,
    extras_json TEXT
  );
`)

// Migration: dining_tables.public_code for table QR ordering
{
  const cols = db.prepare('PRAGMA table_info(dining_tables)').all()
  if (!cols.some((c) => c.name === 'public_code')) {
    db.exec('ALTER TABLE dining_tables ADD COLUMN public_code TEXT')
  }
  const missing = db
    .prepare(
      `SELECT id FROM dining_tables WHERE public_code IS NULL OR TRIM(public_code) = ''`,
    )
    .all()
  const update = db.prepare('UPDATE dining_tables SET public_code = ? WHERE id = ?')
  for (const row of missing) {
    update.run(`t${row.id}${Math.random().toString(36).slice(2, 6)}`, row.id)
  }
  db.exec(
    `  CREATE INDEX IF NOT EXISTS idx_dining_tables_public_code
     ON dining_tables(restaurant_id, public_code)`,
  )
}

// Migration: message_jobs.order_id for order confirmations
{
  const cols = db.prepare('PRAGMA table_info(message_jobs)').all()
  if (!cols.some((c) => c.name === 'order_id')) {
    db.exec('ALTER TABLE message_jobs ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE')
  }
}

// Migration: orders.payment_timing (bill_now | pay_later)
{
  const cols = db.prepare('PRAGMA table_info(orders)').all()
  if (cols.length && !cols.some((c) => c.name === 'payment_timing')) {
    db.exec(
      `ALTER TABLE orders ADD COLUMN payment_timing TEXT NOT NULL DEFAULT 'bill_now'`,
    )
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

export default db
