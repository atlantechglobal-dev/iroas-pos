import cors from 'cors'
import { appOriginAllowlist, isProd } from './env.js'

export function corsMiddleware() {
  const allowlist = appOriginAllowlist()

  return cors({
    origin(origin, callback) {
      // Allow non-browser / same-origin tools (no Origin header)
      if (!origin) return callback(null, true)
      const normalized = String(origin).replace(/\/$/, '')
      if (allowlist.includes(normalized)) return callback(null, true)
      if (!isProd() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true,
  })
}
