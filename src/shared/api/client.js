import { env } from '@/shared/config/env'
import { MESSAGES } from '@/shared/constants/messages'
import { ROUTES } from '@/shared/constants/routes'
import { clearSession, getToken } from '@/shared/storage/authStorage'

export class ApiError extends Error {
  constructor(message, { status, data, code } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.code = code || data?.code || undefined
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
    const fallback =
      response.status >= 500 ? MESSAGES.NETWORK_ERROR : MESSAGES.GENERIC_ERROR
    throw new ApiError(data.error || fallback, {
      status: response.status,
      data,
      code: data.code,
    })
  }

  return data
}
