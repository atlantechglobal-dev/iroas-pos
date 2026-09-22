import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import {
  appendIdentityEvent,
  appendProductEvent,
  createNotification,
  getIdentityById,
  IDENTITY_STATUSES,
  listIdentityEvents,
  listProductEvents,
  listProductsForIdentity,
  mapIdentity,
  mapProduct,
  PRODUCT_STATUSES,
  queueEmail,
} from '../services/identityService.js'
import {
  appendTenantEvent,
  getTenantRow,
  listTenantEvents,
  mapTenant,
  notifyOwner,
  TENANT_STATUSES,
} from '../services/tenantReview.js'
import { sendApprovalEmails } from '../services/onboardingMessaging.js'
import {
  getPublicEmailSettings,
  saveEmailSettings,
  sendEmail,
  isEmailConfigured,
} from '../services/emailService.js'
import { getPublicPaymentSettings, savePaymentSettings } from '../services/paymentSettings.js'
import {
  getPublicGoogleAuthSettings,
  saveGoogleAuthSettings,
} from '../services/googleAuthSettings.js'
import {
  addBusinessCategory,
  listBusinessCategories,
  removeBusinessCategory,
  renameBusinessCategory,
  saveBusinessCategories,
} from '../services/businessCategories.js'
import {
  appendPlatformAudit,
  createPlatformStaff,
  getAdminBusinessCard,
  getPlatformHealth,
  listFeatureFlags,
  deletePlan,
  listPlans,
  listPlatformAudit,
  listPlatformFeed,
  listPlatformStaff,
  saveAdminBusinessCard,
  saveFeatureFlags,
  upsertPlan,
} from '../services/platformAdminService.js'

const router = Router()

router.use(requireAuth, requireAdmin)

function auditFromReq(req, action, entityType, entityId, detail) {
  appendPlatformAudit({
    actorId: req.user?.id,
    actorEmail: req.user?.email || '',
    action,
    entityType,
    entityId,
    detail,
  })
}

router.get('/stats', (req, res) => {
  const activeTenants = db
    .prepare("SELECT COUNT(*) AS n FROM restaurants WHERE status = 'live'")
    .get().n

  const rejectedTenants = db
    .prepare("SELECT COUNT(*) AS n FROM restaurants WHERE status = 'rejected'")
    .get().n

  const totalTenants = db
    .prepare("SELECT COUNT(*) AS n FROM restaurants WHERE status != 'deleted'")
    .get().n
  const identityPending = db
    .prepare(
      `SELECT COUNT(*) AS n FROM digital_identities
       WHERE status IN ('submitted', 'under_review', 'needs_info')`,
    )
    .get().n

  const pendingRows = db
    .prepare(
      `SELECT settings_json FROM restaurants WHERE status = 'pending_approval'`,
    )
    .all()
  let pendingAccountApprovals = 0
  let pendingApprovals = 0
  for (const row of pendingRows) {
    let awaiting = false
    try {
      awaiting = Boolean(JSON.parse(row.settings_json || '{}').awaitingAccountApproval)
    } catch {
      awaiting = false
    }
    if (awaiting) pendingAccountApprovals += 1
    else pendingApprovals += 1
  }

  const onboardingTenants = db
    .prepare("SELECT COUNT(*) AS n FROM restaurants WHERE status = 'onboarding'")
    .get().n

  res.json({
    activeTenants,
    totalTenants,
    onboardingTenants,
    pendingApprovals,
    pendingAccountApprovals,
    rejectedTenants,
    identityPending,
  })
})

router.get('/tenants', (req, res) => {
  const search = (req.query.search || '').toLowerCase()
  const status = req.query.status || ''
  const kind = String(req.query.kind || '').trim().toLowerCase()

  let rows = db
    .prepare(
      `SELECT r.id, r.name, r.city, r.country, r.plan, r.status, r.launched_at,
              r.submitted_at, r.cuisine, r.subdomain, r.custom_domain, r.created_at,
              r.rejection_reason, r.rejected_at, r.reviewed_at, r.reviewed_by,
              r.email AS restaurant_email, r.phone AS restaurant_phone, r.settings_json,
              u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
              reviewer.name AS reviewer_name, reviewer.email AS reviewer_email
       FROM restaurants r
       JOIN users u ON u.id = r.owner_id
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       WHERE r.status != 'deleted'
       ORDER BY
         CASE r.status
           WHEN 'pending_approval' THEN 0
           WHEN 'rejected' THEN 1
           WHEN 'onboarding' THEN 2
           ELSE 3
         END,
         COALESCE(r.reviewed_at, r.submitted_at, r.created_at) DESC`,
    )
    .all()

  const withFlags = rows.map((r) => {
    let settings = {}
    try {
      settings = r.settings_json ? JSON.parse(r.settings_json) : {}
    } catch {
      settings = {}
    }
    const awaitingAccountApproval = Boolean(settings.awaitingAccountApproval)
    const accountApprovedAt = settings.accountApprovedAt || null
    const onboardingPaid = Boolean(settings?.onboardingPayment?.paid)
    const businessCategory = settings.businessCategory || settings.category || ''
    const { settings_json: _omit, ...rest } = r
    return {
      ...rest,
      awaitingAccountApproval,
      accountApprovedAt,
      onboardingPaid,
      businessCategory,
    }
  })

  let filtered = withFlags

  if (kind === 'account') {
    // Only Create Account signup approvals (single approval gate)
    filtered = filtered.filter(
      (r) => r.awaitingAccountApproval || Boolean(r.accountApprovedAt),
    )
  }

  if (kind === 'account' && status === 'waiting') {
    filtered = filtered.filter(
      (r) => r.awaitingAccountApproval && r.status === 'pending_approval',
    )
  } else if (kind === 'account' && status === 'approved') {
    filtered = filtered.filter(
      (r) => !r.awaitingAccountApproval && Boolean(r.accountApprovedAt),
    )
  } else if (status && TENANT_STATUSES.includes(status) && status !== 'deleted') {
    filtered = filtered.filter((r) => r.status === status)
  }

  if (search) {
    filtered = filtered.filter((r) =>
      `${r.name} ${r.city} ${r.owner_name} ${r.owner_email} ${r.businessCategory}`
        .toLowerCase()
        .includes(search),
    )
  }

  res.json({ tenants: filtered, total: filtered.length })
})

router.get('/tenants/:id', (req, res) => {
  try {
    const row = getTenantRow(req.params.id)
    if (!row || row.status === 'deleted') {
      return res.status(404).json({ error: 'Tenant not found.' })
    }
    let events = []
    try {
      events = listTenantEvents(row.id)
    } catch {
      events = []
    }
    res.json({ tenant: mapTenant(row), events })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Unable to load tenant.' })
  }
})

router.patch('/tenants/:id', (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id)
  if (!restaurant || restaurant.status === 'deleted') {
    return res.status(404).json({ error: 'Tenant not found.' })
  }

  const body = req.body || {}
  const subdomain = body.subdomain !== undefined ? body.subdomain : restaurant.subdomain
  if (subdomain) {
    const taken = db
      .prepare('SELECT id FROM restaurants WHERE subdomain = ? AND id != ? AND status != ?')
      .get(subdomain, restaurant.id, 'deleted')
    if (taken) return res.status(409).json({ error: 'That subdomain is already taken.' })
  }

  const hours =
    body.operatingHours != null
      ? typeof body.operatingHours === 'string'
        ? body.operatingHours
        : JSON.stringify(body.operatingHours)
      : restaurant.operating_hours

  db.prepare(
    `UPDATE restaurants SET
       name = ?, cuisine = ?, description = ?, phone = ?, website = ?, email = ?,
       city = ?, country = ?, timezone = ?, address = ?, operating_hours = ?,
       subdomain = ?, custom_domain = ?, domain_suffix = ?,
       primary_color = ?, secondary_color = ?, accent_color = ?, font = ?, theme = ?,
       logo_data_url = ?, plan = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    body.name ?? restaurant.name,
    body.cuisine ?? restaurant.cuisine,
    body.description ?? restaurant.description,
    body.phone ?? restaurant.phone,
    body.website ?? restaurant.website,
    body.email ?? restaurant.email,
    body.city ?? restaurant.city,
    body.country ?? restaurant.country,
    body.timezone ?? restaurant.timezone,
    body.address ?? restaurant.address,
    hours,
    subdomain ?? null,
    body.customDomain !== undefined ? body.customDomain : restaurant.custom_domain,
    body.domainSuffix ?? restaurant.domain_suffix,
    body.primaryColor ?? restaurant.primary_color,
    body.secondaryColor ?? restaurant.secondary_color,
    body.accentColor ?? restaurant.accent_color,
    body.font ?? restaurant.font,
    body.theme ?? restaurant.theme,
    body.logoDataUrl !== undefined ? body.logoDataUrl : restaurant.logo_data_url,
    body.plan !== undefined ? String(body.plan) : restaurant.plan,
    restaurant.id,
  )

  appendTenantEvent({
    restaurantId: restaurant.id,
    action: 'update',
    previousStatus: restaurant.status,
    newStatus: restaurant.status,
    note:
      body.plan !== undefined && body.plan !== restaurant.plan
        ? `Admin updated application details (plan → ${body.plan})`
        : 'Admin updated application details',
    changedBy: req.user.id,
  })
  auditFromReq(
    req,
    'tenant.update',
    'tenant',
    restaurant.id,
    body.plan !== undefined ? `Plan set to ${body.plan}` : 'Updated tenant details',
  )

  const row = getTenantRow(restaurant.id)
  res.json({ tenant: mapTenant(row), events: listTenantEvents(restaurant.id) })
})

router.post('/tenants/:id/approve', async (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id)
  if (!restaurant || restaurant.status === 'deleted') {
    return res.status(404).json({ error: 'Tenant not found.' })
  }

  let settings = {}
  try {
    settings = restaurant.settings_json ? JSON.parse(restaurant.settings_json) : {}
  } catch {
    settings = {}
  }

  // Only Create Account approval remains — no second publish/checklist approve
  if (!settings.awaitingAccountApproval) {
    return res.status(400).json({
      error:
        'This account does not need approval. Only new Create Account signups are approved here.',
    })
  }
  if (restaurant.status !== 'pending_approval') {
    return res.status(400).json({ error: 'Only new signups awaiting approval can be approved.' })
  }

  const nextStatus = 'onboarding'
  const nextSettings = { ...settings }
  delete nextSettings.awaitingAccountApproval
  nextSettings.accountApprovedAt = new Date().toISOString()

  db.prepare(
    `UPDATE restaurants SET
       status = ?,
       reviewed_at = datetime('now'),
       reviewed_by = ?,
       rejection_reason = NULL,
       rejected_at = NULL,
       settings_json = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(nextStatus, req.user.id, JSON.stringify(nextSettings), restaurant.id)

  appendTenantEvent({
    restaurantId: restaurant.id,
    action: 'approve',
    previousStatus: restaurant.status,
    newStatus: nextStatus,
    note: 'Account approved — owner can continue setup',
    changedBy: req.user.id,
  })
  auditFromReq(req, 'tenant.approve', 'tenant', restaurant.id, restaurant.name || '')

  const updated = { ...restaurant, status: nextStatus, settings_json: JSON.stringify(nextSettings) }
  createNotification({
    userId: restaurant.owner_id,
    type: 'restaurant',
    title: 'Your account is approved',
    body: `${restaurant.name || 'Your account'} was approved. Sign in to continue setup.`,
    meta: { restaurantId: restaurant.id, status: nextStatus },
  })

  const adminUser = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)
  const emails = await sendApprovalEmails({
    restaurant: updated,
    reviewedByAdminEmail: adminUser?.email || req.user.email || '',
    accountApproval: true,
  })

  const row = getTenantRow(restaurant.id)
  res.json({ tenant: mapTenant(row), events: listTenantEvents(restaurant.id), emails })
})

router.post('/tenants/:id/reject', (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id)
  if (!restaurant || restaurant.status === 'deleted') {
    return res.status(404).json({ error: 'Tenant not found.' })
  }
  if (restaurant.status !== 'pending_approval') {
    return res.status(400).json({ error: 'Only applications awaiting approval can be rejected.' })
  }

  const reason = String(req.body?.reason || '').trim()
  if (reason.length < 12) {
    return res.status(400).json({ error: 'Add a rejection reason (at least 12 characters).' })
  }

  db.prepare(
    `UPDATE restaurants SET
       status = 'rejected',
       rejection_reason = ?,
       rejected_at = datetime('now'),
       reviewed_at = datetime('now'),
       reviewed_by = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(reason, req.user.id, restaurant.id)

  appendTenantEvent({
    restaurantId: restaurant.id,
    action: 'reject',
    previousStatus: restaurant.status,
    newStatus: 'rejected',
    note: reason,
    changedBy: req.user.id,
  })
  auditFromReq(req, 'tenant.reject', 'tenant', restaurant.id, reason)

  const updated = { ...restaurant, status: 'rejected' }
  notifyOwner({
    restaurant: updated,
    title: 'Your application needs changes',
    body: reason,
    emailSubject: 'IROAS application update — changes needed',
    emailBody: `Your application for ${restaurant.name || 'your business'} was not approved yet.\n\nReason:\n${reason}\n\nSign in, update your details, and submit again from Launch.`,
  })

  const row = getTenantRow(restaurant.id)
  res.json({ tenant: mapTenant(row), events: listTenantEvents(restaurant.id) })
})

router.delete('/tenants/:id', (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id)
  if (!restaurant || restaurant.status === 'deleted') {
    return res.status(404).json({ error: 'Tenant not found.' })
  }
  if (restaurant.status === 'live') {
    return res.status(400).json({ error: 'Unpublish a live tenant before deleting it.' })
  }

  const confirmName = String(req.body?.confirmName || '').trim().toLowerCase()
  const actual = String(restaurant.name || '').trim().toLowerCase()
  if (!actual || confirmName !== actual) {
    return res.status(400).json({ error: 'Type the exact business name to confirm delete.' })
  }

  db.prepare(
    `UPDATE restaurants SET
       status = 'deleted',
       deleted_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(restaurant.id)

  appendTenantEvent({
    restaurantId: restaurant.id,
    action: 'delete',
    previousStatus: restaurant.status,
    newStatus: 'deleted',
    note: 'Admin deleted tenant',
    changedBy: req.user.id,
  })

  res.json({ ok: true })
})

router.patch('/tenants/:id/status', (req, res) => {
  const { status } = req.body || {}

  if (!['onboarding', 'pending_approval', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Approve from the review form to publish.' })
  }

  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id)
  if (!restaurant) return res.status(404).json({ error: 'Tenant not found.' })

  db.prepare(
    `UPDATE restaurants SET
       status = ?,
       launched_at = CASE WHEN ? = 'live' THEN COALESCE(launched_at, datetime('now')) ELSE launched_at END,
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(status, status, req.params.id)

  if (status === 'live' && restaurant.status !== 'live') {
    createNotification({
      userId: restaurant.owner_id,
      type: 'restaurant',
      title: 'Your restaurant is approved',
      body: `${restaurant.name || 'Your restaurant'} is now live. Customers can visit your public site.`,
      meta: { restaurantId: restaurant.id, status: 'live' },
    })
    const owner = db.prepare('SELECT email, name FROM users WHERE id = ?').get(restaurant.owner_id)
    if (owner?.email) {
      queueEmail({
        to: owner.email,
        subject: 'Your restaurant is live on IROAS',
        body: [
          `Hi ${owner.name || 'there'},`,
          '',
          `Good news — ${restaurant.name || 'your restaurant'} has been approved and published for customers.`,
          'Sign in to your dashboard to manage orders, menu, and more.',
        ].join('\n'),
      })
    }
  }

  res.json({ ok: true, status })
})

router.get('/identities', (req, res) => {
  const search = (req.query.search || '').toLowerCase().trim()
  const status = req.query.status || ''
  const category = req.query.category || ''

  let rows = db
    .prepare(
      `SELECT d.*, u.name AS owner_name, u.email AS owner_email
       FROM digital_identities d
       JOIN users u ON u.id = d.user_id
       ORDER BY
         CASE d.status
           WHEN 'submitted' THEN 0
           WHEN 'under_review' THEN 1
           WHEN 'needs_info' THEN 2
           ELSE 3
         END,
         COALESCE(d.submitted_at, d.created_at) DESC`,
    )
    .all()

  if (status) rows = rows.filter((r) => r.status === status)
  if (category) rows = rows.filter((r) => r.category === category)
  if (search) {
    rows = rows.filter((r) =>
      `${r.reference_id} ${r.business_name} ${r.owner_name} ${r.owner_email} ${r.category}`
        .toLowerCase()
        .includes(search),
    )
  }

  res.json({
    identities: rows.map((r) => ({
      ...mapIdentity(r),
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
    })),
    total: rows.length,
  })
})

router.get('/identities/:id', (req, res) => {
  const row = getIdentityById(req.params.id)
  if (!row) return res.status(404).json({ error: 'Digital Identity not found.' })

  const owner = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(row.user_id)
  res.json({
    identity: { ...mapIdentity(row), ownerName: owner?.name, ownerEmail: owner?.email },
    events: listIdentityEvents(row.id),
    products: listProductsForIdentity(row.id).map((p) => ({
      ...p,
      events: listProductEvents(p.id),
    })),
  })
})

router.post('/identities/:id/notes', (req, res) => {
  const row = getIdentityById(req.params.id)
  if (!row) return res.status(404).json({ error: 'Digital Identity not found.' })

  const note = (req.body?.note || '').trim()
  if (!note) return res.status(400).json({ error: 'Note is required.' })

  const existingNotes = row.admin_notes || ''
  const stamp = new Date().toISOString()
  const nextNotes = existingNotes
    ? `${existingNotes}\n\n[${stamp}] ${req.user.name || 'Admin'}: ${note}`
    : `[${stamp}] ${req.user.name || 'Admin'}: ${note}`

  db.prepare(
    `UPDATE digital_identities SET admin_notes = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(nextNotes, row.id)

  appendIdentityEvent({
    identityId: row.id,
    previousStatus: row.status,
    newStatus: row.status,
    changedBy: req.user.id,
    note,
  })

  res.json({ identity: mapIdentity(getIdentityById(row.id)), events: listIdentityEvents(row.id) })
})

router.post('/identities/:id/status', (req, res) => {
  const row = getIdentityById(req.params.id)
  if (!row) return res.status(404).json({ error: 'Digital Identity not found.' })

  const { status, note, assets } = req.body || {}
  if (!IDENTITY_STATUSES.includes(status) || status === 'draft') {
    return res.status(400).json({ error: 'Invalid status.' })
  }

  const previous = row.status
  const approvedAt = status === 'approved' || status === 'completed' ? new Date().toISOString() : null
  const completedAt = status === 'completed' ? new Date().toISOString() : null
  const assetsJson = Array.isArray(assets) ? JSON.stringify(assets) : null

  db.prepare(
    `UPDATE digital_identities SET
      status = ?,
      reviewed_at = COALESCE(reviewed_at, datetime('now')),
      approved_at = CASE WHEN ? IS NOT NULL THEN ? ELSE approved_at END,
      completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END,
      assets_json = COALESCE(?, assets_json),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(status, approvedAt, approvedAt, completedAt, completedAt, assetsJson, row.id)

  appendIdentityEvent({
    identityId: row.id,
    previousStatus: previous,
    newStatus: status,
    changedBy: req.user.id,
    note: note || `Status changed to ${status}`,
  })

  const titles = {
    under_review: 'Digital Identity under review',
    needs_info: 'Additional information required',
    approved: 'Digital Identity approved',
    rejected: 'Digital Identity rejected',
    completed: 'Digital Identity finalized',
    submitted: 'Digital Identity submitted',
  }

  const bodies = {
    under_review: 'Our team has started reviewing your Digital Identity submission.',
    needs_info:
      note ||
      'We need a bit more information before we can finalize your Digital Identity. Please update your form.',
    approved:
      'Your Digital Identity has been approved. You can now start Website, Digital Business Card, and Mobile Application onboarding.',
    rejected: note || 'Your Digital Identity submission was rejected. Please review and resubmit.',
    completed:
      'Your Digital Identity has been finalized. Approved assets are now available in your Digital Identity hub.',
  }

  createNotification({
    userId: row.user_id,
    type: 'identity',
    title: titles[status] || 'Digital Identity update',
    body: bodies[status] || `Status updated to ${status}.`,
    meta: { referenceId: row.reference_id, status },
  })

  // Identity approval unlocks product onboarding; restaurant go-live stays
  // a separate admin action after the owner submits setup for review.
  if (status === 'approved' || status === 'completed') {
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(row.user_id)
    if (restaurant) {
      let settings = {}
      try {
        settings = restaurant.settings_json ? JSON.parse(restaurant.settings_json) : {}
      } catch {
        settings = {}
      }
      settings.identitySubmitted = true
      settings.identityApprovedAt = new Date().toISOString()
      db.prepare(
        `UPDATE restaurants SET settings_json = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(JSON.stringify(settings), restaurant.id)
    }
  }

  const owner = db.prepare('SELECT email, name FROM users WHERE id = ?').get(row.user_id)
  const to = row.email || owner?.email
  if (to) {
    queueEmail({
      to,
      subject: `${titles[status] || 'Digital Identity update'} (${row.reference_id})`,
      body: [
        `Hi ${row.contact_person || owner?.name || 'there'},`,
        '',
        bodies[status] || `Your Digital Identity status is now: ${status}.`,
        '',
        `Reference ID: ${row.reference_id}`,
        `Status: ${status}`,
        note ? `\nNote from our team:\n${note}` : '',
        '',
        'IROAS Team',
      ]
        .filter(Boolean)
        .join('\n'),
      identityId: row.id,
    })
  }

  res.json({
    identity: mapIdentity(getIdentityById(row.id)),
    events: listIdentityEvents(row.id),
  })
})

router.get('/products', (req, res) => {
  const type = req.query.type || ''
  const status = req.query.status || ''

  let rows = db
    .prepare(
      `SELECT p.*, d.business_name, d.reference_id, u.name AS owner_name, u.email AS owner_email
       FROM product_requests p
       JOIN digital_identities d ON d.id = p.identity_id
       JOIN users u ON u.id = p.user_id
       ORDER BY COALESCE(p.submitted_at, p.created_at) DESC`,
    )
    .all()

  if (type) rows = rows.filter((r) => r.product_type === type)
  if (status) rows = rows.filter((r) => r.status === status)

  res.json({
    products: rows.map((r) => ({
      ...mapProduct(r),
      businessName: r.business_name,
      referenceId: r.reference_id,
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
    })),
  })
})

router.patch('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM product_requests WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Product request not found.' })

  const { status, note } = req.body || {}
  const allowed = PRODUCT_STATUSES[row.product_type] || []
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid product status.' })
  }

  db.prepare(
    `UPDATE product_requests
     SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = datetime('now')
     WHERE id = ?`,
  ).run(status, note || null, row.id)

  appendProductEvent({
    productId: row.id,
    previousStatus: row.status,
    newStatus: status,
    changedBy: req.user.id,
    note: note || `Status changed to ${status}`,
  })

  const labels = {
    website: 'Website',
    digital_business_card: 'Digital Business Card',
    mobile_app: 'Mobile Application',
  }

  createNotification({
    userId: row.user_id,
    type: 'product',
    title: `${labels[row.product_type]} status updated`,
    body: `Your ${labels[row.product_type]} request is now: ${status.replace(/_/g, ' ')}.`,
    meta: { productType: row.product_type, status },
  })

  const owner = db.prepare('SELECT email, name FROM users WHERE id = ?').get(row.user_id)
  if (owner?.email) {
    queueEmail({
      to: owner.email,
      subject: `${labels[row.product_type]} status: ${status.replace(/_/g, ' ')}`,
      body: [
        `Hi ${owner.name || 'there'},`,
        '',
        `Your ${labels[row.product_type]} request status is now: ${status.replace(/_/g, ' ')}.`,
        note ? `\nNote:\n${note}` : '',
        '',
        'IROAS Team',
      ]
        .filter(Boolean)
        .join('\n'),
      productId: row.id,
      identityId: row.identity_id,
    })
  }

  res.json({
    product: mapProduct(db.prepare('SELECT * FROM product_requests WHERE id = ?').get(row.id)),
    events: listProductEvents(row.id),
  })
})

router.get('/email-settings', (_req, res) => {
  res.json({ settings: getPublicEmailSettings() })
})

router.put('/email-settings', (req, res) => {
  try {
    const settings = saveEmailSettings(req.body || {})
    auditFromReq(req, 'settings.email', 'settings', 'email', 'Updated email settings')
    res.json({ ok: true, settings })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to save email settings.' })
  }
})

router.post('/email-settings/test', async (req, res) => {
  if (!isEmailConfigured()) {
    return res.status(400).json({
      error:
        'Email is not configured. Save a ZeptoMail API token + From email, or set SMTP_USER / SMTP_PASS in server/.env.',
    })
  }
  const to = String(req.body?.to || req.user?.email || process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || '').trim()
  if (!to) {
    return res.status(400).json({ error: 'Provide a recipient email for the test.' })
  }
  try {
    const result = await sendEmail({
      to,
      subject: 'IROAS email test',
      body: [
        'This is a test email from IROAS Email settings.',
        '',
        'If you received this (or see an Ethereal preview link in the API log), delivery is working.',
        '',
        '— IROAS',
      ].join('\n'),
      html: `<div style="font-family:sans-serif"><p><strong>IROAS email test</strong></p><p>If you received this, transactional email is working.</p></div>`,
    })
    res.json({
      ok: true,
      to,
      provider: result?.provider || null,
      previewUrl: result?.previewUrl || null,
    })
  } catch (err) {
    res.status(502).json({ error: err.message || 'Test email failed.' })
  }
})

router.get('/payment-settings', (_req, res) => {
  res.json({ settings: getPublicPaymentSettings() })
})

router.put('/payment-settings', (req, res) => {
  try {
    const settings = savePaymentSettings(req.body || {})
    auditFromReq(req, 'settings.payment', 'settings', 'payment', 'Updated payment settings')
    res.json({ ok: true, settings })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to save payment settings.' })
  }
})

router.get('/google-auth-settings', (_req, res) => {
  res.json({ settings: getPublicGoogleAuthSettings() })
})

router.put('/google-auth-settings', (req, res) => {
  try {
    const settings = saveGoogleAuthSettings(req.body || {})
    auditFromReq(req, 'settings.google_auth', 'settings', 'google_auth', 'Updated Google sign-in settings')
    res.json({ ok: true, settings })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to save Google sign-in settings.' })
  }
})

router.get('/business-categories', (_req, res) => {
  res.json({ categories: listBusinessCategories() })
})

router.put('/business-categories', (req, res) => {
  try {
    const categories = saveBusinessCategories(req.body?.categories || req.body || [])
    auditFromReq(
      req,
      'settings.business_categories',
      'settings',
      'business_categories',
      `Saved ${categories.length} categories`,
    )
    res.json({ ok: true, categories })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to save categories.' })
  }
})

router.post('/business-categories', (req, res) => {
  try {
    const categories = addBusinessCategory(req.body?.name || req.body?.category)
    auditFromReq(
      req,
      'settings.business_categories.create',
      'settings',
      'business_categories',
      `Added category`,
    )
    res.status(201).json({ ok: true, categories })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to add category.' })
  }
})

router.put('/business-categories/rename', (req, res) => {
  try {
    const categories = renameBusinessCategory(req.body?.oldName, req.body?.newName)
    auditFromReq(
      req,
      'settings.business_categories.rename',
      'settings',
      'business_categories',
      `Renamed category`,
    )
    res.json({ ok: true, categories })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to rename category.' })
  }
})

router.delete('/business-categories', (req, res) => {
  try {
    const name = req.body?.name || req.query?.name
    const categories = removeBusinessCategory(name)
    auditFromReq(
      req,
      'settings.business_categories.delete',
      'settings',
      'business_categories',
      `Removed category`,
    )
    res.json({ ok: true, categories })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to remove category.' })
  }
})

router.get('/plans', (_req, res) => {
  res.json({ plans: listPlans() })
})

router.post('/plans', (req, res) => {
  try {
    const body = req.body || {}
    const id =
      String(body.id || '').trim() ||
      String(body.name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-+|-+$)/g, '')
    if (!id) {
      return res.status(400).json({ error: 'Plan name is required.' })
    }
    const existing = listPlans().find((p) => p.id === id)
    if (existing) {
      return res.status(409).json({ error: `Plan “${id}” already exists. Edit it instead.` })
    }
    const maxSort = listPlans().reduce((m, p) => Math.max(m, Number(p.sortOrder) || 0), 0)
    const plan = upsertPlan({
      ...body,
      id,
      sortOrder: body.sortOrder !== undefined ? body.sortOrder : maxSort + 1,
    })
    auditFromReq(req, 'plans.create', 'plan', plan.id, `${plan.name} · R${plan.priceZar}`)
    res.status(201).json({ ok: true, plan, plans: listPlans() })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to create plan.' })
  }
})

router.put('/plans/:id', (req, res) => {
  try {
    const plan = upsertPlan({ ...req.body, id: req.params.id })
    auditFromReq(req, 'plans.update', 'plan', plan.id, `${plan.name} · R${plan.priceZar}`)
    res.json({ ok: true, plan, plans: listPlans() })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to save plan.' })
  }
})

router.delete('/plans/:id', (req, res) => {
  try {
    const result = deletePlan(req.params.id)
    auditFromReq(req, 'plans.delete', 'plan', result.id, `Deleted plan ${result.id}`)
    res.json({ ok: true, ...result, plans: listPlans() })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to delete plan.' })
  }
})

router.get('/feature-flags', (_req, res) => {
  res.json({ flags: listFeatureFlags() })
})

router.put('/feature-flags', (req, res) => {
  try {
    const flags = saveFeatureFlags(req.body?.flags || req.body || [])
    auditFromReq(req, 'flags.update', 'feature_flags', null, `Updated ${flags.length} flags`)
    res.json({ ok: true, flags })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to save flags.' })
  }
})

router.get('/audit', (req, res) => {
  const limit = Number(req.query.limit) || 100
  res.json({ entries: listPlatformAudit({ limit }) })
})

router.get('/feed', (req, res) => {
  const limit = Number(req.query.limit) || 40
  res.json({ items: listPlatformFeed({ limit }) })
})

router.get('/health', (_req, res) => {
  res.json(getPlatformHealth())
})

router.get('/staff', (_req, res) => {
  res.json({ staff: listPlatformStaff() })
})

router.post('/staff', (req, res) => {
  try {
    const user = createPlatformStaff(req.body || {})
    auditFromReq(req, 'staff.create', 'user', user.id, user.email)
    res.status(201).json({ ok: true, user, staff: listPlatformStaff() })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to create staff user.' })
  }
})

router.get('/professional-card', (req, res) => {
  res.json({ card: getAdminBusinessCard(req.user) })
})

router.put('/professional-card', (req, res) => {
  try {
    const card = saveAdminBusinessCard(req.user, req.body || {})
    auditFromReq(req, 'admin.card.save', 'user', req.user.id, card.publicSlug || '')
    res.json({ ok: true, card })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Unable to save professional card.' })
  }
})

export default router
