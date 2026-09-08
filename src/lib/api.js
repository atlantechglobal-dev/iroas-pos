/** @deprecated Import from `services/api` instead. Kept for backward compatibility. */
export {
  api,
  authApi,
  restaurantApi,
  adminApi,
  apiRequest,
  ApiError,
  setUnauthorizedHandler,
} from '../services/api/index.js'

export {
  getToken,
  getStoredUser,
  setSession,
  clearSession,
  hasSession,
} from '../services/storage/authStorage.js'
