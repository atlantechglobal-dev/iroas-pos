import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/stats', (req, res) => {
  const activeTenants = db
    .prepare("SELECT COUNT(*) AS n FROM restaurants WHERE status = 'live'")
    .get().n

  const totalTenants = db.prepare('SELECT COUNT(*) AS n FROM restaurants').get().n

  res.json({
    activeTenants,
    totalTenants,
    onboardingTenants: totalTenants - activeTenants,
  })
})

router.get('/tenants', (req, res) => {
  const search = (req.query.search || '').toLowerCase()

  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.city, r.country, r.plan, r.status, r.launched_at,
              r.created_at, u.name AS owner_name, u.email AS owner_email
       FROM restaurants r
       JOIN users u ON u.id = r.owner_id
       ORDER BY r.created_at DESC`,
    )
    .all()

  const filtered = search
    ? rows.filter((r) =>
        `${r.name} ${r.city} ${r.owner_name}`.toLowerCase().includes(search),
      )
    : rows

  res.json({ tenants: filtered, total: rows.length })
})

router.patch('/tenants/:id/status', (req, res) => {
  const { status } = req.body || {}

  if (!['onboarding', 'live'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' })
  }

  db.prepare("UPDATE restaurants SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    req.params.id,
  )

  res.json({ ok: true })
})

export default router
