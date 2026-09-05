import { apiRequest } from './client.js'

export const restaurantApi = {
  get: () => apiRequest('/restaurant'),
  updateProfile: (payload) => apiRequest('/restaurant/profile', { method: 'PUT', body: payload }),
  updateDomain: (payload) => apiRequest('/restaurant/domain', { method: 'PUT', body: payload }),
  updateBrand: (payload) => apiRequest('/restaurant/brand', { method: 'PUT', body: payload }),
  updateSettings: (payload) => apiRequest('/restaurant/settings', { method: 'PUT', body: payload }),
  launch: () => apiRequest('/restaurant/launch', { method: 'POST' }),
  listReservations: () => apiRequest('/restaurant/reservations'),
  createReservation: (payload) =>
    apiRequest('/restaurant/reservations', { method: 'POST', body: payload }),
  updateReservation: (id, payload) =>
    apiRequest(`/restaurant/reservations/${id}`, { method: 'PATCH', body: payload }),
  listReviews: () => apiRequest('/restaurant/reviews'),
  createReview: (payload) => apiRequest('/restaurant/reviews', { method: 'POST', body: payload }),
  updateReview: (id, payload) =>
    apiRequest(`/restaurant/reviews/${id}`, { method: 'PATCH', body: payload }),
}