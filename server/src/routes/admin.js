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
  validateChecklist,
} from '../services/tenantReview.js'

const router = Router()

router.use(requireAuth, requireAdmin)

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

  const pendingApprovals = db
    .prepare("SELECT COUNT(*) AS n FROM restaurants WHERE status = 'pending_approval'")
    .get().n

  const onboardingTenants = db
    .prepare("SELECT COUNT(*) AS n FROM restaurants WHERE status = 'onboarding'")
    .get().n

  res.json({
    activeTenants,
    totalTenants,
    onboardingTenants,
    pendingApprovals,
    rejectedTenants,
    identityPending,
  })
})

router.get('/tenants', (req, res) => {
  const search = (req.query.search || '').toLowerCase()
  const status = req.query.status || ''

  let rows = db
    .prepare(
      `SELECT r.id, r.name, r.city, r.country, r.plan, r.status, r.launched_at,
              r.submitted_at, r.cuisine, r.subdomain, r.custom_domain, r.created_at,
              r.rejection_reason, r.rejected_at,
              u.name AS owner_name, u.email AS owner_email
       FROM restaurants r
       JOIN users u ON u.id = r.owner_id
       WHERE r.status != 'deleted'
       ORDER BY
         CASE r.status
           WHEN 'pending_approval' THEN 0
           WHEN 'rejected' THEN 1
           WHEN 'onboarding' THEN 2
           ELSE 3
         END,
         COALESCE(r.submitted_at, r.created_at) DESC`,
    )
    .all()

  if (status && TENANT_STATUSES.includes(status) && status !== 'deleted') {
    rows = rows.filter((r) => r.status === status)
  }

  const filtered = search
    ? rows.filter((r) =>
        `${r.name} ${r.city} ${r.owner_name} ${r.owner_email}`.toLowerCase().includes(search),
      )
    : rows

  res.json({ tenants: filtered, total: rows.length })
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
       logo_data_url = ?,
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
    restaurant.id,
  )

  appendTenantEvent({
    restaurantId: restaurant.id,
    action: 'update',
    previousStatus: restaurant.status,
    newStatus: restaurant.status,
    note: 'Admin updated application details',
    changedBy: req.user.id,
  })

  const row = getTenantRow(restaurant.id)
  res.json({ tenant: mapTenant(row), events: listTenantEvents(restaurant.id) })
})

router.post('/tenants/:id/approve', (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id)
  if (!restaurant || restaurant.status === 'deleted') {
    return res.status(404).json({ error: 'Tenant not found.' })
  }
  if (restaurant.status !== 'pending_approval') {
    return res.status(400).json({ error: 'Only applications awaiting approval can be published.' })
  }
  if (!validateChecklist(req.body?.checks)) {
    return res.status(400).json({ error: 'Verify profile, domain, brand, and preview before approving.' })
  }

  db.prepare(
    `UPDATE restaurants SET
       status = 'live',
       launched_at = COALESCE(launched_at, datetime('now')),
       reviewed_at = datetime('now'),
       reviewed_by = ?,
       rejection_reason = NULL,
       rejected_at = NULL,
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(req.user.id, restaurant.id)

  appendTenantEvent({
    restaurantId: restaurant.id,
    action: 'approve',
    previousStatus: restaurant.status,
    newStatus: 'live',
    note: 'Approved and published',
    changedBy: req.user.id,
  })

  const updated = { ...restaurant, status: 'live' }
  notifyOwner({
    restaurant: updated,
    title: 'Your restaurant is approved',
    body: `${restaurant.name || 'Your restaurant'} is now live. Customers can visit your public site.`,
    emailSubject: 'Your restaurant is live on IROAS',
    emailBody: `Good news — ${restaurant.name || 'your restaurant'} has been approved and published for customers.\nSign in to your dashboard to manage your business.`,
  })

  const row = getTenantRow(restaurant.id)
  res.json({ tenant: mapTenant(row), events: listTenantEvents(restaurant.id) })
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

export default router
