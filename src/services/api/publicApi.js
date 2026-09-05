import { apiRequest } from './client.js'

export const publicApi = {
  getSite: (slug) =>
    apiRequest(`/public/${encodeURIComponent(slug)}`, { auth: false }),
  createReservation: (slug, payload) =>
    apiRequest(`/public/${encodeURIComponent(slug)}/reservations`, {
      method: 'POST',
      body: payload,
      auth: false,
    }),
}
