import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { signToken, requireAuth } from '../middleware/auth.js'
import { isValidMobile, isValidSignupName, normalizeMobileDigits } from '../utils/validation.js'
import {
  appendIdentityEvent,
  createNotification,
  mapIdentity,
  nextReferenceId,
  queueEmail,
  validateIdentityForSubmit,
} from '../services/identityService.js'

const router = Router()

function createSubmittedIdentity(userId, user, identityPayload) {
  if (!identityPayload || typeof identityPayload !== 'object') return null

  const errors = validateIdentityForSubmit(identityPayload)
  if (errors.length) {
    const err = new Error(errors[0])
    err.status = 400
    err.errors = errors
    throw err
  }

  const referenceId = nextReferenceId()
  const socialJson = JSON.stringify(identityPayload.social || {})
  const onlineJson = JSON.stringify(identityPayload.onlinePresence || {})
  const verticalJson = JSON.stringify(identityPayload.verticalFields || {})

  const info = db
    .prepare(
      `INSERT INTO digital_identities (
        user_id, reference_id, status,
        business_name, category, category_other, business_type, description,
        year_established, contact_person, phone, email, website,
        address, city, state, country, postal_code,
        brand_name, primary_brand_info, logo_data_url,
        social_json, online_presence_json, vertical_fields_json,
        submitted_at
      ) VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      userId,
      referenceId,
      identityPayload.businessName || null,
      identityPayload.category || null,
      identityPayload.categoryOther || null,
      identityPayload.businessType || null,
      identityPayload.description || null,
      identityPayload.yearEstablished || null,
      identityPayload.contactPerson || null,
      identityPayload.phone || null,
      identityPayload.email || null,
      identityPayload.website || null,
      identityPayload.address || null,
      identityPayload.city || null,
      identityPayload.state || null,
      identityPayload.country || null,
      identityPayload.postalCode || null,
      identityPayload.brandName || null,
      identityPayload.primaryBrandInfo || null,
      identityPayload.logoDataUrl || null,
      socialJson,
      onlineJson,
      verticalJson,
    )

  appendIdentityEvent({
    identityId: info.lastInsertRowid,
    previousStatus: null,
    newStatus: 'submitted',
    changedBy: userId,
    note: 'Submitted during registration',
  })

  const identity = mapIdentity(
    db.prepare('SELECT * FROM digital_identities WHERE id = ?').get(info.lastInsertRowid),
  )

  createNotification({
    userId,
    type: 'identity',
    title: 'Digital Identity submitted',
    body: 'Your Digital Identity information has been submitted successfully. Our team will review and validate the information. You will be notified once the Digital Identity is finalized.',
    meta: { referenceId: identity.referenceId, status: 'submitted' },
  })

  const to = identity.email || user.email
  if (to) {
    queueEmail({
      to,
      subject: `Digital Identity submission received (${identity.referenceId})`,
      body: [
        `Hi ${identity.contactPerson || user.name || 'there'},`,
        '',
        'Welcome to IROAS. We have received your Digital Identity Kit submission during registration.',
        '',
        `Reference ID: ${identity.referenceId}`,
        'Status: Submitted',
        '',
        'What happens next:',
        '• Our team will manually review and validate your information.',
        '• You will be notified when your Digital Identity is approved or if we need more details.',
        '• Once finalized, you can start Website, Digital Business Card, and Mobile Application onboarding.',
        '',
        'Thank you,',
        'IROAS Team',
      ].join('\n'),
      identityId: identity.id,
    })
  }

  return identity
}

router.post('/signup', (req, res) => {
  const { name, restaurant, category, email, phone, password, identity } = req.body || {}

  const businessName =
    restaurant || identity?.businessName || identity?.brandName || ''
  const businessCategory = String(category || identity?.category || '').trim()

  if (!name || !businessName || !email || !phone || !password) {
    return res.status(400).json({ error: 'All fields are required.' })
  }

  if (!isValidSignupName(name)) {
    return res.status(400).json({ error: 'Enter a valid first and last name using letters only.' })
  }

  const mobileDigits = normalizeMobileDigits(phone)
  if (!isValidMobile(mobileDigits)) {
    return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' })
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10)

    const insertUser = db.prepare(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    )
    const insertRestaurant = db.prepare(
      'INSERT INTO restaurants (owner_id, name, settings_json) VALUES (?, ?, ?)',
    )

    const settingsJson = businessCategory
      ? JSON.stringify({ businessCategory })
      : null

    const result = db.transaction(() => {
      const userInfo = insertUser.run(name.trim(), email, mobileDigits, passwordHash, 'owner')
      insertRestaurant.run(
        userInfo.lastInsertRowid,
        String(businessName).trim(),
        settingsJson,
      )
      return userInfo.lastInsertRowid
    })()

    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result)

    let submittedIdentity = null
    if (identity) {
      const payload = {
        ...identity,
        businessName: identity.businessName || businessName,
        contactPerson: identity.contactPerson || name.trim(),
        email: identity.email || email,
        phone: identity.phone || mobileDigits,
      }
      submittedIdentity = createSubmittedIdentity(user.id, user, payload)
    }

    res.status(201).json({
      token: signToken(user),
      user,
      identity: submittedIdentity,
      message: submittedIdentity
        ? 'Your Digital Identity information has been submitted successfully. Our team will review and validate the information. You will be notified once the Digital Identity is finalized.'
        : undefined,
    })
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message, errors: err.errors })
    }
    console.error(err)
    return res.status(500).json({ error: 'Unable to create account.' })
  }
})

router.post('/login', (req, res) => {
  const { email, password } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  if (user.role !== 'admin') {
    const restaurant = db.prepare('SELECT status FROM restaurants WHERE owner_id = ?').get(user.id)
    if (restaurant?.status === 'deleted') {
      return res.status(403).json({ error: 'This account has been closed. Contact IROAS support.' })
    }
  }

  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
})

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(req.user.id)

  if (!user) return res.status(404).json({ error: 'User not found.' })

  res.json({ user })
})

// Demo-mode password reset: no real email is sent. The reset link/token is
// returned directly in the API response so the flow is fully testable
// without an email provider configured.
router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {}

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' })
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)

  // Always respond success to avoid leaking which emails are registered.
  if (!user) {
    return res.json({ ok: true })
  }

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  db.prepare(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
  ).run(user.id, token, expiresAt)

  res.json({ ok: true, resetToken: token })
})

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body || {}

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' })
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({
      error: 'Password must be 8+ characters with an uppercase letter and a number.',
    })
  }

  const reset = db
    .prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0')
    .get(token)

  if (!reset || new Date(reset.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
  }

  const passwordHash = bcrypt.hashSync(password, 10)

  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      passwordHash,
      reset.user_id,
    )
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id)
  })()

  res.json({ ok: true })
})

export default router
