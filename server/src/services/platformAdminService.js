import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { isEmailConfigured } from './emailService.js'
import { getPublicPaymentSettings } from './paymentSettings.js'

export function appendPlatformAudit({
  actorId = null,
  actorEmail = '',
  action,
  entityType = null,
  entityId = null,
  detail = '',
}) {
  db.prepare(
    `INSERT INTO platform_audit (actor_id, actor_email, action, entity_type, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(actorId, actorEmail || null, action, entityType, entityId != null ? String(entityId) : null, detail || null)
}

export function listPlatformAudit({ limit = 100 } = {}) {
  return db
    .prepare(
      `SELECT a.*, u.name AS actor_name
       FROM platform_audit a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .all(Math.min(Number(limit) || 100, 500))
    .map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      detail: row.detail,
      actorEmail: row.actor_email || '',
      actorName: row.actor_name || '',
      createdAt: row.created_at,
    }))
}

function parseFeatures(raw) {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline || '',
    priceZar: Number(row.price_zar) || 0,
    billing: row.billing || 'one-time launch',
    popular: Boolean(row.popular),
    features: parseFeatures(row.features_json),
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  }
}

export function listPlans() {
  return db
    .prepare('SELECT * FROM platform_plans ORDER BY sort_order ASC, name ASC')
    .all()
    .map(mapPlan)
}

export function getPlan(id) {
  const row = db.prepare('SELECT * FROM platform_plans WHERE id = ?').get(String(id || '').toLowerCase())
  return row ? mapPlan(row) : null
}

export function getPlanAmount(plan) {
  const key = String(plan || 'starter')
    .toLowerCase()
    .trim()
  const row = db.prepare('SELECT price_zar FROM platform_plans WHERE id = ?').get(key)
  if (row) {
    const amount = Math.round(Number(row.price_zar) || 0)
    if (amount > 0) return amount
  }
  // legacy aliases / safe defaults when plan row missing or price is 0
  if (key === 'growth' || key === 'pro') return 2499
  if (key === 'enterprise') return 4999
  return 999
}

function slugifyPlanId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 48)
}

export function upsertPlan(payload) {
  const id = slugifyPlanId(payload.id)
  if (!id) {
    const err = new Error('Plan id is required.')
    err.status = 400
    throw err
  }
  const name = String(payload.name || '').trim() || id
  const tagline = String(payload.tagline || '').trim()
  const priceZar = Math.max(0, Number(payload.priceZar) || 0)
  const billing = String(payload.billing || 'one-time launch').trim()
  const popular = payload.popular ? 1 : 0
  const features = Array.isArray(payload.features)
    ? payload.features.map((f) => String(f).trim()).filter(Boolean)
    : []
  const sortOrder = Number(payload.sortOrder) || 0

  const existing = db.prepare('SELECT id FROM platform_plans WHERE id = ?').get(id)
  const tx = db.transaction(() => {
    if (popular) {
      db.prepare('UPDATE platform_plans SET popular = 0 WHERE id != ?').run(id)
    }
    if (existing) {
      db.prepare(
        `UPDATE platform_plans
         SET name = ?, tagline = ?, price_zar = ?, billing = ?, popular = ?, features_json = ?,
             sort_order = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(name, tagline, priceZar, billing, popular, JSON.stringify(features), sortOrder, id)
    } else {
      db.prepare(
        `INSERT INTO platform_plans (id, name, tagline, price_zar, billing, popular, features_json, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, name, tagline, priceZar, billing, popular, JSON.stringify(features), sortOrder)
    }
  })
  tx()
  return getPlan(id)
}

export function deletePlan(id) {
  const key = slugifyPlanId(id)
  if (!key) {
    const err = new Error('Plan id is required.')
    err.status = 400
    throw err
  }
  const existing = getPlan(key)
  if (!existing) {
    const err = new Error('Plan not found.')
    err.status = 404
    throw err
  }
  const total = db.prepare('SELECT COUNT(*) AS n FROM platform_plans').get().n
  if (total <= 1) {
    const err = new Error('Keep at least one plan.')
    err.status = 400
    throw err
  }
  const inUse = db
    .prepare(
      `SELECT COUNT(*) AS n FROM restaurants
       WHERE lower(trim(plan)) = ? OR lower(trim(plan)) = ?`,
    )
    .get(key, existing.name.toLowerCase())
  if (inUse?.n > 0) {
    const err = new Error(
      `Cannot delete “${existing.name}” — ${inUse.n} restaurant(s) still use this plan.`,
    )
    err.status = 409
    throw err
  }
  db.prepare('DELETE FROM platform_plans WHERE id = ?').run(key)
  return { ok: true, id: key }
}

export function listFeatureFlags() {
  return db
    .prepare('SELECT * FROM feature_flags ORDER BY key ASC')
    .all()
    .map((row) => ({
      key: row.key,
      description: row.description || '',
      enabled: Boolean(row.enabled),
      updatedAt: row.updated_at,
    }))
}

export function saveFeatureFlags(flags) {
  if (!Array.isArray(flags)) {
    const err = new Error('flags must be an array.')
    err.status = 400
    throw err
  }
  const upsert = db.prepare(
    `INSERT INTO feature_flags (key, description, enabled, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       description = excluded.description,
       enabled = excluded.enabled,
       updated_at = datetime('now')`,
  )
  const tx = db.transaction((rows) => {
    for (const flag of rows) {
      const key = String(flag.key || '').trim()
      if (!key) continue
      upsert.run(key, String(flag.description || ''), flag.enabled ? 1 : 0)
    }
  })
  tx(flags)
  return listFeatureFlags()
}

export function listPlatformStaff() {
  return db
    .prepare(
      `SELECT id, name, email, phone, role, created_at
       FROM users WHERE role = 'admin' ORDER BY created_at ASC`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      role: row.role,
      createdAt: row.created_at,
    }))
}

function readAdminCardsStore() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('admin_business_cards')
  try {
    return row?.value_json ? JSON.parse(row.value_json) : {}
  } catch {
    return {}
  }
}

function writeAdminCardsStore(store) {
  db.prepare(
    `INSERT INTO platform_settings (key, value_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = datetime('now')`,
  ).run('admin_business_cards', JSON.stringify(store))
}

function defaultAdminCard(user) {
  return {
    theme: 'lime',
    layout: 'split-gold',
    orgName: 'IROAS',
    publicSlug: 'iroas',
    published: true,
    card: {
      name: user?.name || 'IROAS Admin',
      role: 'Super Admin',
      phone: user?.phone || '',
      email: user?.email || '',
      website: 'iroas.com',
      insta: '',
      address: '',
      city: '',
      country: '',
      tagline: 'Platform operations · Restaurant digital suite',
      heroDataUrl: '',
      circleDataUrl: '',
      logoDataUrl: '',
    },
    updatedAt: null,
  }
}

export function getAdminBusinessCard(user) {
  const store = readAdminCardsStore()
  const saved = store[String(user.id)]
  const base = defaultAdminCard(user)
  if (!saved) return base
  return {
    ...base,
    ...saved,
    card: { ...base.card, ...(saved.card || {}) },
  }
}

export function saveAdminBusinessCard(user, payload = {}) {
  const current = getAdminBusinessCard(user)
  const nextCard = {
    ...current.card,
    ...(payload.card || {}),
    name: String(payload.card?.name ?? current.card.name ?? '').trim() || user.name || 'IROAS Admin',
    role: String(payload.card?.role ?? current.card.role ?? 'Super Admin').trim() || 'Super Admin',
    email: String(payload.card?.email ?? current.card.email ?? user.email ?? '').trim(),
    phone: String(payload.card?.phone ?? current.card.phone ?? '').trim(),
    website: String(payload.card?.website ?? current.card.website ?? '').trim(),
    insta: String(payload.card?.insta ?? current.card.insta ?? '').trim(),
    address: String(payload.card?.address ?? current.card.address ?? '').trim(),
    city: String(payload.card?.city ?? current.card.city ?? '').trim(),
    country: String(payload.card?.country ?? current.card.country ?? '').trim(),
    tagline: String(payload.card?.tagline ?? current.card.tagline ?? '').trim(),
    heroDataUrl: payload.card?.heroDataUrl ?? current.card.heroDataUrl ?? '',
    circleDataUrl: payload.card?.circleDataUrl ?? current.card.circleDataUrl ?? '',
    logoDataUrl: payload.card?.logoDataUrl ?? current.card.logoDataUrl ?? '',
  }
  const publicSlug = String(payload.publicSlug ?? current.publicSlug ?? 'iroas')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-|-$/g, '') || 'iroas'

  const next = {
    theme: payload.theme || current.theme || 'lime',
    layout: payload.layout || current.layout || 'split-gold',
    orgName: String(payload.orgName ?? current.orgName ?? 'IROAS').trim() || 'IROAS',
    publicSlug,
    published: payload.published !== undefined ? Boolean(payload.published) : current.published !== false,
    card: nextCard,
    updatedAt: new Date().toISOString(),
  }

  const store = readAdminCardsStore()
  // Keep public slug unique among published admin cards
  for (const [id, entry] of Object.entries(store)) {
    if (id === String(user.id)) continue
    if (entry?.published && entry?.publicSlug === publicSlug) {
      const err = new Error('That public card link is already used by another admin.')
      err.status = 409
      throw err
    }
  }
  store[String(user.id)] = next
  writeAdminCardsStore(store)
  return next
}

/** Public lookup by slug for guest business card page. */
export function getPublishedAdminCardBySlug(slug) {
  const clean = String(slug || '')
    .toLowerCase()
    .trim()
  if (!clean) return null
  const store = readAdminCardsStore()
  for (const [userId, entry] of Object.entries(store)) {
    if (!entry?.published) continue
    if (String(entry.publicSlug || '').toLowerCase() !== clean) continue
    const admin = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ? AND role = ?').get(
      Number(userId),
      'admin',
    )
    return {
      ...entry,
      admin: admin
        ? { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone || '' }
        : null,
    }
  }
  // Fallback: default IROAS card from first admin when slug is iroas and nothing saved
  if (clean === 'iroas') {
    const admin = db
      .prepare(`SELECT id, name, email, phone FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`)
      .get()
    if (!admin) return null
    return { ...defaultAdminCard(admin), admin }
  }
  return null
}

export function createPlatformStaff({ name, email, password, phone }) {
  const cleanName = String(name || '').trim()
  const cleanEmail = String(email || '').trim().toLowerCase()
  const cleanPassword = String(password || '')
  if (!cleanName || !cleanEmail || cleanPassword.length < 8) {
    const err = new Error('Name, email, and password (min 8 chars) are required.')
    err.status = 400
    throw err
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)
  if (existing) {
    const err = new Error('That email is already registered.')
    err.status = 409
    throw err
  }
  const hash = bcrypt.hashSync(cleanPassword, 10)
  const result = db
    .prepare(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`,
    )
    .run(cleanName, cleanEmail, phone ? String(phone).trim() : null, hash)
  return listPlatformStaff().find((u) => u.id === result.lastInsertRowid)
}

export function getPlatformHealth() {
  let dbOk = false
  try {
    db.prepare('SELECT 1 AS ok').get()
    dbOk = true
  } catch {
    dbOk = false
  }
  const payment = getPublicPaymentSettings()
  const emailOk = isEmailConfigured()
  return {
    checks: [
      {
        key: 'database',
        label: 'Database',
        ok: dbOk,
        status: dbOk ? 'Connected' : 'Unavailable',
      },
      {
        key: 'email',
        label: 'Email delivery',
        ok: emailOk,
        status: emailOk ? 'Configured' : 'Not configured',
      },
      {
        key: 'payment',
        label: 'Launch payments',
        ok: Boolean(payment.configured),
        status: payment.configured
          ? payment.useSandbox
            ? 'Configured (sandbox)'
            : 'Configured (live)'
          : 'Not configured',
      },
    ],
  }
}

export function listPlatformFeed({ limit = 40 } = {}) {
  const items = []

  const pending = db
    .prepare(
      `SELECT id, name, submitted_at, owner_id FROM restaurants
       WHERE status = 'pending_approval'
       ORDER BY COALESCE(submitted_at, updated_at) DESC LIMIT 20`,
    )
    .all()
  for (const row of pending) {
    const owner = db.prepare('SELECT name, email FROM users WHERE id = ?').get(row.owner_id)
    items.push({
      id: `tenant-pending-${row.id}`,
      type: 'approval',
      title: `${row.name || 'Untitled'} awaits approval`,
      body: owner ? `${owner.name} · ${owner.email}` : 'Submitted for review',
      createdAt: row.submitted_at || new Date().toISOString(),
      meta: { tenantId: row.id },
    })
  }

  const identities = db
    .prepare(
      `SELECT id, business_name, reference_id, submitted_at, status
       FROM digital_identities
       WHERE status IN ('submitted', 'under_review', 'needs_info')
       ORDER BY COALESCE(submitted_at, created_at) DESC LIMIT 15`,
    )
    .all()
  for (const row of identities) {
    items.push({
      id: `identity-${row.id}`,
      type: 'identity',
      title: `Identity ${row.reference_id || row.id} · ${row.status}`,
      body: row.business_name || 'Digital Identity',
      createdAt: row.submitted_at || new Date().toISOString(),
      meta: { identityId: row.id },
    })
  }

  for (const entry of listPlatformAudit({ limit: 20 })) {
    items.push({
      id: `audit-${entry.id}`,
      type: 'audit',
      title: entry.action,
      body: entry.detail || [entry.entityType, entry.entityId].filter(Boolean).join(' '),
      createdAt: entry.createdAt,
      meta: { auditId: entry.id },
    })
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.min(Number(limit) || 40, 100))
}
