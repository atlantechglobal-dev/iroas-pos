import { apiRequest } from './client.js'

export const adminApi = {
  stats: () => apiRequest('/admin/stats'),
  tenants: (search = '', status = '') => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const qs = params.toString()
    return apiRequest(`/admin/tenants${qs ? `?${qs}` : ''}`)
  },
  tenantStatus: (id, status) =>
    apiRequest(`/admin/tenants/${id}/status`, { method: 'PATCH', body: { status } }),
  tenant: (id) => apiRequest(`/admin/tenants/${id}`),
  updateTenant: (id, payload) =>
    apiRequest(`/admin/tenants/${id}`, { method: 'PATCH', body: payload }),
  approveTenant: (id, checks) =>
    apiRequest(`/admin/tenants/${id}/approve`, { method: 'POST', body: { checks } }),
  rejectTenant: (id, reason) =>
    apiRequest(`/admin/tenants/${id}/reject`, { method: 'POST', body: { reason } }),
  deleteTenant: (id, confirmName) =>
    apiRequest(`/admin/tenants/${id}`, { method: 'DELETE', body: { confirmName } }),
  identities: ({ search = '', status = '', category = '' } = {}) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (category) params.set('category', category)
    const qs = params.toString()
    return apiRequest(`/admin/identities${qs ? `?${qs}` : ''}`)
  },
  identity: (id) => apiRequest(`/admin/identities/${id}`),
  identityNote: (id, note) =>
    apiRequest(`/admin/identities/${id}/notes`, { method: 'POST', body: { note } }),
  identityStatus: (id, payload) =>
    apiRequest(`/admin/identities/${id}/status`, { method: 'POST', body: payload }),
  products: ({ type = '', status = '' } = {}) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (status) params.set('status', status)
    const qs = params.toString()
    return apiRequest(`/admin/products${qs ? `?${qs}` : ''}`)
  },
  updateProduct: (id, payload) =>
    apiRequest(`/admin/products/${id}`, { method: 'PATCH', body: payload }),
  emailSettings: () => apiRequest('/admin/email-settings'),
  saveEmailSettings: (payload) =>
    apiRequest('/admin/email-settings', { method: 'PUT', body: payload }),
  testEmail: (to) =>
    apiRequest('/admin/email-settings/test', { method: 'POST', body: to ? { to } : {} }),
  paymentSettings: () => apiRequest('/admin/payment-settings'),
  savePaymentSettings: (payload) =>
    apiRequest('/admin/payment-settings', { method: 'PUT', body: payload }),
  plans: () => apiRequest('/admin/plans'),
  savePlan: (id, payload) => apiRequest(`/admin/plans/${id}`, { method: 'PUT', body: payload }),
  featureFlags: () => apiRequest('/admin/feature-flags'),
  saveFeatureFlags: (flags) =>
    apiRequest('/admin/feature-flags', { method: 'PUT', body: { flags } }),
  audit: (limit = 100) => apiRequest(`/admin/audit?limit=${limit}`),
  feed: (limit = 40) => apiRequest(`/admin/feed?limit=${limit}`),
  health: () => apiRequest('/admin/health'),
  staff: () => apiRequest('/admin/staff'),
  createStaff: (payload) => apiRequest('/admin/staff', { method: 'POST', body: payload }),
}
