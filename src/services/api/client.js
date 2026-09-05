import { env } from '../../config/env.js'
import { MESSAGES } from '../../constants/messages.js'
import { ROUTES } from '../../constants/routes.js'
import { clearSession, getToken } from '../storage/authStorage.js'

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let onUnauthorized = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

function handleUnauthorized() {
  clearSession()
  if (onUnauthorized) {
    onUnauthorized()
  } else if (typeof window !== 'undefined' && window.location.pathname !== ROUTES.LOGIN) {
    window.location.assign(ROUTES.LOGIN)
  }
}

export async function apiRequest(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch {
    throw new ApiError(MESSAGES.NETWORK_ERROR, { status: 0 })
  }

  const data = await response.json().catch(() => ({}))

  if (response.status === 401 && auth) {
    handleUnauthorized()
    throw new ApiError(MESSAGES.SESSION_EXPIRED, { status: 401, data })
  }

  if (!response.ok) {
    throw new ApiError(data.error || MESSAGES.GENERIC_ERROR, {
      status: response.status,
      data,
    })
  }

  return data
}
