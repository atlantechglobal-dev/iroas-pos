/** Compatibility re-export. Prefer `@/shared/api`. */
export {
  api,
  authApi,
  restaurantApi,
  adminApi,
  apiRequest,
  ApiError,
  setUnauthorizedHandler,
} from '@/shared/api/index.js'

export {
  getToken,
  getStoredUser,
  setSession,
  clearSession,
  hasSession,
} from '@/shared/storage/authStorage.js'
