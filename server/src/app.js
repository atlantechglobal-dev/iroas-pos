import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { corsMiddleware } from './config/cors.js'
import { isProd } from './config/env.js'
import { securityHeaders } from './middleware/securityHeaders.js'
import { rateLimit } from './middleware/rateLimit.js'
import { errorHandler } from './middleware/errorHandler.js'

import authRoutes from './modules/auth/routes.js'
import tenantRoutes from './modules/tenants/routes.js'
import adminRoutes from './modules/admin/routes.js'
import menuRoutes from './modules/menu/routes.js'
import publicRoutes from './modules/public/routes.js'
import identityRoutes from './modules/identity/routes.js'
import productRoutes from './modules/identity/productRoutes.js'
import notificationRoutes from './modules/notifications/routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function jsonBodyParser(req, res, next) {
  const url = req.originalUrl || req.url || ''
  const largePayload = /^\/api\/(restaurant|admin|identity|products)(\/|$|\?)/.test(url)
  return express.json({ limit: largePayload ? '12mb' : '1mb' })(req, res, next)
}

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(securityHeaders)
  app.use(corsMiddleware())
  app.use(jsonBodyParser)

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: 'Too many sign-in attempts. Please wait and try again.',
  })
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/signup', authLimiter)
  app.use('/api/auth/forgot-password', authLimiter)
  app.use('/api/auth/google', authLimiter)

  app.use('/api/auth', authRoutes)
  app.use('/api/restaurant', tenantRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/menu', menuRoutes)
  app.use('/api/public', publicRoutes)
  app.use('/api/identity', identityRoutes)
  app.use('/api/products', productRoutes)
  app.use('/api/notifications', notificationRoutes)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.get('/l/:slug', (req, res) => {
    const slug = String(req.params.slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-|-$/g, '')
    if (!slug) return res.redirect(301, '/')
    return res.redirect(301, `/s/${slug}`)
  })

  const distDir = path.join(__dirname, '..', '..', 'dist')
  if (isProd()) {
    app.use(express.static(distDir))
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.use(errorHandler)
  return app
}
