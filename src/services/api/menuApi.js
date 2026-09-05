import { apiRequest } from './client.js'

export const menuApi = {
  list: () => apiRequest('/menu'),
  createCategory: (payload) => apiRequest('/menu/categories', { method: 'POST', body: payload }),
  updateCategory: (id, payload) =>
    apiRequest(`/menu/categories/${id}`, { method: 'PUT', body: payload }),
  duplicateCategory: (id) =>
    apiRequest(`/menu/categories/${id}/duplicate`, { method: 'POST' }),
  deleteCategory: (id, { hard = false } = {}) =>
    apiRequest(`/menu/categories/${id}${hard ? '?hard=1' : ''}`, { method: 'DELETE' }),
  createItem: (payload) => apiRequest('/menu/items', { method: 'POST', body: payload }),
  updateItem: (id, payload) => apiRequest(`/menu/items/${id}`, { method: 'PUT', body: payload }),
  deleteItem: (id, { hard = false } = {}) =>
    apiRequest(`/menu/items/${id}${hard ? '?hard=1' : ''}`, { method: 'DELETE' }),
  publicMenu: (slug) => apiRequest(`/menu/public/${encodeURIComponent(slug)}`, { auth: false }),
}
