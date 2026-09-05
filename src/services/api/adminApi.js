import { apiRequest } from './client.js'

export const adminApi = {
  stats: () => apiRequest('/admin/stats'),
  tenants: (search = '') =>
    apiRequest(`/admin/tenants${search ? `?search=${encodeURIComponent(search)}` : ''}`),
}
