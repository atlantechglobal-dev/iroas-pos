import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { parseJson } from '../services/identityService.js'

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
    )
    .all(req.user.id)

  res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body || '',
      meta: parseJson(n.meta_json, {}),
      read: Boolean(n.read),
      createdAt: n.created_at,
    })),
  })
})

router.post('/mark-read', (req, res) => {
  const { ids } = req.body || {}
  if (Array.isArray(ids) && ids.length) {
    const placeholders = ids.map(() => '?').join(',')
    db.prepare(
      `UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
    ).run(req.user.id, ...ids)
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id)
  }
  res.json({ ok: true })
})

export default router
