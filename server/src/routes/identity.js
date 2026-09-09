import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  appendIdentityEvent,
  createNotification,
  getIdentityByUser,
  identityUnlocked,
  listIdentityEvents,
  listProductsForUser,
  mapIdentity,
  nextReferenceId,
  queueEmail,
  validateIdentityForSubmit,
} from '../services/identityService.js'

const router = Router()
router.use(requireAuth)

function payloadFromBody(body = {}) {
  return {
    businessName: body.businessName ?? '',
    category: body.category ?? '',
    categoryOther: body.categoryOther ?? '',
    businessType: body.businessType ?? '',
    description: body.description ?? '',
    yearEstablished: body.yearEstablished ?? '',
    contactPerson: body.contactPerson ?? '',
    phone: body.phone ?? '',
    email: body.email ?? '',
    website: body.website ?? '',
    address: body.address ?? '',
    city: body.city ?? '',
    state: body.state ?? '',
    country: body.country ?? '',
    postalCode: body.postalCode ?? '',
    brandName: body.brandName ?? '',
    primaryBrandInfo: body.primaryBrandInfo ?? '',
    logoDataUrl: body.logoDataUrl ?? '',
    social: body.social || {},
    onlinePresence: body.onlinePresence || {},
    verticalFields: body.verticalFields || {},
  }
}

function upsertDraft(userId, payload, { keepStatus } = {}) {
  const existing = getIdentityByUser(userId)
  const socialJson = JSON.stringify(payload.social || {})
  const onlineJson = JSON.stringify(payload.onlinePresence || {})
  const verticalJson = JSON.stringify(payload.verticalFields || {})

  if (!existing) {
    const referenceId = nextReferenceId()
    const info = db
      .prepare(
        `INSERT INTO digital_identities (
          user_id, reference_id, status,
          business_name, category, category_other, business_type, description,
          year_established, contact_person, phone, email, website,
          address, city, state, country, postal_code,
          brand_name, primary_brand_info, logo_data_url,
          social_json, online_presence_json, vertical_fields_json
        ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        referenceId,
        payload.businessName || null,
        payload.category || null,
        payload.categoryOther || null,
        payload.businessType || null,
        payload.description || null,
        payload.yearEstablished || null,
        payload.contactPerson || null,
        payload.phone || null,
        payload.email || null,
        payload.website || null,
        payload.address || null,
        payload.city || null,
        payload.state || null,
        payload.country || null,
        payload.postalCode || null,
        payload.brandName || null,
        payload.primaryBrandInfo || null,
        payload.logoDataUrl || null,
        socialJson,
        onlineJson,
        verticalJson,
      )

    appendIdentityEvent({
      identityId: info.lastInsertRowid,
      previousStatus: null,
      newStatus: 'draft',
      changedBy: userId,
      note: 'Draft created',
    })

    return getIdentityByUser(userId)
  }

  const locked =
    !keepStatus &&
    ['submitted', 'under_review', 'approved', 'completed'].includes(existing.status)

  if (locked && existing.status !== 'needs_info' && existing.status !== 'rejected') {
    // Allow edits only for draft / needs_info / rejected; otherwise just return current
    return existing
  }

  const nextStatus =
    keepStatus ||
    (existing.status === 'needs_info' || existing.status === 'rejected' || existing.status === 'draft'
      ? existing.status === 'needs_info' || existing.status === 'rejected'
        ? existing.status
        : 'draft'
      : existing.status)

  db.prepare(
    `UPDATE digital_identities SET
      business_name = ?, category = ?, category_other = ?, business_type = ?, description = ?,
      year_established = ?, contact_person = ?, phone = ?, email = ?, website = ?,
      address = ?, city = ?, state = ?, country = ?, postal_code = ?,
      brand_name = ?, primary_brand_info = ?, logo_data_url = ?,
      social_json = ?, online_presence_json = ?, vertical_fields_json = ?,
      status = ?, updated_at = datetime('now')
     WHERE user_id = ?`,
  ).run(
    payload.businessName || null,
    payload.category || null,
    payload.categoryOther || null,
    payload.businessType || null,
    payload.description || null,
    payload.yearEstablished || null,
    payload.contactPerson || null,
    payload.phone || null,
    payload.email || null,
    payload.website || null,
    payload.address || null,
    payload.city || null,
    payload.state || null,
    payload.country || null,
    payload.postalCode || null,
    payload.brandName || null,
    payload.primaryBrandInfo || null,
    payload.logoDataUrl || null,
    socialJson,
    onlineJson,
    verticalJson,
    nextStatus,
    userId,
  )

  return getIdentityByUser(userId)
}

router.get('/', (req, res) => {
  const row = getIdentityByUser(req.user.id)
  const identity = mapIdentity(row)
  const events = row ? listIdentityEvents(row.id) : []
  const products = listProductsForUser(req.user.id)
  res.json({
    identity,
    events,
    products,
    productsUnlocked: identityUnlocked(identity?.status),
  })
})

router.put('/', (req, res) => {
  const payload = payloadFromBody(req.body)
  const existing = getIdentityByUser(req.user.id)

  if (
    existing &&
    ['submitted', 'under_review', 'approved', 'completed'].includes(existing.status)
  ) {
    return res.status(400).json({
      error: 'This Digital Identity is under review or finalized and cannot be edited.',
    })
  }

  const row = upsertDraft(req.user.id, payload)
  res.json({ identity: mapIdentity(row) })
})

router.post('/submit', (req, res) => {
  const payload = payloadFromBody(req.body)
  const errors = validateIdentityForSubmit(payload)
  if (errors.length) {
    return res.status(400).json({ error: errors[0], errors })
  }

  const existing = getIdentityByUser(req.user.id)
  if (existing && ['submitted', 'under_review', 'approved', 'completed'].includes(existing.status)) {
    return res.status(400).json({
      error: 'This Digital Identity has already been submitted.',
    })
  }

  const previousStatus = existing?.status || 'draft'
  const row = upsertDraft(req.user.id, payload, { keepStatus: 'draft' })

  db.prepare(
    `UPDATE digital_identities
     SET status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  ).run(row.id)

  appendIdentityEvent({
    identityId: row.id,
    previousStatus,
    newStatus: 'submitted',
    changedBy: req.user.id,
    note: 'Customer submitted Digital Identity form',
  })

  const updated = getIdentityByUser(req.user.id)
  const identity = mapIdentity(updated)

  createNotification({
    userId: req.user.id,
    type: 'identity',
    title: 'Digital Identity submitted',
    body: 'Your Digital Identity information has been submitted successfully. Our team will review and validate the information. You will be notified once the Digital Identity is finalized.',
    meta: { referenceId: identity.referenceId, status: 'submitted' },
  })

  const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(req.user.id)
  const to = identity.email || user?.email
  if (to) {
    queueEmail({
      to,
      subject: `Digital Identity submission received (${identity.referenceId})`,
      body: [
        `Hi ${identity.contactPerson || user?.name || 'there'},`,
        '',
        'We have received your Digital Identity Kit submission.',
        '',
        `Reference ID: ${identity.referenceId}`,
        `Status: Submitted`,
        '',
        'What happens next:',
        '• Our team will manually review and validate your information.',
        '• You will be notified when your Digital Identity is approved or if we need more details.',
        '• Once finalized, you can start onboarding for Website, Digital Business Card, and Mobile Application.',
        '',
        'Thank you,',
        'IROAS Team',
      ].join('\n'),
      identityId: identity.id,
    })
  }

  res.json({
    identity,
    events: listIdentityEvents(identity.id),
    message:
      'Your Digital Identity information has been submitted successfully. Our team will review and validate the information. You will be notified once the Digital Identity is finalized.',
  })
})

export default router
