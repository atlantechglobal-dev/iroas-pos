import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import authRoutes from './routes/auth.js'
import restaurantRoutes from './routes/restaurant.js'
import adminRoutes from './routes/admin.js'
import menuRoutes from './routes/menu.js'
import publicRoutes from './routes/public.js'

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env and set it.')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json({ limit: '12mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/restaurant', restaurantRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/public', publicRoutes)

app.get('/api/health', (req, res) => res.json({ ok: true }))

// Old One Link hub URLs → guest website (works for QR scans without JS)
app.get('/l/:slug', (req, res) => {
  const slug = String(req.params.slug || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-|-$/g, '')
  if (!slug) return res.redirect(301, '/')
  return res.redirect(301, `/s/${slug}`)
})

// In production, serve the built frontend from the same process so a single
// droplet / single PM2 process handles both the API and the static site.
const distDir = path.join(__dirname, '..', '..', 'dist')

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir))

  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  console.error(err)
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      error: 'That image is too large. Please use a file under 2 MB.',
    })
  }
  res.status(500).json({ error: 'Something went wrong.' })
})

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`IROAS API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`)
})
