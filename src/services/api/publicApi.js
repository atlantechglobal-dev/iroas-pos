import { apiRequest } from './client.js'

export const publicApi = {
  getSite: (slug) =>
    apiRequest(`/public/${encodeURIComponent(slug)}`, { auth: false }),
  getAvailability: (slug, { date, guests }) =>
    apiRequest(
      `/public/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(date)}&guests=${encodeURIComponent(guests)}`,
      { auth: false },
    ),
  createReservation: (slug, payload) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/reservations`, {
      method: 'POST',
      body: payload,
      auth: false,
    }),
  getTable: (slug, code) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/table/${encodeURIComponent(code)}`, {
      auth: false,
    }),
  createOrder: (slug, payload) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/orders`, {
      method: 'POST',
      body: payload,
      auth: false,
    }),
  getOrder: (slug, code, { phone } = {}) => {
    const q = phone ? `?phone=${encodeURIComponent(phone)}` : ''
    return apiRequest(
      `/public/${encodeURIComponent(slug)}/orders/${encodeURIComponent(code)}${q}`,
      { auth: false },
    )
  },
  listOrderHistory: (slug, phone) =>
    apiRequest(
      `/public/${encodeURIComponent(slug)}/order-history?phone=${encodeURIComponent(phone)}`,
      { auth: false },
    ),
  listTables: (slug) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/tables`, { auth: false }),
}
