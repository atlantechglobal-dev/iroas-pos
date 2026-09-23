import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { db } from '../../infra/db.js'
import { signToken, requireAuth } from '../../middleware/auth.js'
import {
  isValidEmail,
  isValidMobile,
  isValidPassword,
  isValidPersonName,
  normalizeEmail,
  normalizeMobileDigits,
} from '../../shared/validation.js'
import {
  appendIdentityEvent,
  createNotification,
  mapIdentity,
  nextReferenceId,
  queueEmail,
  validateIdentityForSubmit,
} from '../../services/identityService.js'
import { isEmailConfigured, sendEmail } from '../../services/emailService.js'
import {
  getGoogleAuthSettings,
  getPublicGoogleAuthSettings,
  isGoogleAuthConfigured,
} from '../../services/googleAuthSettings.js'
import { listBusinessCategories } from '../../services/businessCategories.js'
import { sendSignupReviewEmails } from '../../services/onboardingMessaging.js'
import { OAuth2Client } from 'google-auth-library'

const router = Router()
const googleClient = new OAuth2Client()

function appBaseUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/$/, '')
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

function restaurantAwaitingAccountApproval(ownerId) {
  const restaurant = db
    .prepare('SELECT status, settings_json FROM restaurants WHERE owner_id = ?')
    .get(ownerId)
  if (!restaurant) return { blocked: false, deleted: false }
  if (restaurant.status === 'deleted') return { blocked: false, deleted: true }
  let awaiting = false
  try {
    awaiting = Boolean(JSON.parse(restaurant.settings_json || '{}').awaitingAccountApproval)
  } catch {
    awaiting = false
  }
  return { blocked: awaiting, deleted: false }
}

const ACCOUNT_NOT_APPROVED_MESSAGE =
  'Your account is not approved yet. Once an admin approves it, you will be able to sign in.'

async function verifyGoogleIdToken(idToken) {
  if (!isGoogleAuthConfigured()) {
    const err = new Error(
      'Google sign-in is not configured. Set Google Client ID in Platform Admin → Google sign-in, or GOOGLE_CLIENT_ID in server/.env.',
    )
    err.status = 503
    throw err
  }

  const { clientId } = getGoogleAuthSettings()
  let payload
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: clientId })
    payload = ticket.getPayload()
  } catch (err) {
    console.error('[auth] Google token verify failed:', err.message || err)
    const e = new Error('Invalid Google sign-in token.')
    e.status = 401
    throw e
  }

  const googleId = String(payload?.sub || '').trim()
  const email = normalizeEmail(payload?.email)
  const emailVerified = Boolean(payload?.email_verified)
  const name = String(payload?.name || email.split('@')[0] || 'Google user').trim()

  if (!googleId || !email || !emailVerified) {
    const e = new Error('Google account email is missing or not verified.')
    e.status = 401
    throw e
  }

  return { googleId, email, name }
}

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

router.post('/signup', async (req, res) => {
  const { name, restaurant, category, city, email, phone, password, identity, idToken } =
    req.body || {}

  let normalizedEmail = normalizeEmail(email)
  let finalName = String(name || '').trim()
  let googleId = null

  // Google-assisted signup: same business-detail fields as the regular form,
  // just no password — email/identity come from the verified Google token,
  // not from the client, so they can't be spoofed.
  if (idToken) {
    try {
      const google = await verifyGoogleIdToken(idToken)
      googleId = google.googleId
      normalizedEmail = google.email
      finalName = finalName || google.name
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message })
    }
  }

  const businessName =
    restaurant || identity?.businessName || identity?.brandName || ''
  const businessCategory = String(category || identity?.category || '').trim()
  const cityName = String(city || identity?.city || '').trim()

  if (!finalName || !businessName || !normalizedEmail || !phone || (!idToken && !password)) {
    return res.status(400).json({ error: 'All fields are required.' })
  }

  if (!isValidPersonName(finalName)) {
    return res.status(400).json({ error: 'Enter a valid name using letters only.' })
  }

  if (!cityName) {
    return res.status(400).json({ error: 'City is required.' })
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }

  const mobileDigits = normalizeMobileDigits(phone)
  if (!isValidMobile(mobileDigits)) {
    return res.status(400).json({ error: 'Enter a valid mobile number with country code.' })
  }

  if (!idToken && !isValidPassword(password)) {
    return res.status(400).json({ error: 'Use at least 8 characters, including uppercase, lowercase, and a number.' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' })
  }

  if (googleId) {
    const linkedElsewhere = db.prepare('SELECT id FROM users WHERE google_id = ?').get(googleId)
    if (linkedElsewhere) {
      return res
        .status(409)
        .json({ error: 'This Google account is already linked to another IROAS account.' })
    }
  }

  try {
    const passwordHash = idToken
      ? bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10)
      : bcrypt.hashSync(password, 10)

    const insertUser = db.prepare(
      'INSERT INTO users (name, email, phone, password_hash, google_id, role) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertRestaurant = db.prepare(
      `INSERT INTO restaurants (owner_id, name, city, email, status, submitted_at, settings_json)
       VALUES (?, ?, ?, ?, 'pending_approval', datetime('now'), ?)`,
    )

    const settingsPayload = {
      awaitingAccountApproval: true,
      ...(businessCategory ? { businessCategory } : {}),
    }

    // Everything below — including the optional Digital Identity submission —
    // runs in one transaction so a validation failure there doesn't leave a
    // signed-up user with no way to retry (email already taken, no token issued).
    const { user, submittedIdentity, restaurant } = db.transaction(() => {
      const userInfo = insertUser.run(
        finalName,
        normalizedEmail,
        mobileDigits,
        passwordHash,
        googleId,
        'owner',
      )
      const restaurantInfo = insertRestaurant.run(
        userInfo.lastInsertRowid,
        String(businessName).trim(),
        cityName,
        normalizedEmail,
        JSON.stringify(settingsPayload),
      )

      const createdUser = db
        .prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?')
        .get(userInfo.lastInsertRowid)

      const createdRestaurant = db
        .prepare('SELECT * FROM restaurants WHERE id = ?')
        .get(restaurantInfo.lastInsertRowid)

      let identityResult = null
      if (identity) {
        const payload = {
          ...identity,
          businessName: identity.businessName || businessName,
          contactPerson: identity.contactPerson || finalName,
          email: identity.email || normalizedEmail,
          phone: identity.phone || mobileDigits,
          city: identity.city || cityName,
        }
        identityResult = createSubmittedIdentity(createdUser.id, createdUser, payload)
      }

      return {
        user: createdUser,
        submittedIdentity: identityResult,
        restaurant: createdRestaurant,
      }
    })()

    let emails = null
    try {
      emails = await sendSignupReviewEmails({
        restaurant,
        owner: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || mobileDigits,
        },
      })
    } catch (err) {
      console.error('[signup] review emails failed:', err.message || err)
    }

    res.status(201).json({
      pendingReview: true,
      email: normalizedEmail,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      identity: submittedIdentity,
      emails,
      message:
        'Thank you — your account is in review for approval. We will email you once an admin approves it.',
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
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail)

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  if (user.role !== 'admin') {
    const gate = restaurantAwaitingAccountApproval(user.id)
    if (gate.deleted) {
      return res.status(403).json({ error: 'This account has been closed. Contact IROAS support.' })
    }
    if (gate.blocked) {
      return res.status(403).json({
        error: ACCOUNT_NOT_APPROVED_MESSAGE,
        code: 'ACCOUNT_PENDING_APPROVAL',
      })
    }
  }

  res.json({
    token: signToken(user),
    user: publicUser(user),
  })
})

router.get('/google/config', (_req, res) => {
  res.json(getPublicGoogleAuthSettings())
})

router.get('/business-categories', (_req, res) => {
  res.json({ categories: listBusinessCategories() })
})

router.post('/google', async (req, res) => {
  const idToken = String(req.body?.idToken || req.body?.credential || '').trim()
  if (!idToken) {
    return res.status(400).json({ error: 'Google ID token is required.' })
  }

  let google
  try {
    google = await verifyGoogleIdToken(idToken)
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message })
  }
  const { googleId, email, name } = google

  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId)

  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email)
    if (user) {
      if (user.google_id && user.google_id !== googleId) {
        return res.status(409).json({
          error: 'This email is already linked to a different Google account.',
        })
      }
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id)
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    }
  }

  if (!user) {
    // No account yet — hand the verified identity back so the client can
    // collect the same business details (restaurant, category, city, phone)
    // the signup form asks for, via POST /signup with this same idToken.
    return res.json({ needsSignup: true, idToken, name, email })
  }

  if (user.role !== 'admin') {
    const gate = restaurantAwaitingAccountApproval(user.id)
    if (gate.deleted) {
      return res.status(403).json({ error: 'This account has been closed. Contact IROAS support.' })
    }
    if (gate.blocked) {
      return res.status(403).json({
        error: ACCOUNT_NOT_APPROVED_MESSAGE,
        code: 'ACCOUNT_PENDING_APPROVAL',
      })
    }
  }

  res.json({
    token: signToken(user),
    user: publicUser(user),
  })
})

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(req.user.id)

  if (!user) return res.status(404).json({ error: 'User not found.' })

  res.json({ user })
})

// Password reset: creates a 30-minute token and emails a link.
// Always returns { ok: true } so callers cannot probe which emails exist.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {}
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Email is required.' })
  }

  const user = db
    .prepare('SELECT id, name, email FROM users WHERE lower(email) = ?')
    .get(normalizedEmail)

  // Always respond success to avoid leaking which emails are registered.
  if (!user) {
    return res.json({ ok: true })
  }

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const resetUrl = `${appBaseUrl()}/new-password?token=${encodeURIComponent(token)}`

  db.transaction(() => {
    db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(user.id)
    db.prepare(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
    ).run(user.id, token, expiresAt)
  })()

  const subject = 'Reset your IROAS password'
  const body = [
    `Hi ${user.name || 'there'},`,
    '',
    'We received a request to reset your IROAS password.',
    'Open this link to choose a new password (expires in 30 minutes):',
    '',
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
    '',
    '— Team IROAS',
  ].join('\n')

  const html = `
    <div style="font-family:Plus Jakarta Sans,Segoe UI,sans-serif;color:#17171a;line-height:1.5;max-width:560px;margin:0 auto;">
      <h1 style="font-size:22px;margin:0 0 12px;">Reset your password</h1>
      <p>Hi ${String(user.name || 'there').replace(/</g, '')},</p>
      <p>We received a request to reset your IROAS password. This link expires in <strong>30 minutes</strong>.</p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#8bc53f;color:#16210a;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:999px;">
          Choose a new password
        </a>
      </p>
      <p style="color:#6b6b73;font-size:13px;word-break:break-all;">Or paste this link:<br/>${resetUrl}</p>
      <p style="color:#6b6b73;font-size:13px;">If you did not request this, you can ignore this email.</p>
      <p>— Team IROAS</p>
    </div>
  `

  let previewUrl = null
  try {
    if (!isEmailConfigured()) {
      console.warn(
        '[auth] Password reset token created but email is not configured. Set ZeptoMail/SMTP or use Ethereal in development.',
      )
    } else {
      const result = await sendEmail({
        to: user.email,
        toName: user.name || undefined,
        subject,
        body,
        html,
      })
      previewUrl = result?.previewUrl || null
      if (previewUrl) {
        console.log(`[auth] Password reset preview: ${previewUrl}`)
      }
    }
  } catch (err) {
    console.error('[auth] Password reset email failed:', err.message || err)
  }

  const payload = { ok: true }
  if (previewUrl) payload.previewUrl = previewUrl
  return res.json(payload)
})

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body || {}

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' })
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      error: 'Use at least 8 characters, including uppercase, lowercase, and a number.',
    })
  }

  const reset = db
    .prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0')
    .get(String(token).trim())

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
    db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(
      reset.user_id,
    )
  })()

  res.json({ ok: true })
})

export default router
