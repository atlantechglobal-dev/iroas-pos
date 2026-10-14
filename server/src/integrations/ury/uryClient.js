// IROAS — URY (Frappe) API client. Server-side only; credentials come from
// server/.env and are never sent to the browser.
//
// Auth modes accepted by https://iroas.atlantechglobal.com (confirmed by
// probing: invalid token -> 401 from frappe.auth.validate_auth, invalid
// login -> 401 "Invalid login credentials"):
//   token   — header `Authorization: token <api_key>:<api_secret>`
//   session — POST /api/method/login (usr, pwd) -> `sid` cookie
// Token mode wins when both are configured.
//
// Tenant requests use createUryClient() with that tenant's own credential
// (see uryCredentials.js). The module-level helpers below use the operator
// credential (URY_USERNAME/URY_PASSWORD or URY_API_KEY/SECRET) and exist for
// operator scripts only — tenant routes must never call them.

import { getEnv } from '../../config/env.js'

function requestTimeoutMs() {
  return Number(getEnv('URY_REQUEST_TIMEOUT_MS')) || 15_000
}

export class UryError extends Error {
  constructor(code, message, { status = 0 } = {}) {
    super(message)
    this.name = 'UryError'
    this.code = code
    this.status = status
  }
}

export function getUryBaseUrl() {
  return getEnv('URY_BASE_URL').replace(/\/+$/, '')
}

function withAuthMode(cfg) {
  let authMode = null
  if (cfg.apiKey && cfg.apiSecret) authMode = 'token'
  else if (cfg.username && cfg.password) authMode = 'session'
  return { ...cfg, authMode }
}

/** Operator credential from server/.env (scripts only). */
export function getUryConfig() {
  return withAuthMode({
    baseUrl: getUryBaseUrl(),
    apiKey: getEnv('URY_API_KEY'),
    apiSecret: getEnv('URY_API_SECRET'),
    username: getEnv('URY_USERNAME'),
    password: getEnv('URY_PASSWORD'),
  })
}

async function rawFetch(url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs())
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err.name === 'AbortError') throw new UryError('timeout', 'URY request timed out.')
    throw new UryError('unreachable', 'URY server is unreachable.')
  } finally {
    clearTimeout(timer)
  }
}

/** Frappe error bodies include Python tracebacks in `exc`; keep only the type. */
async function toUryError(res) {
  let excType = ''
  try {
    const body = await res.json()
    excType = String(body?.exc_type || '')
  } catch {
    // non-JSON error body
  }
  if (res.status === 401) return new UryError('auth_failed', 'URY authentication failed.', { status: 401 })
  if (res.status === 403) return new UryError('forbidden', 'URY user lacks permission.', { status: 403 })
  if (res.status === 404 || excType === 'DoesNotExistError') {
    return new UryError('not_found', 'URY record not found.', { status: 404 })
  }
  return new UryError('upstream_error', `URY request failed (${res.status}${excType ? ` ${excType}` : ''}).`, {
    status: res.status,
  })
}

/** Like toUryError, but keeps Frappe's user-facing validation message (e.g. "Table is occupied"). */
async function toUryWriteError(res) {
  let message = ''
  let excType = ''
  try {
    const body = await res.json()
    excType = String(body?.exc_type || '')
    // Informational msgprints (e.g. "Item Price added…") come first; the raised one is the cause.
    const msgs = JSON.parse(body?._server_messages || '[]').map((m) => JSON.parse(m))
    const raised = msgs.filter((m) => m.raise_exception)
    const pick = raised[0] || msgs[msgs.length - 1]
    message = pick ? String(pick.message || '') : ''
  } catch {
    // non-JSON error body
  }
  const plain = message.replace(/<[^>]*>/g, '').trim().slice(0, 300)
  if (res.status === 401) return new UryError('auth_failed', 'URY authentication failed.', { status: 401 })
  if (res.status === 403) return new UryError('forbidden', plain || 'URY user lacks permission.', { status: 403 })
  if (res.status === 417 || excType === 'ValidationError') {
    return new UryError('validation', plain || 'URY rejected the request.', { status: res.status })
  }
  return new UryError('upstream_error', `URY request failed (${res.status}${excType ? ` ${excType}` : ''}).`, {
    status: res.status,
  })
}

/**
 * A URY client bound to one credential, with its own session cookie.
 * `cfg`: { baseUrl, apiKey?, apiSecret?, username?, password? }.
 */
export function createUryClient(rawCfg) {
  const cfg = withAuthMode({ ...rawCfg, baseUrl: String(rawCfg.baseUrl || '').replace(/\/+$/, '') })
  let sessionCookie = null

  function assertConfigured() {
    if (!cfg.baseUrl || !cfg.authMode) throw new UryError('not_configured', 'URY is not configured.')
  }

  async function loginSession() {
    const res = await rawFetch(`${cfg.baseUrl}/api/method/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ usr: cfg.username, pwd: cfg.password }).toString(),
    })
    if (!res.ok) throw await toUryError(res)
    const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    const sid = cookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('sid='))
    if (!sid || sid === 'sid=Guest') throw new UryError('auth_failed', 'URY login did not return a session.')
    sessionCookie = sid
  }

  async function authHeaders() {
    if (cfg.authMode === 'token') return { Authorization: `token ${cfg.apiKey}:${cfg.apiSecret}` }
    if (!sessionCookie) await loginSession()
    return { Cookie: sessionCookie }
  }

  /**
   * GET a whitelisted Frappe method. Returns the parsed JSON body.
   * Session mode re-logs in once if the cookie has expired.
   */
  async function get(methodPath, params = {}) {
    assertConfigured()
    const qs = new URLSearchParams(params).toString()
    const url = `${cfg.baseUrl}/api/method/${methodPath}${qs ? `?${qs}` : ''}`
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await rawFetch(url, { headers: { Accept: 'application/json', ...(await authHeaders()) } })
      if (res.ok) return res.json()
      if (cfg.authMode === 'session' && attempt === 0 && (res.status === 401 || res.status === 403)) {
        sessionCookie = null
        continue
      }
      throw await toUryError(res)
    }
    throw new UryError('auth_failed', 'URY authentication failed.')
  }

  /**
   * POST a whitelisted Frappe method with a JSON body (as the URY POS frontend does).
   * Not retried after a successful send, so a write is never applied twice.
   */
  async function post(methodPath, body = {}) {
    assertConfigured()
    const url = `${cfg.baseUrl}/api/method/${methodPath}`
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await rawFetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(body),
      })
      if (res.ok) return res.json()
      if (cfg.authMode === 'session' && attempt === 0 && res.status === 401) {
        sessionCookie = null
        continue
      }
      throw await toUryWriteError(res)
    }
    throw new UryError('auth_failed', 'URY authentication failed.')
  }

  /** Returns the authenticated URY user id (e.g. an email), or throws. */
  async function getLoggedUser() {
    const body = await get('frappe.auth.get_logged_user')
    const user = body?.message
    if (!user || user === 'Guest') throw new UryError('auth_failed', 'URY session is not authenticated.')
    return user
  }

  /** Inventory: GET frappe.desk.form.load.getdoctype?doctype=<DocType>&with_parent=1 */
  function getDocType(doctype) {
    return get('frappe.desk.form.load.getdoctype', { doctype, with_parent: '1', cached_timestamp: '' })
  }

  /**
   * Inventory: GET frappe.desk.form.load.getdoc?doctype=<DocType>&name=<name>
   * A missing record comes back as 200 `{"message":[]}` (no `docs`), so treat that as not_found.
   */
  async function getDoc(doctype, name) {
    const body = await get('frappe.desk.form.load.getdoc', { doctype, name })
    if (!body?.docs?.[0]) throw new UryError('not_found', 'URY record not found.', { status: 404 })
    return body
  }

  /**
   * Inventory: GET frappe.desk.reportview.get_list?doctype=…&fields=[…]&filters={…}&limit=…
   * (fields/filters are JSON-encoded query params, as in the captured URY calls).
   * `orderBy` maps to Frappe's `order_by` (e.g. "modified desc").
   * Returns the `message` array of row objects.
   */
  async function getList(doctype, { fields, filters, limit = 10000, orderBy } = {}) {
    const params = { doctype, limit: String(limit) }
    if (fields) params.fields = JSON.stringify(fields)
    if (filters) params.filters = JSON.stringify(filters)
    if (orderBy) params.order_by = orderBy
    const body = await get('frappe.desk.reportview.get_list', params)
    return Array.isArray(body?.message) ? body.message : []
  }

  return { get, post, getLoggedUser, getDocType, getDoc, getList }
}

let operatorClient = null
let operatorKey = ''

function operator() {
  const cfg = getUryConfig()
  const key = `${cfg.baseUrl}|${cfg.authMode}|${cfg.apiKey}|${cfg.username}`
  if (!operatorClient || key !== operatorKey) {
    operatorClient = createUryClient(cfg)
    operatorKey = key
  }
  return operatorClient
}

// Operator-credential helpers (scripts only).
export const uryGet = (methodPath, params) => operator().get(methodPath, params)
export const uryPost = (methodPath, body) => operator().post(methodPath, body)
export const getLoggedUser = () => operator().getLoggedUser()
export const getDocType = (doctype) => operator().getDocType(doctype)
export const getDoc = (doctype, name) => operator().getDoc(doctype, name)
export const getList = (doctype, opts) => operator().getList(doctype, opts)
