// Per-tenant URY credentials. The DB stores only a credential reference
// (e.g. "TENANT_62"); the secret itself lives in server-side environment
// variables named after it:
//   URY_CRED_<REF>_API_KEY + URY_CRED_<REF>_API_SECRET   (preferred), or
//   URY_CRED_<REF>_USERNAME + URY_CRED_<REF>_PASSWORD
// Values are never logged, stored in SQLite, or returned to the browser.

import { createHash } from 'node:crypto'
import { getEnv } from '../../config/env.js'
import { createUryClient, getUryBaseUrl } from './uryClient.js'

const CREDENTIAL_REF_RE = /^[A-Z][A-Z0-9_]{0,47}$/

export function isValidCredentialRef(ref) {
  return typeof ref === 'string' && CREDENTIAL_REF_RE.test(ref)
}

export function credentialEnvNames(ref) {
  const prefix = `URY_CRED_${ref}_`
  return {
    apiKey: `${prefix}API_KEY`,
    apiSecret: `${prefix}API_SECRET`,
    username: `${prefix}USERNAME`,
    password: `${prefix}PASSWORD`,
  }
}

/** Returns the credential for `ref`, or null when it is invalid or not fully set. */
export function getTenantCredential(ref) {
  if (!isValidCredentialRef(ref)) return null
  const names = credentialEnvNames(ref)
  const cred = {
    apiKey: getEnv(names.apiKey),
    apiSecret: getEnv(names.apiSecret),
    username: getEnv(names.username),
    password: getEnv(names.password),
  }
  if ((cred.apiKey && cred.apiSecret) || (cred.username && cred.password)) return cred
  return null
}

const clients = new Map()

function fingerprint(baseUrl, cred) {
  return createHash('sha256')
    .update([baseUrl, cred.apiKey, cred.apiSecret, cred.username, cred.password].join('\u0000'))
    .digest('hex')
}

/** A URY client authenticated as the tenant's own integration user, or null if unavailable. */
export function getTenantClient(ref) {
  const baseUrl = getUryBaseUrl()
  const cred = getTenantCredential(ref)
  if (!baseUrl || !cred) return null
  const fp = fingerprint(baseUrl, cred)
  const hit = clients.get(ref)
  if (hit && hit.fp === fp) return hit.client
  const client = createUryClient({ baseUrl, ...cred })
  clients.set(ref, { fp, client })
  return client
}

export function clearTenantClients() {
  clients.clear()
}
