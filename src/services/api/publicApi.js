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
}
