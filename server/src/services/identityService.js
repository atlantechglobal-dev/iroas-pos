import { db } from '../db.js'

export const IDENTITY_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'needs_info',
  'approved',
  'rejected',
  'completed',
]

export const PRODUCT_TYPES = ['website', 'digital_business_card', 'mobile_app']

export const PRODUCT_STATUSES = {
  website: ['not_started', 'requested', 'under_review', 'in_development', 'completed'],
  digital_business_card: ['not_started', 'requested', 'under_review', 'in_development', 'completed'],
  mobile_app: [
    'not_started',
    'requested',
    'requirements_submitted',
    'under_review',
    'in_development',
    'testing',
    'ready_for_review',
    'published',
    'completed',
  ],
}

export const BUSINESS_CATEGORIES = [
  'Restaurant',
  'Retail Store',
  'Salon',
  'Clinic',
  'Consultancy',
  'Freelancer',
  'Professional Services',
  'Real Estate',
  'Education',
  'Fitness/Gym',
  'Local Business',
  'E-commerce Business',
  'Other',
]

export function parseJson(value, fallback = {}) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function mapIdentity(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    referenceId: row.reference_id,
    status: row.status,
    businessName: row.business_name || '',
    category: row.category || '',
    categoryOther: row.category_other || '',
    businessType: row.business_type || '',
    description: row.description || '',
    yearEstablished: row.year_established || '',
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    email: row.email || '',
    website: row.website || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    postalCode: row.postal_code || '',
    brandName: row.brand_name || '',
    primaryBrandInfo: row.primary_brand_info || '',
    logoDataUrl: row.logo_data_url || '',
    social: parseJson(row.social_json, {}),
    onlinePresence: parseJson(row.online_presence_json, {}),
    verticalFields: parseJson(row.vertical_fields_json, {}),
    adminNotes: row.admin_notes || '',
    assets: parseJson(row.assets_json, []),
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    approvedAt: row.approved_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapProduct(row) {
  if (!row) return null
  return {
    id: row.id,
    identityId: row.identity_id,
    userId: row.user_id,
    productType: row.product_type,
    status: row.status,
    payload: parseJson(row.payload_json, {}),
    adminNotes: row.admin_notes || '',
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export function getIdentityByUser(userId) {
  return db.prepare('SELECT * FROM digital_identities WHERE user_id = ?').get(userId)
}

export function getIdentityById(id) {
  return db.prepare('SELECT * FROM digital_identities WHERE id = ?').get(id)
}

export function listIdentityEvents(identityId) {
  return db
    .prepare(
      `SELECT e.*, u.name AS changed_by_name, u.email AS changed_by_email
       FROM digital_identity_events e
       LEFT JOIN users u ON u.id = e.changed_by
       WHERE e.identity_id = ?
       ORDER BY e.created_at ASC, e.id ASC`,
    )
    .all(identityId)
    .map((e) => ({
      id: e.id,
      previousStatus: e.previous_status,
      newStatus: e.new_status,
      changedBy: e.changed_by,
      changedByName: e.changed_by_name,
      changedByEmail: e.changed_by_email,
      note: e.note || '',
      createdAt: e.created_at,
    }))
}

export function listProductEvents(productId) {
  return db
    .prepare(
      `SELECT e.*, u.name AS changed_by_name, u.email AS changed_by_email
       FROM product_request_events e
       LEFT JOIN users u ON u.id = e.changed_by
       WHERE e.product_id = ?
       ORDER BY e.created_at ASC, e.id ASC`,
    )
    .all(productId)
    .map((e) => ({
      id: e.id,
      previousStatus: e.previous_status,
      newStatus: e.new_status,
      changedBy: e.changed_by,
      changedByName: e.changed_by_name,
      changedByEmail: e.changed_by_email,
      note: e.note || '',
      createdAt: e.created_at,
    }))
}

export function listProductsForIdentity(identityId) {
  return db
    .prepare('SELECT * FROM product_requests WHERE identity_id = ? ORDER BY created_at ASC')
    .all(identityId)
    .map(mapProduct)
}

export function listProductsForUser(userId) {
  return db
    .prepare('SELECT * FROM product_requests WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId)
    .map(mapProduct)
}

export function nextReferenceId() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM digital_identities').get()
  return `DI-${1001 + (row?.n || 0)}`
}

export function appendIdentityEvent({ identityId, previousStatus, newStatus, changedBy, note }) {
  db.prepare(
    `INSERT INTO digital_identity_events (identity_id, previous_status, new_status, changed_by, note)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(identityId, previousStatus || null, newStatus, changedBy || null, note || null)
}

export function appendProductEvent({ productId, previousStatus, newStatus, changedBy, note }) {
  db.prepare(
    `INSERT INTO product_request_events (product_id, previous_status, new_status, changed_by, note)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(productId, previousStatus || null, newStatus, changedBy || null, note || null)
}

export function createNotification({ userId, type, title, body, meta }) {
  db.prepare(
    `INSERT INTO notifications (user_id, type, title, body, meta_json)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(userId, type || 'identity', title, body || null, meta ? JSON.stringify(meta) : null)
}

export function queueEmail({ to, subject, body, identityId, productId }) {
  const info = db
    .prepare(
      `INSERT INTO email_outbox (to_email, subject, body, identity_id, product_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(to, subject, body, identityId || null, productId || null)

  // Demo mode: log acknowledgement emails (no SMTP required).
  console.log(`[email_outbox #${info.lastInsertRowid}] To: ${to} | ${subject}`)
  return info.lastInsertRowid
}

export function identityUnlocked(status) {
  return status === 'approved' || status === 'completed'
}

export function buildPrefillFromIdentity(identity) {
  if (!identity) return {}
  return {
    businessName: identity.business_name || '',
    brandName: identity.brand_name || identity.business_name || '',
    description: identity.description || '',
    phone: identity.phone || '',
    email: identity.email || '',
    website: identity.website || '',
    address: [identity.address, identity.city, identity.state, identity.country, identity.postal_code]
      .filter(Boolean)
      .join(', '),
    city: identity.city || '',
    country: identity.country || '',
    contactPerson: identity.contact_person || '',
    logoDataUrl: identity.logo_data_url || '',
    category: identity.category || '',
    social: parseJson(identity.social_json, {}),
    onlinePresence: parseJson(identity.online_presence_json, {}),
    verticalFields: parseJson(identity.vertical_fields_json, {}),
  }
}

export function validateIdentityForSubmit(payload) {
  const errors = []
  if (!payload.businessName?.trim()) errors.push('Business name is required.')
  if (!payload.category?.trim()) errors.push('Business category is required.')
  if (payload.category === 'Other' && !payload.categoryOther?.trim()) {
    errors.push('Please specify your business category.')
  }
  if (!payload.contactPerson?.trim()) errors.push('Contact person is required.')
  if (!payload.email?.trim()) errors.push('Email is required.')
  if (!payload.phone?.trim()) errors.push('Phone number is required.')
  return errors
}
