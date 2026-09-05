import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import { PublicRoute } from './PublicRoute.jsx'
import { ROUTES } from '../../constants/routes.js'

const Login = lazy(() => import('../../pages/Login/Login.jsx'))
const ForgotPassword = lazy(() => import('../../pages/ForgotPassword/ForgotPassword.jsx'))
const AccountRecovery = lazy(() => import('../../pages/AccountRecovery/AccountRecovery.jsx'))
const NewPassword = lazy(() => import('../../pages/NewPassword/NewPassword.jsx'))
const PasswordUpdated = lazy(() => import('../../pages/PasswordUpdated/PasswordUpdated.jsx'))
const CreateAccount = lazy(() => import('../../pages/CreateAccount/CreateAccount.jsx'))
const RestaurantSetup = lazy(() => import('../../pages/RestaurantSetup/RestaurantSetup.jsx'))
const Domain = lazy(() => import('../../pages/Domain/Domain.jsx'))
const Brand = lazy(() => import('../../pages/Brand/Brand.jsx'))
const Launch = lazy(() => import('../../pages/Launch/Launch.jsx'))
const GoLive = lazy(() => import('../../pages/GoLive/GoLive.jsx'))
const Dashboard = lazy(() => import('../../pages/Dashboard/Dashboard.jsx'))
const RestaurantProfile = lazy(() => import('../../pages/RestaurantProfile/RestaurantProfile.jsx'))
const DirectoryListings = lazy(() => import('../../pages/DirectoryListings/DirectoryListings.jsx'))
const DigitalBusinessCard = lazy(() => import('../../pages/DigitalBusinessCard/DigitalBusinessCard.jsx'))
const OneLink = lazy(() => import('../../pages/OneLink/OneLink.jsx'))
const GuestOneLink = lazy(() => import('../../pages/GuestOneLink/GuestOneLink.jsx'))
const GuestBusinessCard = lazy(() => import('../../pages/GuestBusinessCard/GuestBusinessCard.jsx'))
const GuestSite = lazy(() => import('../../pages/GuestSite/GuestSite.jsx'))
const PlatformAdmin = lazy(() => import('../../pages/PlatformAdmin/PlatformAdmin.jsx'))
const Menu = lazy(() => import('../../pages/Menu/Menu.jsx'))
const Orders = lazy(() => import('../../pages/Orders/Orders.jsx'))
const Reservations = lazy(() => import('../../pages/Reservations/Reservations.jsx'))
const Tables = lazy(() => import('../../pages/Tables/Tables.jsx'))
const Staff = lazy(() => import('../../pages/Staff/Staff.jsx'))
const Customers = lazy(() => import('../../pages/Customers/Customers.jsx'))
const RolePermissions = lazy(() => import('../../pages/RolePermissions/RolePermissions.jsx'))
const Analytics = lazy(() => import('../../pages/Analytics/Analytics.jsx'))
const Payments = lazy(() => import('../../pages/Payments/Payments.jsx'))
const Marketing = lazy(() => import('../../pages/Marketing/Marketing.jsx'))
const Reviews = lazy(() => import('../../pages/Reviews/Reviews.jsx'))
const PosIntegration = lazy(() => import('../../pages/PosIntegration/PosIntegration.jsx'))
const Notifications = lazy(() => import('../../pages/Notifications/Notifications.jsx'))
const Settings = lazy(() => import('../../pages/Settings/Settings.jsx'))
const SettingsUsers = lazy(() =>
  import('../../pages/Settings/SettingsPreview.jsx').then((m) => ({ default: m.SettingsUsers })),
)
const SettingsBilling = lazy(() =>
  import('../../pages/Settings/SettingsPreview.jsx').then((m) => ({ default: m.SettingsBilling })),
)
const SettingsSecurity = lazy(() =>
  import('../../pages/Settings/SettingsPreview.jsx').then((m) => ({ default: m.SettingsSecurity })),
)
const SettingsApiKeys = lazy(() =>
  import('../../pages/Settings/SettingsPreview.jsx').then((m) => ({ default: m.SettingsApiKeys })),
)
const SettingsBackup = lazy(() =>
  import('../../pages/Settings/SettingsPreview.jsx').then((m) => ({ default: m.SettingsBackup })),
)
const SettingsAudit = lazy(() =>
  import('../../pages/Settings/SettingsPreview.jsx').then((m) => ({ default: m.SettingsAudit })),
)
const SettingsPrivacy = lazy(() =>
  import('../../pages/Settings/SettingsPreview.jsx').then((m) => ({ default: m.SettingsPrivacy })),
)
const NotFound = lazy(() => import('../../pages/NotFound/NotFound.jsx'))
const Unauthorized = lazy(() => import('../../pages/Unauthorized/Unauthorized.jsx'))

function RouteFallback() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      Loading…
    </div>
  )
}

function withProtection(Component, { adminOnly = false } = {}) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Component />
    </ProtectedRoute>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.LOGIN} replace />} />

        <Route path={ROUTES.LOGIN} element={<PublicRoute><Login /></PublicRoute>} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path={ROUTES.ACCOUNT_RECOVERY} element={<PublicRoute><AccountRecovery /></PublicRoute>} />
        <Route path={ROUTES.NEW_PASSWORD} element={<PublicRoute><NewPassword /></PublicRoute>} />
        <Route path={ROUTES.PASSWORD_UPDATED} element={<PublicRoute><PasswordUpdated /></PublicRoute>} />
        <Route path={ROUTES.CREATE_ACCOUNT} element={<PublicRoute><CreateAccount /></PublicRoute>} />

        {/* Guest share pages — public, no auth redirect */}
        <Route path={ROUTES.GUEST_ONE_LINK} element={<GuestOneLink />} />
        <Route path={ROUTES.GUEST_BUSINESS_CARD} element={<GuestBusinessCard />} />
        <Route path={ROUTES.GUEST_SITE} element={<GuestSite />} />
        <Route path={ROUTES.GUEST_SITE_PAGE} element={<GuestSite />} />

        <Route path={ROUTES.RESTAURANT_SETUP} element={withProtection(RestaurantSetup)} />
        <Route path={ROUTES.DOMAIN} element={withProtection(Domain)} />
        <Route path={ROUTES.BRAND} element={withProtection(Brand)} />
        <Route path={ROUTES.LAUNCH} element={withProtection(Launch)} />
        <Route path={ROUTES.GO_LIVE} element={withProtection(GoLive)} />
        <Route path={ROUTES.DASHBOARD} element={withProtection(Dashboard)} />
        <Route path={ROUTES.RESTAURANT_PROFILE} element={withProtection(RestaurantProfile)} />
        <Route path={ROUTES.DIRECTORY_LISTINGS} element={withProtection(DirectoryListings)} />
        <Route path={ROUTES.DIGITAL_BUSINESS_CARD} element={withProtection(DigitalBusinessCard)} />
        <Route path={ROUTES.ONE_LINK} element={withProtection(OneLink)} />
        <Route path={ROUTES.MENU} element={withProtection(Menu)} />
        <Route path={ROUTES.ORDERS} element={withProtection(Orders)} />
        <Route path={ROUTES.RESERVATIONS} element={withProtection(Reservations)} />
        <Route path={ROUTES.TABLES} element={withProtection(Tables)} />
        <Route path={ROUTES.STAFF} element={withProtection(Staff)} />
        <Route path={ROUTES.CUSTOMERS} element={withProtection(Customers)} />
        <Route path={ROUTES.ROLE_PERMISSIONS} element={withProtection(RolePermissions)} />
        <Route path={ROUTES.ANALYTICS} element={withProtection(Analytics)} />
        <Route path={ROUTES.PAYMENTS} element={withProtection(Payments)} />
        <Route path={ROUTES.MARKETING} element={withProtection(Marketing)} />
        <Route path={ROUTES.REVIEWS} element={withProtection(Reviews)} />
        <Route path={ROUTES.POS_INTEGRATION} element={withProtection(PosIntegration)} />
        <Route path={ROUTES.NOTIFICATIONS} element={withProtection(Notifications)} />
        <Route path={ROUTES.SETTINGS} element={withProtection(Settings)} />
        <Route path={ROUTES.SETTINGS_USERS} element={withProtection(SettingsUsers)} />
        <Route path={ROUTES.SETTINGS_BILLING} element={withProtection(SettingsBilling)} />
        <Route path={ROUTES.SETTINGS_SECURITY} element={withProtection(SettingsSecurity)} />
        <Route path={ROUTES.SETTINGS_API_KEYS} element={withProtection(SettingsApiKeys)} />
        <Route path={ROUTES.SETTINGS_BACKUP} element={withProtection(SettingsBackup)} />
        <Route path={ROUTES.SETTINGS_AUDIT} element={withProtection(SettingsAudit)} />
        <Route path={ROUTES.SETTINGS_PRIVACY} element={withProtection(SettingsPrivacy)} />
        <Route path={ROUTES.PLATFORM_ADMIN} element={withProtection(PlatformAdmin, { adminOnly: true })} />

        <Route path={ROUTES.UNAUTHORIZED} element={<Unauthorized />} />
        <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
        <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
      </Routes>
    </Suspense>
  )
}
