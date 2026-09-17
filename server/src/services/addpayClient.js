// IROAS — AddPay (PayCloud CNP) API client.
// Node port of the working Python/Frappe integration used by IROAS LMS
// (iroas_payments_app/addpay_client.py) — same signing/request logic,
// same endpoints, same webhook contract. Uses Node's built-in `crypto`
// (RSA-SHA256 / PKCS1v15) instead of the `cryptography` package.

import crypto from 'node:crypto'

const SANDBOX_BASE_URL = 'https://open-uat.paycloud.africa'
const PRODUCTION_BASE_URL = 'https://api.paycloud.africa'

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*)-----END \1-----/

/**
 * Repair a PEM key pasted into a single-line form field — rebuilds proper
 * PEM framing whether the pasted value kept its BEGIN/END markers (just lost
 * line breaks) or lost them entirely (pure base64 body).
 */
function normalizePem(pemStr, defaultLabel = 'PRIVATE KEY') {
  const raw = String(pemStr || '').trim()
  const match = raw.match(PEM_RE)
  let label = defaultLabel
  let body = raw
  if (match) {
    label = match[1]
    body = match[2]
  }
  body = body.replace(/\s+/g, '')
  const lines = []
  for (let i = 0; i < body.length; i += 64) lines.push(body.slice(i, i + 64))
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function signWithRsa(data, privateKeyPem) {
  let lastError = null
  for (const label of ['PRIVATE KEY', 'RSA PRIVATE KEY']) {
    try {
      const key = crypto.createPrivateKey({
        key: normalizePem(privateKeyPem, label),
        format: 'pem',
      })
      const signer = crypto.createSign('RSA-SHA256')
      signer.update(data)
      signer.end()
      return signer.sign({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, 'base64')
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Could not parse private_key as PEM')
}

function verifyWithRsa(data, signatureB64, publicKeyPem) {
  try {
    const key = crypto.createPublicKey({
      key: normalizePem(publicKeyPem, 'PUBLIC KEY'),
      format: 'pem',
    })
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(data)
    verifier.end()
    return verifier.verify(
      { key, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(signatureB64, 'base64'),
    )
  } catch {
    return false
  }
}

/**
 * Mirrors CryptoUtils.buildSignatureString in AddPay's own JS SDK: sort keys
 * alphabetically, drop empty/null values and the "sign" key itself, join as
 * key=value pairs. Nested object/array values are JSON-stringified.
 */
function buildSignatureString(params) {
  const pairs = []
  for (const key of Object.keys(params).sort()) {
    if (key === 'sign') continue
    const value = params[key]
    if (value === null || value === undefined || value === '') continue
    pairs.push(`${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
  }
  return pairs.join('&')
}

function baseUrl(settings) {
  return settings.useSandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL
}

/**
 * POST a signed request to AddPay/PayCloud and return the parsed response.
 * `endpoint` is a path like "/api/entry".
 */
export async function addpayRequest(endpoint, data, settings) {
  if (!settings.appId || !settings.merchantNo || !settings.storeNo || !settings.privateKey) {
    const err = new Error('AddPay is not configured. Set it up in Platform Admin → Payment settings.')
    err.status = 503
    throw err
  }

  const cleaned = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'object') cleaned[key] = JSON.stringify(value)
    else if (typeof value === 'boolean') cleaned[key] = value ? 'true' : 'false'
    // Every value goes over the wire as a string — otherwise the gateway
    // re-serializes numbers in its own convention when rebuilding the
    // signature string, silently breaking verification.
    else cleaned[key] = String(value)
  }

  const common = {
    app_id: settings.appId,
    merchant_no: settings.merchantNo,
    store_no: settings.storeNo,
    format: 'JSON',
    charset: 'UTF-8',
    sign_type: 'RSA2',
    version: '1.0',
    timestamp: String(Date.now()),
  }

  const signString = buildSignatureString({ ...cleaned, ...common })
  const signature = signWithRsa(signString, settings.privateKey)

  const body = { ...cleaned, ...common, sign: signature }
  const url = baseUrl(settings) + endpoint

  if (process.env.ADDPAY_DEBUG === 'true') {
    const keyFingerprint = crypto.createHash('sha256').update(settings.privateKey).digest('hex').slice(0, 16)
    console.log('[addpay debug] url=', url)
    console.log('[addpay debug] privateKeyFingerprint=', keyFingerprint, 'privateKeyLength=', settings.privateKey.length)
    console.log('[addpay debug] signString=', signString)
    console.log('[addpay debug] signature=', signature)
    console.log('[addpay debug] body=', JSON.stringify(body))
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  const raw = await res.text()
  if (process.env.ADDPAY_DEBUG === 'true') {
    console.log('[addpay debug] response status=', res.status, 'body=', raw)
  }
  let result
  try {
    result = raw ? JSON.parse(raw) : {}
  } catch {
    const err = new Error(`AddPay returned a non-JSON response (HTTP ${res.status}).`)
    err.status = 502
    throw err
  }

  if (!res.ok) {
    const err = new Error(`AddPay HTTP ${res.status}: ${result?.msg || raw || 'request failed'}`)
    err.status = 502
    throw err
  }

  if (result.code !== '0' && result.code !== 'SUCCESS') {
    const err = new Error(`AddPay error: ${result.msg || result.code}`)
    err.status = 502
    throw err
  }

  return result
}

/**
 * Verify an incoming webhook/notify payload was really signed by AddPay,
 * using their Gateway Public Key (not our own private key).
 */
export function verifyNotifySignature(payload, settings) {
  if (!settings.gatewayPublicKey) return false
  const signature = payload?.sign
  if (!signature) return false
  const withoutSign = { ...payload }
  delete withoutSign.sign
  const signString = buildSignatureString(withoutSign)
  return verifyWithRsa(signString, signature, settings.gatewayPublicKey)
}

export { normalizePem }
