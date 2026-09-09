import { apiRequest } from './client.js'

export const identityApi = {
  get: () => apiRequest('/identity'),
  save: (payload) => apiRequest('/identity', { method: 'PUT', body: payload }),
  submit: (payload) => apiRequest('/identity/submit', { method: 'POST', body: payload }),
}

export const productApi = {
  list: () => apiRequest('/products'),
  get: (type) => apiRequest(`/products/${type}`),
  request: (type, payload = {}) =>
    apiRequest(`/products/${type}`, { method: 'POST', body: payload }),
  update: (type, payload = {}) =>
    apiRequest(`/products/${type}`, { method: 'PATCH', body: payload }),
}

export const notificationApi = {
  list: () => apiRequest('/notifications'),
  markRead: (ids) => apiRequest('/notifications/mark-read', { method: 'POST', body: { ids } }),
}
