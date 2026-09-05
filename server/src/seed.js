import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { db } from './db.js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@iroas.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'IroasAdmin@123'
const ADMIN_NAME = process.env.ADMIN_NAME || 'IROAS Admin'

function upsertUser({ name, email, phone, password, role }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  const passwordHash = bcrypt.hashSync(password, 10)

  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(
      passwordHash,
      role,
      existing.id,
    )
    return existing.id
  }

  const result = db
    .prepare(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    )
    .run(name, email, phone ?? null, passwordHash, role)

  return result.lastInsertRowid
}

// --- Platform admin account (Platform Admin dashboard access) ---
upsertUser({
  name: ADMIN_NAME,
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  role: 'admin',
})

console.log('Admin account ready:')
console.log(`  email:    ${ADMIN_EMAIL}`)
console.log(`  password: ${ADMIN_PASSWORD}`)

// --- Sample restaurant tenants for the demo (Platform Admin tenant table) ---
const sampleTenants = [
  {
    owner: { name: 'Ananya Rao', email: 'ananya@saffronandfig.in', phone: '+91 98200 11223' },
    restaurant: { name: 'Saffron & Fig', city: 'Mumbai', country: 'India', plan: 'Pro', status: 'live' },
  },
  {
    owner: { name: 'Rohit Menon', email: 'rohit@baorepublic.in', phone: '+91 98450 22110' },
    restaurant: { name: 'Bao Republic', city: 'Bengaluru', country: 'India', plan: 'Growth', status: 'live' },
  },
  {
    owner: { name: 'Priya Nair', email: 'priya@coastandco.in', phone: '+91 98220 33445' },
    restaurant: { name: 'Coast & Co.', city: 'Goa', country: 'India', plan: 'Starter', status: 'onboarding' },
  },
]

const insertRestaurant = db.prepare(
  `INSERT INTO restaurants (owner_id, name, city, country, plan, status, launched_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
)

for (const { owner, restaurant } of sampleTenants) {
  const userId = upsertUser({ ...owner, password: 'Demo@1234', role: 'owner' })

  const existingRestaurant = db
    .prepare('SELECT id FROM restaurants WHERE owner_id = ?')
    .get(userId)

  if (!existingRestaurant) {
    insertRestaurant.run(
      userId,
      restaurant.name,
      restaurant.city,
      restaurant.country,
      restaurant.plan,
      restaurant.status,
      restaurant.status === 'live' ? new Date().toISOString() : null,
    )
  }
}

console.log(`Seeded ${sampleTenants.length} sample tenants (owner password: Demo@1234).`)
console.log('Seed complete.')
