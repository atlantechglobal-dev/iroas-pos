/**
 * Simple in-memory sliding-window rate limiter for sensitive auth routes.
 */
export function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 40,
  message = 'Too many requests. Please try again later.',
} = {}) {
  const hits = new Map()

  function keyFor(req) {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown'
    return `${ip}:${req.path}`
  }

  // Opportunistic cleanup
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits) {
      if (now - entry.start > windowMs) hits.delete(key)
    }
  }, windowMs).unref?.()

  return function rateLimitMiddleware(req, res, next) {
    const key = keyFor(req)
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 }
      hits.set(key, entry)
    }
    entry.count += 1
    res.setHeader('X-RateLimit-Limit', String(max))
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    if (entry.count > max) {
      return res.status(429).json({ error: message })
    }
    return next()
  }
}
