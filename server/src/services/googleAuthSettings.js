import { db } from '../infra/db.js'

const GOOGLE_AUTH_KEY = 'google_auth'

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function envDefaults() {
  const enabledRaw = String(process.env.GOOGLE_AUTH_ENABLED || 'true').trim().toLowerCase()
  return {
    clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
    enabled: enabledRaw !== 'false' && enabledRaw !== '0',
  }
}

export function getGoogleAuthSettings() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(GOOGLE_AUTH_KEY)
  const stored = parseJson(row?.value_json, {})
  const env = envDefaults()

  return {
    clientId: String(stored.clientId || env.clientId || '').trim(),
    enabled:
      stored.enabled !== undefined ? Boolean(stored.enabled) : env.enabled,
  }
}

export function isGoogleAuthConfigured() {
  const s = getGoogleAuthSettings()
  return Boolean(s.enabled && s.clientId)
}

export function getPublicGoogleAuthSettings() {
  const s = getGoogleAuthSettings()
  const configured = Boolean(s.enabled && s.clientId)
  return {
    clientId: s.clientId,
    enabled: Boolean(s.enabled),
    configured,
  }
}

export function saveGoogleAuthSettings(payload = {}) {
  const current = getGoogleAuthSettings()
  const next = {
    clientId: String(payload.clientId ?? current.clientId).trim(),
    enabled:
      payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled,
  }

  if (next.enabled && !next.clientId) {
    throw Object.assign(new Error('Google Client ID is required when Google sign-in is enabled.'), {
      status: 400,
    })
  }

  db.prepare(
    `INSERT INTO platform_settings (key, value_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = datetime('now')`,
  ).run(GOOGLE_AUTH_KEY, JSON.stringify(next))

  return getPublicGoogleAuthSettings()
}

export function ensureGoogleAuthSettingsBootstrapped() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(GOOGLE_AUTH_KEY)
  if (row?.value_json) return getPublicGoogleAuthSettings()
  const env = envDefaults()
  if (!env.clientId) return getPublicGoogleAuthSettings()
  try {
    return saveGoogleAuthSettings(env)
  } catch {
    return getPublicGoogleAuthSettings()
  }
}
