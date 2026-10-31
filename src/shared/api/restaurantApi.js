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
  syncTablesFromPos: () => apiRequest('/restaurant/tables/sync-from-pos', { method: 'POST', body: {} }),
  createTable: (payload) => apiRequest('/restaurant/tables', { method: 'POST', body: payload }),
  updateTable: (id, payload) =>
    apiRequest(`/restaurant/tables/${id}`, { method: 'PATCH', body: payload }),
  deleteTable: (id) => apiRequest(`/restaurant/tables/${id}`, { method: 'DELETE' }),
  listPosTables: () => apiRequest('/restaurant/pos-tables'),
  getPosTableOptions: () => apiRequest('/restaurant/pos-tables/options'),
  createPosTable: (payload) => apiRequest('/restaurant/pos-tables', { method: 'POST', body: payload }),
  getDashboard: () => apiRequest('/restaurant/dashboard'),
  getPosMenu: () => apiRequest('/restaurant/pos-menu'),
  getPosMenuOptions: () => apiRequest('/restaurant/pos-menu/options'),
  addPosItemStock: (code, qty) =>
    apiRequest(`/restaurant/pos-menu/items/${encodeURIComponent(code)}/stock`, { method: 'POST', body: { qty } }),
  createPosMenuItem: (payload) => apiRequest('/restaurant/pos-menu/items', { method: 'POST', body: payload }),
  createPosCourse: (payload) => apiRequest('/restaurant/pos-menu/courses', { method: 'POST', body: payload }),
  createPosMenu: (payload) => apiRequest('/restaurant/pos-menu/menus', { method: 'POST', body: payload }),
  updatePosMenuItem: (id, payload) =>
    apiRequest(`/restaurant/pos-menu/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  listPosTableQr: () => apiRequest('/restaurant/pos-tables/qr'),
  getPosShift: () => apiRequest('/restaurant/pos-shift'),
  openPosShift: (payload = {}) => apiRequest('/restaurant/pos-shift/open', { method: 'POST', body: payload }),
  closePosShift: () => apiRequest('/restaurant/pos-shift/close', { method: 'POST', body: {} }),
  listPosOrders: () => apiRequest('/restaurant/pos-orders'),
  getPosOrderBill: (invoiceId) =>
    apiRequest(`/restaurant/pos-orders/${encodeURIComponent(invoiceId)}/bill`),
  payPosOrder: (invoiceId, payments) =>
    apiRequest(`/restaurant/pos-orders/${encodeURIComponent(invoiceId)}/pay`, {
      method: 'POST',
      body: { payments },
    }),
  cancelPosOrder: (invoiceId, reason) =>
    apiRequest(`/restaurant/pos-orders/${encodeURIComponent(invoiceId)}/cancel`, { method: 'POST', body: { reason } }),
  printPosOrder: (invoiceId) =>
    apiRequest(`/restaurant/pos-orders/${encodeURIComponent(invoiceId)}/print`, { method: 'POST', body: {} }),
  advancePosKitchen: (invoiceId, body = { advance: true }) =>
    apiRequest(`/restaurant/pos-orders/${encodeURIComponent(invoiceId)}/kitchen`, {
      method: 'PATCH',
      body,
    }),
  listPosCustomers: () => apiRequest('/restaurant/pos-customers'),
  listPosStaff: () => apiRequest('/restaurant/pos-staff'),
  getPosOrderMenu: (table) =>
    apiRequest(`/restaurant/pos-order-menu?table=${encodeURIComponent(table)}`),
  createPosOrder: (payload) => apiRequest('/restaurant/pos-orders', { method: 'POST', body: payload }),
  upsertPosCustomer: (payload) =>
    apiRequest('/restaurant/pos-customers', { method: 'POST', body: payload }),
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