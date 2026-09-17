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
  getOnboardingPayment: restaurantApi.getOnboardingPayment,
  completeOnboardingPayment: restaurantApi.completeOnboardingPayment,
  getReservations: restaurantApi.listReservations,
  getReservationAvailability: restaurantApi.getAvailability,
  createReservation: restaurantApi.createReservation,
  updateReservation: restaurantApi.updateReservation,
  getDiningTables: restaurantApi.listTables,
  createDiningTable: restaurantApi.createTable,
  updateDiningTable: restaurantApi.updateTable,
  deleteDiningTable: restaurantApi.deleteTable,
  getOrders: restaurantApi.listOrders,
  getOrder: restaurantApi.getOrder,
  updateOrder: restaurantApi.updateOrder,
  markOrderPaid: restaurantApi.markOrderPaid,
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
  getPublicAvailability: publicApi.getAvailability,
  createPublicReservation: publicApi.createReservation,
  getPublicTable: publicApi.getTable,
  createPublicOrder: publicApi.createOrder,
  getPublicOrder: publicApi.getOrder,
  getPublicOrderHistory: publicApi.listOrderHistory,
  getPublicTables: publicApi.listTables,

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
  adminEmailSettings: adminApi.emailSettings,
  adminSaveEmailSettings: adminApi.saveEmailSettings,
  adminTestEmail: adminApi.testEmail,

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
