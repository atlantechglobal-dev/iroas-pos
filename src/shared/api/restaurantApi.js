import { apiRequest } from '@/shared/api/client'

export const restaurantApi = {
  get: () => apiRequest('/restaurant'),
  updateProfile: (payload) => apiRequest('/restaurant/profile', { method: 'PUT', body: payload }),
  updateDomain: (payload) => apiRequest('/restaurant/domain', { method: 'PUT', body: payload }),
  updateBrand: (payload) => apiRequest('/restaurant/brand', { method: 'PUT', body: payload }),
  updateSettings: (payload) => apiRequest('/restaurant/settings', { method: 'PUT', body: payload }),
  launch: () => apiRequest('/restaurant/launch', { method: 'POST' }),
  getOnboardingPayment: () => apiRequest('/restaurant/onboarding-payment'),
  completeOnboardingPayment: (payload) =>
    apiRequest('/restaurant/onboarding-payment', { method: 'POST', body: payload }),
  listReservations: () => apiRequest('/restaurant/reservations'),
  getAvailability: ({ date, guests, includePast = false }) => {
    const q = new URLSearchParams({
      date: String(date || ''),
      guests: String(guests ?? 2),
    })
    if (includePast) q.set('includePast', '1')
    return apiRequest(`/restaurant/availability?${q.toString()}`)
  },
  createReservation: (payload) =>
    apiRequest('/restaurant/reservations', { method: 'POST', body: payload }),
  updateReservation: (id, payload) =>
    apiRequest(`/restaurant/reservations/${id}`, { method: 'PATCH', body: payload }),
  listTables: () => apiRequest('/restaurant/tables'),
  createTable: (payload) => apiRequest('/restaurant/tables', { method: 'POST', body: payload }),
  updateTable: (id, payload) =>
    apiRequest(`/restaurant/tables/${id}`, { method: 'PATCH', body: payload }),
  deleteTable: (id) => apiRequest(`/restaurant/tables/${id}`, { method: 'DELETE' }),
  listOrders: (params = {}) => {
    const q = new URLSearchParams()
    if (params.status) q.set('status', params.status)
    if (params.paymentStatus) q.set('paymentStatus', params.paymentStatus)
    if (params.serviceMode) q.set('serviceMode', params.serviceMode)
    const qs = q.toString()
    return apiRequest(`/restaurant/orders${qs ? `?${qs}` : ''}`)
  },
  getOrder: (id) => apiRequest(`/restaurant/orders/${id}`),
  updateOrder: (id, payload) =>
    apiRequest(`/restaurant/orders/${id}`, { method: 'PATCH', body: payload }),
  markOrderPaid: (id, payload = {}) =>
    apiRequest(`/restaurant/orders/${id}/mark-paid`, { method: 'POST', body: payload }),
  listReviews: () => apiRequest('/restaurant/reviews'),
  createReview: (payload) => apiRequest('/restaurant/reviews', { method: 'POST', body: payload }),
  updateReview: (id, payload) =>
    apiRequest(`/restaurant/reviews/${id}`, { method: 'PATCH', body: payload }),
}