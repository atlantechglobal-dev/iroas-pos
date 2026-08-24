import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { signToken, requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/signup', (req, res) => {
  const { name, restaurant, email, phone, password } = req.body || {}

  if (!name || !restaurant || !email || !phone || !password) {
    return res.status(400).json({ error: 'All fields are required.' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' })
  }

  const passwordHash = bcrypt.hashSync(password, 10)

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  )
  const insertRestaurant = db.prepare(
    'INSERT INTO restaurants (owner_id, name) VALUES (?, ?)',
  )

  const result = db.transaction(() => {
    const userInfo = insertUser.run(name, email, phone, passwordHash, 'owner')
    insertRestaurant.run(userInfo.lastInsertRowid, restaurant)
    return userInfo.lastInsertRowid
  })()

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result)

  res.status(201).json({ token: signToken(user), user })
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
