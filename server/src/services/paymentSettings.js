import { db } from '../db.js'
import { maskToken } from './emailService.js'

const PAYMENT_KEY = 'addpay'

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function envDefaults() {
  return {
    appId: String(process.env.ADDPAY_APP_ID || '').trim(),
    merchantNo: String(process.env.ADDPAY_MERCHANT_NO || '').trim(),
    storeNo: String(process.env.ADDPAY_STORE_NO || '').trim(),
    privateKey: String(process.env.ADDPAY_PRIVATE_KEY || '').trim(),
    gatewayPublicKey: String(process.env.ADDPAY_GATEWAY_PUBLIC_KEY || '').trim(),
    useSandbox: String(process.env.ADDPAY_SANDBOX || 'true').trim().toLowerCase() !== 'false',
  }
}

/** Load AddPay settings (DB overrides .env). */
export function getPaymentSettings() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(PAYMENT_KEY)
  const stored = parseJson(row?.value_json, {})
  const env = envDefaults()

  return {
    appId: String(stored.appId || env.appId || '').trim(),
    merchantNo: String(stored.merchantNo || env.merchantNo || '').trim(),
    storeNo: String(stored.storeNo || env.storeNo || '').trim(),
    privateKey: String(stored.privateKey || env.privateKey || '').trim(),
    gatewayPublicKey: String(stored.gatewayPublicKey || env.gatewayPublicKey || '').trim(),
    useSandbox: stored.useSandbox !== undefined ? Boolean(stored.useSandbox) : env.useSandbox,
  }
}

export function isPaymentConfigured() {
  const s = getPaymentSettings()
  return Boolean(s.appId && s.merchantNo && s.storeNo && s.privateKey && s.gatewayPublicKey)
}

export function getPublicPaymentSettings() {
  const s = getPaymentSettings()
  return {
    appId: s.appId,
    merchantNo: s.merchantNo,
    storeNo: s.storeNo,
    useSandbox: s.useSandbox,
    configured: isPaymentConfigured(),
    privateKeySet: Boolean(s.privateKey),
    privateKeyMasked: s.privateKey ? maskToken(s.privateKey) : '',
    gatewayPublicKeySet: Boolean(s.gatewayPublicKey),
    gatewayPublicKeyMasked: s.gatewayPublicKey ? maskToken(s.gatewayPublicKey) : '',
  }
}

export function savePaymentSettings(payload = {}) {
  const current = getPaymentSettings()

  const next = {
    appId: String(payload.appId ?? current.appId).trim(),
    merchantNo: String(payload.merchantNo ?? current.merchantNo).trim(),
    storeNo: String(payload.storeNo ?? current.storeNo).trim(),
    // Blank secret in the payload keeps the currently stored one.
    privateKey: String(payload.privateKey ?? '').trim() || current.privateKey,
    gatewayPublicKey: String(payload.gatewayPublicKey ?? '').trim() || current.gatewayPublicKey,
    useSandbox: payload.useSandbox !== undefined ? Boolean(payload.useSandbox) : current.useSandbox,
  }

  if (!next.appId || !next.merchantNo || !next.storeNo) {
    throw Object.assign(new Error('App ID, Merchant No, and Store No are required.'), { status: 400 })
  }

  db.prepare(
    `INSERT INTO platform_settings (key, value_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = datetime('now')`,
  ).run(PAYMENT_KEY, JSON.stringify(next))

  return getPublicPaymentSettings()
}
