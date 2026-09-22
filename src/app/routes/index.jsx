import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import { PublicRoute } from './PublicRoute.jsx'
import { platformAccountApproveProfilePath, ROUTES } from '../../constants/routes.js'

/* Eager entry pages — login ↔ signup ↔ thanks should not wait on Suspense */
import Login from '../../pages/Login/Login.jsx'
import CreateAccount from '../../pages/CreateAccount/CreateAccount.jsx'
import AccountThanks from '../../pages/AccountThanks/AccountThanks.jsx'

const ForgotPassword = lazy(() => import('../../pages/ForgotPassword/ForgotPassword.jsx'))
const AccountRecovery = lazy(() => import('../../pages/AccountRecovery/AccountRecovery.jsx'))
const NewPassword = lazy(() => import('../../pages/NewPassword/NewPassword.jsx'))
const PasswordUpdated = lazy(() => import('../../pages/PasswordUpdated/PasswordUpdated.jsx'))
const RestaurantSetup = lazy(() => import('../../pages/RestaurantSetup/RestaurantSetup.jsx'))
const Domain = lazy(() => import('../../pages/Domain/Domain.jsx'))
const Brand = lazy(() => import('../../pages/Brand/Brand.jsx'))
const Launch = lazy(() => import('../../pages/Launch/Launch.jsx'))
const OnboardingPayment = lazy(() => import('../../pages/OnboardingPayment/OnboardingPayment.jsx'))
const PaymentThanks = lazy(() => import('../../pages/OnboardingPayment/PaymentThanks.jsx'))
const GoLive = lazy(() => import('../../pages/GoLive/GoLive.jsx'))
const Dashboard = lazy(() => import('../../pages/Dashboard/Dashboard.jsx'))
const RestaurantProfile = lazy(() => import('../../pages/RestaurantProfile/RestaurantProfile.jsx'))
const DirectoryListings = lazy(() => import('../../pages/DirectoryListings/DirectoryListings.jsx'))
const DigitalBusinessCard = lazy(() => import('../../pages/DigitalBusinessCard/DigitalBusinessCard.jsx'))
const BusinessId = lazy(() => import('../../pages/BusinessId/BusinessId.jsx'))
const DigitalIdentity = lazy(() => import('../../pages/DigitalIdentity/DigitalIdentity.jsx'))
const DigitalIdentityForm = lazy(() => import('../../pages/DigitalIdentity/DigitalIdentityForm.jsx'))
const MobileApplication = lazy(() => import('../../pages/MobileApplication/MobileApplication.jsx'))
const OneLink = lazy(() => import('../../pages/OneLink/OneLink.jsx'))
const GuestOneLink = lazy(() => import('../../pages/GuestOneLink/GuestOneLink.jsx'))
const GuestBusinessCard = lazy(() => import('../../pages/GuestBusinessCard/GuestBusinessCard.jsx'))
const GuestSite = lazy(() => import('../../pages/GuestSite/GuestSite.jsx'))
const PlatformAdmin = lazy(() => import('../../pages/PlatformAdmin/PlatformAdmin.jsx'))
const PlatformPlans = lazy(() => import('../../pages/PlatformAdmin/Plans.jsx'))
const PlatformCustomers = lazy(() => import('../../pages/PlatformAdmin/PlatformCustomers.jsx'))
const PlatformCustomerOnboarding = lazy(
  () => import('../../pages/PlatformAdmin/CustomerOnboarding.jsx'),
)
const PlatformAccountApprove = lazy(() => import('../../pages/PlatformAdmin/AccountApprove.jsx'))
const PlatformAccountApproveProfile = lazy(
  () => import('../../pages/PlatformAdmin/AccountApproveProfile.jsx'),
)

function RedirectLegacyApproveProfile() {
  const { tenantId } = useParams()
  return <Navigate to={platformAccountApproveProfilePath(tenantId)} replace />
}
const PlatformIdentityReview = lazy(() => import('../../pages/PlatformAdmin/IdentityReview.jsx'))
const PlatformProducts = lazy(() => import('../../pages/PlatformAdmin/ProductsAdmin.jsx'))
const PlatformNotifications = lazy(
  () => import('../../pages/PlatformAdmin/PlatformNotifications.jsx'),
)
const PlatformAudit = lazy(() => import('../../pages/PlatformAdmin/PlatformAudit.jsx'))
const PlatformStaff = lazy(() => import('../../pages/PlatformAdmin/PlatformStaff.jsx'))
const PlatformProfessional = lazy(
  () => import('../../pages/PlatformAdmin/PlatformProfessional.jsx'),
)
const PlatformSettings = lazy(() => import('../../pages/PlatformAdmin/PlatformSettings.jsx'))
const PlatformFeatureFlags = lazy(() => import('../../pages/PlatformAdmin/FeatureFlags.jsx'))
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
const EmailSettings = lazy(() => import('../../pages/Settings/EmailSettings.jsx'))
const PaymentSettings = lazy(() => import('../../pages/Settings/PaymentSettings.jsx'))
const GoogleAuthSettings = lazy(() => import('../../pages/Settings/GoogleAuthSettings.jsx'))
const BusinessCategoriesSettings = lazy(
  () => import('../../pages/PlatformAdmin/BusinessCategoriesSettings.jsx'),
)
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
      <span className="app-loading-spinner" aria-hidden="true" />
      <p>Loading…</p>
    </div>
  )
}

function withProtection(
  Component,
  {
    adminOnly = false,
    requireLive = false,
    onboardingOnly = false,
    allowPending = false,
  } = {},
) {
  return (
    <ProtectedRoute
      adminOnly={adminOnly}
      requireLive={requireLive}
      onboardingOnly={onboardingOnly}
      allowPending={allowPending}
    >
      <Component />
    </ProtectedRoute>
  )
}

// Pages that assume setup is submitted or live. The onboarding wizard itself
// stays reachable only while status is still `onboarding`.
const LIVE_ONLY = { requireLive: true }
const WIZARD_ONLY = { onboardingOnly: true }

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
        <Route path={ROUTES.ACCOUNT_THANKS} element={<PublicRoute><AccountThanks /></PublicRoute>} />

        {/* Guest share pages — public, no auth redirect */}
        <Route path={ROUTES.GUEST_ONE_LINK} element={<GuestOneLink />} />
        <Route path={ROUTES.GUEST_BUSINESS_CARD} element={<GuestBusinessCard />} />
        <Route path={ROUTES.GUEST_SITE_DISH} element={<GuestSite />} />
        <Route path={ROUTES.GUEST_SITE_TABLE} element={<GuestSite />} />
        <Route path={ROUTES.GUEST_SITE_PAGE} element={<GuestSite />} />
        <Route path={ROUTES.GUEST_SITE} element={<GuestSite />} />

        <Route path={ROUTES.RESTAURANT_SETUP} element={withProtection(RestaurantSetup, WIZARD_ONLY)} />
        <Route path={ROUTES.DOMAIN} element={withProtection(Domain, WIZARD_ONLY)} />
        <Route path={ROUTES.BRAND} element={withProtection(Brand, WIZARD_ONLY)} />
        <Route path={ROUTES.LAUNCH} element={withProtection(Launch, WIZARD_ONLY)} />
        <Route
          path={ROUTES.ONBOARDING_PAYMENT}
          element={withProtection(OnboardingPayment, { onboardingOnly: true, allowPending: true })}
        />
        <Route
          path={ROUTES.PAYMENT_THANKS}
          element={withProtection(PaymentThanks, { onboardingOnly: true, allowPending: true })}
        />
        <Route
          path={ROUTES.AWAITING_APPROVAL}
          element={<Navigate to={ROUTES.DASHBOARD} replace />}
        />
        <Route
          path={ROUTES.SETUP_REVIEW}
          element={<Navigate to={ROUTES.DASHBOARD} replace />}
        />
        <Route path={ROUTES.GO_LIVE} element={withProtection(GoLive, WIZARD_ONLY)} />
        <Route path={ROUTES.DASHBOARD} element={withProtection(Dashboard, LIVE_ONLY)} />
        <Route path={ROUTES.RESTAURANT_PROFILE} element={withProtection(RestaurantProfile, LIVE_ONLY)} />
        <Route path={ROUTES.DIRECTORY_LISTINGS} element={withProtection(DirectoryListings, LIVE_ONLY)} />
        <Route path={ROUTES.DIGITAL_BUSINESS_CARD} element={withProtection(DigitalBusinessCard, LIVE_ONLY)} />
        <Route path={ROUTES.BUSINESS_ID} element={withProtection(BusinessId, LIVE_ONLY)} />
        <Route path={ROUTES.DIGITAL_IDENTITY} element={withProtection(DigitalIdentity, LIVE_ONLY)} />
        <Route path={ROUTES.DIGITAL_IDENTITY_FORM} element={withProtection(DigitalIdentityForm, LIVE_ONLY)} />
        <Route path={ROUTES.MOBILE_APP} element={withProtection(MobileApplication, LIVE_ONLY)} />
        <Route path={ROUTES.ONE_LINK} element={withProtection(OneLink, LIVE_ONLY)} />
        <Route path={ROUTES.MENU} element={withProtection(Menu, LIVE_ONLY)} />
        <Route path={ROUTES.ORDERS} element={withProtection(Orders, LIVE_ONLY)} />
        <Route path={ROUTES.RESERVATIONS} element={withProtection(Reservations, LIVE_ONLY)} />
        <Route path={ROUTES.TABLES} element={withProtection(Tables, LIVE_ONLY)} />
        <Route path={ROUTES.STAFF} element={withProtection(Staff, LIVE_ONLY)} />
        <Route path={ROUTES.CUSTOMERS} element={withProtection(Customers, LIVE_ONLY)} />
        <Route path={ROUTES.ROLE_PERMISSIONS} element={withProtection(RolePermissions, LIVE_ONLY)} />
        <Route path={ROUTES.ANALYTICS} element={withProtection(Analytics, LIVE_ONLY)} />
        <Route path={ROUTES.PAYMENTS} element={withProtection(Payments, LIVE_ONLY)} />
        <Route path={ROUTES.MARKETING} element={withProtection(Marketing, LIVE_ONLY)} />
        <Route path={ROUTES.REVIEWS} element={withProtection(Reviews, LIVE_ONLY)} />
        <Route path={ROUTES.POS_INTEGRATION} element={withProtection(PosIntegration, LIVE_ONLY)} />
        <Route path={ROUTES.NOTIFICATIONS} element={withProtection(Notifications, LIVE_ONLY)} />
        <Route path={ROUTES.SETTINGS} element={withProtection(Settings, LIVE_ONLY)} />
        <Route
          path={ROUTES.SETTINGS_EMAIL}
          element={<Navigate to={ROUTES.PLATFORM_SETTINGS_EMAIL} replace />}
        />
        <Route
          path={ROUTES.SETTINGS_PAYMENT}
          element={<Navigate to={ROUTES.PLATFORM_SETTINGS_PAYMENT} replace />}
        />
        <Route path={ROUTES.SETTINGS_USERS} element={withProtection(SettingsUsers, LIVE_ONLY)} />
        <Route path={ROUTES.SETTINGS_BILLING} element={withProtection(SettingsBilling, LIVE_ONLY)} />
        <Route path={ROUTES.SETTINGS_SECURITY} element={withProtection(SettingsSecurity, LIVE_ONLY)} />
        <Route path={ROUTES.SETTINGS_API_KEYS} element={withProtection(SettingsApiKeys, LIVE_ONLY)} />
        <Route path={ROUTES.SETTINGS_BACKUP} element={withProtection(SettingsBackup, LIVE_ONLY)} />
        <Route path={ROUTES.SETTINGS_AUDIT} element={withProtection(SettingsAudit, LIVE_ONLY)} />
        <Route path={ROUTES.SETTINGS_PRIVACY} element={withProtection(SettingsPrivacy, LIVE_ONLY)} />
        <Route path={ROUTES.PLATFORM_ADMIN} element={withProtection(PlatformAdmin, { adminOnly: true })} />
        <Route path={ROUTES.PLATFORM_PLANS} element={withProtection(PlatformPlans, { adminOnly: true })} />
        <Route
          path={ROUTES.PLATFORM_CUSTOMERS}
          element={withProtection(PlatformCustomers, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_CUSTOMER_ONBOARDING}
          element={withProtection(PlatformCustomerOnboarding, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_APPROVE}
          element={<Navigate to={ROUTES.PLATFORM_ACCOUNT_APPROVE} replace />}
        />
        <Route path={ROUTES.PLATFORM_APPROVE_PROFILE} element={<RedirectLegacyApproveProfile />} />
        <Route
          path={ROUTES.PLATFORM_ACCOUNT_APPROVE}
          element={withProtection(PlatformAccountApprove, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_ACCOUNT_APPROVE_PROFILE}
          element={withProtection(PlatformAccountApproveProfile, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_IDENTITIES}
          element={withProtection(PlatformIdentityReview, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_PRODUCTS}
          element={withProtection(PlatformProducts, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_NOTIFICATIONS}
          element={withProtection(PlatformNotifications, { adminOnly: true })}
        />
        <Route path={ROUTES.PLATFORM_AUDIT} element={withProtection(PlatformAudit, { adminOnly: true })} />
        <Route path={ROUTES.PLATFORM_STAFF} element={withProtection(PlatformStaff, { adminOnly: true })} />
        <Route
          path={ROUTES.PLATFORM_PROFESSIONAL}
          element={withProtection(PlatformProfessional, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_SETTINGS}
          element={withProtection(PlatformSettings, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_SETTINGS_EMAIL}
          element={withProtection(EmailSettings, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_SETTINGS_PAYMENT}
          element={withProtection(PaymentSettings, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_SETTINGS_GOOGLE}
          element={withProtection(GoogleAuthSettings, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_SETTINGS_CATEGORIES}
          element={withProtection(BusinessCategoriesSettings, { adminOnly: true })}
        />
        <Route
          path={ROUTES.PLATFORM_SETTINGS_FLAGS}
          element={withProtection(PlatformFeatureFlags, { adminOnly: true })}
        />

        <Route path={ROUTES.UNAUTHORIZED} element={<Unauthorized />} />
        <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
        <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
      </Routes>
    </Suspense>
  )
}
