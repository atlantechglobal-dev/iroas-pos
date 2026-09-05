/**
 * Centralized environment configuration.
 * All Vite env vars must be prefixed with VITE_.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  appDomain: import.meta.env.VITE_APP_DOMAIN || 'iroas.com',
  /** Absolute origin for QR / share links (no trailing slash). Falls back to window.location.origin. */
  publicBaseUrl: String(import.meta.env.VITE_PUBLIC_BASE_URL || '')
    .trim()
    .replace(/\/$/, ''),
  qrServiceUrl:
    import.meta.env.VITE_QR_SERVICE_URL ||
    'https://api.qrserver.com/v1/create-qr-code/',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}
