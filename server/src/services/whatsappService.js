import { db } from '../infra/db.js'
import { maskToken } from './emailService.js'

const WHATSAPP_KEY = 'whatsapp'
const GRAPH_API_VERSION = 'v20.0'

// Meta's Cloud API only sends pre-approved templates (Meta Business Manager) —
// there's no free-text body like email, so settings store a template name +
// language per message type instead of editable subject/body.
const DEFAULT_FEATURES = {
  bookingConfirmation: false,
  orderConfirmation: false,
}

const DEFAULT_MESSAGE_TEMPLATES = {
  bookingConfirmation: { templateName: '', languageCode: 'en' },
  orderConfirmation: { templateName: '', languageCode: 'en' },
}

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function envDefaults() {
  return {
    phoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    accessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    businessAccountId: String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim(),
  }
}

function mergeMessageTemplates(stored = {}) {
  const out = {}
  for (const [key, fallback] of Object.entries(DEFAULT_MESSAGE_TEMPLATES)) {
    const src = stored[key] && typeof stored[key] === 'object' ? stored[key] : {}
    out[key] = {
      templateName: String(src.templateName ?? '').trim(),
      languageCode: String(src.languageCode ?? fallback.languageCode).trim() || fallback.languageCode,
    }
  }
  return out
}

/** Load platform WhatsApp settings (DB overrides .env). */
export function getWhatsAppSettings() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(WHATSAPP_KEY)
  const stored = parseJson(row?.value_json, {})
  const env = envDefaults()

  return {
    phoneNumberId: String(stored.phoneNumberId || env.phoneNumberId || '').trim(),
    accessToken: String(stored.accessToken || env.accessToken || '').trim(),
    businessAccountId: String(stored.businessAccountId || env.businessAccountId || '').trim(),
    features: {
      ...DEFAULT_FEATURES,
      ...(stored.features && typeof stored.features === 'object' ? stored.features : {}),
    },
    templates: mergeMessageTemplates(stored.templates),
  }
}

export function isWhatsAppConfigured() {
  const s = getWhatsAppSettings()
  return Boolean(s.phoneNumberId && s.accessToken)
}

export function getPublicWhatsAppSettings() {
  const s = getWhatsAppSettings()
  return {
    phoneNumberId: s.phoneNumberId,
    businessAccountId: s.businessAccountId,
    configured: isWhatsAppConfigured(),
    accessTokenSet: Boolean(s.accessToken),
    accessTokenMasked: s.accessToken ? maskToken(s.accessToken) : '',
    features: s.features,
    templates: s.templates,
  }
}

export function saveWhatsAppSettings(payload = {}) {
  const current = getWhatsAppSettings()
  const nextToken = String(payload.accessToken ?? '').trim()
  const featuresIn = payload.features && typeof payload.features === 'object' ? payload.features : {}
  const templatesIn =
    payload.templates && typeof payload.templates === 'object' ? payload.templates : null

  const next = {
    phoneNumberId: String(payload.phoneNumberId ?? current.phoneNumberId).trim(),
    accessToken: nextToken || current.accessToken,
    businessAccountId: String(payload.businessAccountId ?? current.businessAccountId).trim(),
    features: {
      bookingConfirmation:
        featuresIn.bookingConfirmation !== undefined
          ? Boolean(featuresIn.bookingConfirmation)
          : current.features.bookingConfirmation,
      orderConfirmation:
        featuresIn.orderConfirmation !== undefined
          ? Boolean(featuresIn.orderConfirmation)
          : current.features.orderConfirmation,
    },
    templates: templatesIn
      ? mergeMessageTemplates({ ...current.templates, ...templatesIn })
      : current.templates,
  }

  if (!next.phoneNumberId) {
    throw Object.assign(new Error('WhatsApp phone number ID is required.'), { status: 400 })
  }

  db.prepare(
    `INSERT INTO platform_settings (key, value_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = datetime('now')`,
  ).run(WHATSAPP_KEY, JSON.stringify(next))

  return getPublicWhatsAppSettings()
}

function normalizeRecipient(to) {
  // Meta expects digits only (country code + number), no leading +, spaces or dashes.
  return String(to || '').replace(/[^\d]/g, '')
}

/**
 * Send a pre-approved WhatsApp template message via the Meta Cloud API.
 * `params` are plain strings substituted into the template's body {{1}}, {{2}}, ... placeholders.
 */
export async function sendWhatsAppMessage(to, templateName, { languageCode = 'en', params = [] } = {}) {
  const cfg = getWhatsAppSettings()
  if (!isWhatsAppConfigured()) {
    throw Object.assign(new Error('WhatsApp is not configured.'), { status: 503 })
  }
  const recipient = normalizeRecipient(to)
  if (!recipient) throw new Error('Recipient phone number is required.')
  if (!templateName) throw new Error('WhatsApp template name is required.')

  const body = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(params.length
        ? { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text) })) }] }
        : {}),
    },
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = { raw }
  }

  if (!res.ok) {
    const msg = data?.error?.message || data?.raw || `WhatsApp API HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return data
}

/** Send the configured template for a message type if enabled, swallowing failures (best-effort, like a notification). */
export async function sendWhatsAppForMessageType(messageType, to, params = []) {
  const cfg = getWhatsAppSettings()
  if (!cfg.features[messageType]) return { skipped: true, reason: 'disabled' }
  if (!isWhatsAppConfigured()) return { skipped: true, reason: 'not_configured' }
  const tpl = cfg.templates[messageType]
  if (!tpl?.templateName) return { skipped: true, reason: 'no_template' }
  try {
    const data = await sendWhatsAppMessage(to, tpl.templateName, { languageCode: tpl.languageCode, params })
    return { skipped: false, data }
  } catch (err) {
    console.warn(`[whatsapp] ${messageType} send failed:`, err.message || err)
    return { skipped: true, reason: 'send_failed', error: err.message || String(err) }
  }
}
