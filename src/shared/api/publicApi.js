import { apiRequest } from '@/shared/api/client'

export const publicApi = {
  getSite: (slug) =>
    apiRequest(`/public/${encodeURIComponent(slug)}`, { auth: false }),
  getAvailability: (slug, { date, guests }) =>
    apiRequest(
      `/public/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(date)}&guests=${encodeURIComponent(guests)}`,
      { auth: false },
    ),
  getBooking: (slug, token) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(token)}`, { auth: false }),
  cancelBooking: (slug, token) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(token)}/cancel`, {
      method: 'POST',
      auth: false,
    }),
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
  createUryOrder: (slug, payload) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/ury-orders`, {
      method: 'POST',
      body: payload,
      auth: false,
    }),
  getUryOrder: (slug, submissionId) =>
    apiRequest(
      `/public/${encodeURIComponent(slug)}/ury-orders/${encodeURIComponent(submissionId)}`,
      { auth: false },
    ),
  trackUryOrder: (slug, { invoice, phone }) => {
    const q = new URLSearchParams({
      invoice: String(invoice || '').trim(),
      phone: String(phone || '').trim(),
    })
    return apiRequest(`/public/${encodeURIComponent(slug)}/ury-track?${q}`, { auth: false })
  },
  requestUryBill: (slug, submissionId) =>
    apiRequest(
      `/public/${encodeURIComponent(slug)}/ury-orders/${encodeURIComponent(submissionId)}/request-bill`,
      { method: 'POST', body: {}, auth: false },
    ),
  getUryAccount: (slug, phone, { customerId } = {}) => {
    const q = new URLSearchParams({ phone: String(phone || '').trim() })
    if (customerId) q.set('customerId', String(customerId))
    return apiRequest(`/public/${encodeURIComponent(slug)}/ury-account?${q}`, { auth: false })
  },
  createUryAccount: (slug, payload) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/ury-account`, {
      method: 'POST',
      body: payload,
      auth: false,
    }),
  getUryTable: (slug, code) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/ury-table/${encodeURIComponent(code)}`, {
      auth: false,
    }),
  listUryDineTables: (slug) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/ury-dine-tables`, { auth: false }),
  createUryDineOrder: (slug, payload) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/ury-dine-orders`, {
      method: 'POST',
      body: payload,
      auth: false,
    }),
  listTables: (slug) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/tables`, { auth: false }),
  getPlatformCard: (slug) =>
    apiRequest(`/public/platform-card/${encodeURIComponent(slug)}`, { auth: false }),
}
