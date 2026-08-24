import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import authRoutes from './routes/auth.js'
import restaurantRoutes from './routes/restaurant.js'
import adminRoutes from './routes/admin.js'

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env and set it.')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json({ limit: '5mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/restaurant', restaurantRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (req, res) => res.json({ ok: true }))

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
  res.status(500).json({ error: 'Something went wrong.' })
})

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`IROAS API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`)
})
