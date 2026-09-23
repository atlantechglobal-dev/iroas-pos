import { db } from '../infra/db.js'
import { createNotification, queueEmail } from './identityService.js'

export const TENANT_STATUSES = [
  'onboarding',
  'pending_approval',
  'live',
  'rejected',
  'deleted',
]

const CHECKLIST_KEYS = ['profile', 'domain', 'brand', 'preview']

export function getTenantRow(id) {
  return db
    .prepare(
      `SELECT r.*,
              u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
              reviewer.name AS reviewer_name, reviewer.email AS reviewer_email
       FROM restaurants r
       JOIN users u ON u.id = r.owner_id
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       WHERE r.id = ?`,
    )
    .get(id)
}

export function listTenantEvents(restaurantId) {
  return db
    .prepare(
      `SELECT e.*, u.name AS actor_name, u.email AS actor_email
       FROM tenant_review_events e
       LEFT JOIN users u ON u.id = e.changed_by
       WHERE e.restaurant_id = ?
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 50`,
    )
    .all(restaurantId)
}

export function appendTenantEvent({ restaurantId, action, previousStatus, newStatus, note, changedBy }) {
  db.prepare(
    `INSERT INTO tenant_review_events
      (restaurant_id, action, previous_status, new_status, note, changed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(restaurantId, action, previousStatus || null, newStatus || null, note || null, changedBy || null)
}

export function mapTenant(row) {
  if (!row) return null
  let settings = {}
  try {
    settings = row.settings_json ? JSON.parse(row.settings_json) : {}
  } catch {
    settings = {}
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    cuisine: row.cuisine,
    description: row.description,
    phone: row.phone,
    website: row.website,
    email: row.email,
    city: row.city,
    country: row.country,
    timezone: row.timezone,
    address: row.address,
    operatingHours: row.operating_hours,
    subdomain: row.subdomain,
    customDomain: row.custom_domain,
    domainSuffix: row.domain_suffix,
    logoDataUrl: row.logo_data_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    font: row.font,
    theme: row.theme,
    status: row.status,
    plan: row.plan,
    launchedAt: row.launched_at,
    submittedAt: row.submitted_at,
    rejectionReason: row.rejection_reason,
    rejectedAt: row.rejected_at,
    reviewedAt: row.reviewed_at,
    awaitingAccountApproval: Boolean(settings.awaitingAccountApproval),
    onboardingPaid: Boolean(settings?.onboardingPayment?.paid),
    businessCategory: settings.businessCategory || settings.category || '',
    reviewedBy: row.reviewed_by
      ? {
          id: row.reviewed_by,
          name: row.reviewer_name || '',
          email: row.reviewer_email || '',
        }
      : null,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: {
      name: row.owner_name,
      email: row.owner_email,
      phone: row.owner_phone,
    },
  }
}

export function validateChecklist(checks) {
  if (!checks || typeof checks !== 'object') return false
  return CHECKLIST_KEYS.every((key) => checks[key] === true)
}

export function notifyOwner({ restaurant, title, body, emailSubject, emailBody }) {
  createNotification({
    userId: restaurant.owner_id,
    type: 'restaurant',
    title,
    body,
    meta: { restaurantId: restaurant.id, status: restaurant.status },
  })
  const owner = db.prepare('SELECT email, name FROM users WHERE id = ?').get(restaurant.owner_id)
  if (owner?.email) {
    queueEmail({
      to: owner.email,
      subject: emailSubject,
      body: [`Hi ${owner.name || 'there'},`, '', emailBody].join('\n'),
    })
  }
}
