/**
 * Environment helpers for the API.
 */
export function getEnv(name, fallback = '') {
  const value = process.env[name]
  return value == null || value === '' ? fallback : String(value)
}

export function requireEnv(name) {
  const value = getEnv(name)
  if (!value) {
    throw new Error(`${name} is not set. Copy server/.env.example to server/.env and set it.`)
  }
  return value
}

export const isProd = () => getEnv('NODE_ENV') === 'production'
export const port = () => Number(getEnv('PORT', '4000')) || 4000

export function appOriginAllowlist() {
  const primary = getEnv('PUBLIC_APP_URL') || getEnv('APP_URL') || 'http://localhost:5173'
  const extra = getEnv('CORS_ORIGINS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const list = [primary, ...extra, 'http://localhost:5173', 'http://127.0.0.1:5173']
  return [...new Set(list.map((u) => u.replace(/\/$/, '')))]
}
