const TOKEN_KEY = 'iroas_token'
const USER_KEY = 'iroas_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong.')
  }

  return data
}

export const api = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/auth/me'),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token, password) =>
    request('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),

  getRestaurant: () => request('/restaurant'),
  updateProfile: (payload) => request('/restaurant/profile', { method: 'PUT', body: payload }),
  updateDomain: (payload) => request('/restaurant/domain', { method: 'PUT', body: payload }),
  updateBrand: (payload) => request('/restaurant/brand', { method: 'PUT', body: payload }),
  updateSettings: (payload) => request('/restaurant/settings', { method: 'PUT', body: payload }),
  launch: () => request('/restaurant/launch', { method: 'POST' }),

  adminStats: () => request('/admin/stats'),
  adminTenants: (search = '') =>
    request(`/admin/tenants${search ? `?search=${encodeURIComponent(search)}` : ''}`),
}
