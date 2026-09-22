import { apiRequest } from './client.js'

export const authApi = {
  signup: (payload) => apiRequest('/auth/signup', { method: 'POST', body: payload, auth: false }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload, auth: false }),
  googleConfig: () => apiRequest('/auth/google/config', { auth: false }),
  businessCategories: () => apiRequest('/auth/business-categories', { auth: false }),
  googleLogin: (idToken) =>
    apiRequest('/auth/google', { method: 'POST', body: { idToken }, auth: false }),
  me: () => apiRequest('/auth/me'),
  forgotPassword: (email) =>
    apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token, password) =>
    apiRequest('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),
}
