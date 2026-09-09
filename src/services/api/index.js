import { authApi } from './authApi.js'
import { restaurantApi } from './restaurantApi.js'
import { adminApi } from './adminApi.js'
import { menuApi } from './menuApi.js'
import { publicApi } from './publicApi.js'
import { identityApi, productApi, notificationApi } from './identityApi.js'

/** Unified API surface — preserves existing call sites during migration. */
export const api = {
  signup: authApi.signup,
  login: authApi.login,
  me: authApi.me,
  forgotPassword: authApi.forgotPassword,
  resetPassword: authApi.resetPassword,

  getRestaurant: restaurantApi.get,
  updateProfile: restaurantApi.updateProfile,
  updateDomain: restaurantApi.updateDomain,
  updateBrand: restaurantApi.updateBrand,
  updateSettings: restaurantApi.updateSettings,
  launch: restaurantApi.launch,
  getReservations: restaurantApi.listReservations,
  createReservation: restaurantApi.createReservation,
  updateReservation: restaurantApi.updateReservation,
  getReviews: restaurantApi.listReviews,
  createReview: restaurantApi.createReview,
  updateReview: restaurantApi.updateReview,

  getMenu: menuApi.list,
  createMenuCategory: menuApi.createCategory,
  updateMenuCategory: menuApi.updateCategory,
  duplicateMenuCategory: menuApi.duplicateCategory,
  deleteMenuCategory: menuApi.deleteCategory,
  createMenuItem: menuApi.createItem,
  updateMenuItem: menuApi.updateItem,
  deleteMenuItem: menuApi.deleteItem,
  getPublicMenu: menuApi.publicMenu,

  getPublicSite: publicApi.getSite,
  createPublicReservation: publicApi.createReservation,

  adminStats: adminApi.stats,
  adminTenants: adminApi.tenants,
  adminTenantStatus: adminApi.tenantStatus,
  adminTenant: adminApi.tenant,
  adminUpdateTenant: adminApi.updateTenant,
  adminApproveTenant: adminApi.approveTenant,
  adminRejectTenant: adminApi.rejectTenant,
  adminDeleteTenant: adminApi.deleteTenant,
  adminIdentities: adminApi.identities,
  adminIdentity: adminApi.identity,
  adminIdentityNote: adminApi.identityNote,
  adminIdentityStatus: adminApi.identityStatus,
  adminProducts: adminApi.products,
  adminUpdateProduct: adminApi.updateProduct,

  getIdentity: identityApi.get,
  saveIdentity: identityApi.save,
  submitIdentity: identityApi.submit,
  getProducts: productApi.list,
  getProduct: productApi.get,
  requestProduct: productApi.request,
  updateProduct: productApi.update,
  getNotifications: notificationApi.list,
  markNotificationsRead: notificationApi.markRead,
}

export {
  authApi,
  restaurantApi,
  adminApi,
  menuApi,
  publicApi,
  identityApi,
  productApi,
  notificationApi,
}
export { apiRequest, ApiError, setUnauthorizedHandler } from './client.js'
