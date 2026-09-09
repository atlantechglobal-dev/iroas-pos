import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  appendProductEvent,
  buildPrefillFromIdentity,
  createNotification,
  getIdentityByUser,
  identityUnlocked,
  listProductEvents,
  listProductsForUser,
  mapProduct,
  PRODUCT_TYPES,
  queueEmail,
} from '../services/identityService.js'

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const identity = getIdentityByUser(req.user.id)
  res.json({
    products: listProductsForUser(req.user.id),
    productsUnlocked: identityUnlocked(identity?.status),
  })
})

router.get('/:type', (req, res) => {
  const type = req.params.type
  if (!PRODUCT_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid product type.' })
  }

  const row = db
    .prepare('SELECT * FROM product_requests WHERE user_id = ? AND product_type = ?')
    .get(req.user.id, type)

  res.json({
    product: mapProduct(row),
    events: row ? listProductEvents(row.id) : [],
    prefill: buildPrefillFromIdentity(getIdentityByUser(req.user.id)),
  })
})

router.post('/:type', (req, res) => {
  const type = req.params.type
  if (!PRODUCT_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid product type.' })
  }

  const identity = getIdentityByUser(req.user.id)
  if (!identity || !identityUnlocked(identity.status)) {
    return res.status(400).json({
      error: 'Your Digital Identity must be approved before requesting this product.',
    })
  }

  const existing = db
    .prepare('SELECT * FROM product_requests WHERE user_id = ? AND product_type = ?')
    .get(req.user.id, type)

  if (existing && !['not_started', 'rejected'].includes(existing.status)) {
    return res.status(400).json({
      error: 'A request for this product already exists.',
      product: mapProduct(existing),
    })
  }

  const prefill = buildPrefillFromIdentity(identity)
  const extras = req.body?.extras || {}
  const payload = { ...prefill, extras }

  const initialStatus =
    type === 'mobile_app' ? 'requirements_submitted' : 'requested'

  let productId
  if (existing) {
    db.prepare(
      `UPDATE product_requests
       SET status = ?, payload_json = ?, submitted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
    ).run(initialStatus, JSON.stringify(payload), existing.id)
    productId = existing.id
    appendProductEvent({
      productId,
      previousStatus: existing.status,
      newStatus: initialStatus,
      changedBy: req.user.id,
      note: 'Customer re-submitted product request',
    })
  } else {
    const info = db
      .prepare(
        `INSERT INTO product_requests
          (identity_id, user_id, product_type, status, payload_json, submitted_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(identity.id, req.user.id, type, initialStatus, JSON.stringify(payload))
    productId = info.lastInsertRowid
    appendProductEvent({
      productId,
      previousStatus: 'not_started',
      newStatus: initialStatus,
      changedBy: req.user.id,
      note: 'Customer submitted product request',
    })
  }

  const labels = {
    website: 'Website',
    digital_business_card: 'Digital Business Card',
    mobile_app: 'Mobile Application',
  }

  createNotification({
    userId: req.user.id,
    type: 'product',
    title: `${labels[type]} request submitted`,
    body: `Your ${labels[type]} request has been received and is awaiting internal review.`,
    meta: { productType: type, status: initialStatus },
  })

  const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(req.user.id)
  if (user?.email) {
    queueEmail({
      to: user.email,
      subject: `${labels[type]} request received`,
      body: [
        `Hi ${user.name || 'there'},`,
        '',
        `We received your ${labels[type]} onboarding request.`,
        `Status: ${initialStatus.replace(/_/g, ' ')}`,
        '',
        'Our team will review the requirements and update you as the request progresses.',
        '',
        'IROAS Team',
      ].join('\n'),
      identityId: identity.id,
      productId,
    })
  }

  const product = mapProduct(db.prepare('SELECT * FROM product_requests WHERE id = ?').get(productId))
  res.status(201).json({ product, events: listProductEvents(productId) })
})

router.patch('/:type', (req, res) => {
  const type = req.params.type
  if (!PRODUCT_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid product type.' })
  }

  const row = db
    .prepare('SELECT * FROM product_requests WHERE user_id = ? AND product_type = ?')
    .get(req.user.id, type)

  if (!row) return res.status(404).json({ error: 'Product request not found.' })

  // Customers can only update payload extras while early in the flow
  if (!['not_started', 'requested', 'requirements_submitted'].includes(row.status)) {
    return res.status(400).json({ error: 'This request can no longer be edited.' })
  }

  const currentPayload = row.payload_json ? JSON.parse(row.payload_json) : {}
  const nextPayload = {
    ...currentPayload,
    extras: { ...(currentPayload.extras || {}), ...(req.body?.extras || {}) },
  }

  db.prepare(
    `UPDATE product_requests SET payload_json = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(nextPayload), row.id)

  res.json({ product: mapProduct(db.prepare('SELECT * FROM product_requests WHERE id = ?').get(row.id)) })
})

export default router
