import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ProtectedRoute } from '@/app/routes/ProtectedRoute'
import { PublicRoute } from '@/app/routes/PublicRoute'
import { platformAccountApproveProfilePath, ROUTES } from '@/shared/constants/routes'

/* Eager entry pages — login ↔ signup ↔ thanks should not wait on Suspense */
import Login from '@/features/auth/Login/Login'
import CreateAccount from '@/features/auth/CreateAccount/CreateAccount'
import AccountThanks from '@/features/auth/AccountThanks/AccountThanks'

const ForgotPassword = lazy(() => import('@/features/auth/ForgotPassword/ForgotPassword'))
const AccountRecovery = lazy(() => import('@/features/auth/AccountRecovery/AccountRecovery'))
const NewPassword = lazy(() => import('@/features/auth/NewPassword/NewPassword'))
const PasswordUpdated = lazy(() => import('@/features/auth/PasswordUpdated/PasswordUpdated'))
const RestaurantSetup = lazy(() => import('@/features/onboarding/RestaurantSetup/RestaurantSetup'))
const Domain = lazy(() => import('@/features/onboarding/Domain/Domain'))
const Brand = lazy(() => import('@/features/onboarding/Brand/Brand'))
const Launch = lazy(() => import('@/features/onboarding/Launch/Launch'))
const OnboardingPayment = lazy(() => import('@/features/onboarding/OnboardingPayment/OnboardingPayment'))
const PaymentThanks = lazy(() => import('@/features/onboarding/OnboardingPayment/PaymentThanks'))
const GoLive = lazy(() => import('@/features/onboarding/GoLive/GoLive'))
const Dashboard = lazy(() => import('@/features/dashboard/Dashboard/Dashboard'))
const RestaurantProfile = lazy(() => import('@/features/dashboard/RestaurantProfile/RestaurantProfile'))
const DirectoryListings = lazy(() => import('@/features/dashboard/DirectoryListings/DirectoryListings'))
const DigitalBusinessCard = lazy(() => import('@/features/dashboard/DigitalBusinessCard/DigitalBusinessCard'))
const BusinessId = lazy(() => import('@/features/dashboard/BusinessId/BusinessId'))
const DigitalIdentity = lazy(() => import('@/features/dashboard/DigitalIdentity/DigitalIdentity'))
const DigitalIdentityForm = lazy(() => import('@/features/dashboard/DigitalIdentity/DigitalIdentityForm'))
const MobileApplication = lazy(() => import('@/features/dashboard/MobileApplication/MobileApplication'))
const OneLink = lazy(() => import('@/features/dashboard/OneLink/OneLink'))
const GuestOneLink = lazy(() => import('@/features/guest/GuestOneLink/GuestOneLink'))
const GuestBusinessCard = lazy(() => import('@/features/guest/GuestBusinessCard/GuestBusinessCard'))
const GuestSite = lazy(() => import('@/features/guest/GuestSite/GuestSite'))
const PlatformAdmin = lazy(() => import('@/features/platform-admin/PlatformAdmin/PlatformAdmin'))
const PlatformPlans = lazy(() => import('@/features/platform-admin/PlatformAdmin/Plans'))
const PlatformCustomers = lazy(() => import('@/features/platform-admin/PlatformAdmin/PlatformCustomers'))
const PlatformCustomerOnboarding = lazy(
  () => import('@/features/platform-admin/PlatformAdmin/CustomerOnboarding'),
)
const PlatformAccountApprove = lazy(() => import('@/features/platform-admin/PlatformAdmin/AccountApprove'))
const PlatformAccountApproveProfile = lazy(
  () => import('@/features/platform-admin/PlatformAdmin/AccountApproveProfile'),
)

function RedirectLegacyApproveProfile() {
  const { tenantId } = useParams()
  return <Navigate to={platformAccountApproveProfilePath(tenantId)} replace />
}
const PlatformIdentityReview = lazy(() => import('@/features/platform-admin/PlatformAdmin/IdentityReview'))
const PlatformProducts = lazy(() => import('@/features/platform-admin/PlatformAdmin/ProductsAdmin'))
const PlatformNotifications = lazy(
  () => import('@/features/platform-admin/PlatformAdmin/PlatformNotifications'),
)
const PlatformAudit = lazy(() => import('@/features/platform-admin/PlatformAdmin/PlatformAudit'))
const PlatformStaff = lazy(() => import('@/features/platform-admin/PlatformAdmin/PlatformStaff'))
const PlatformProfessional = lazy(
  () => import('@/features/platform-admin/PlatformAdmin/PlatformProfessional'),
)
const PlatformSettings = lazy(() => import('@/features/platform-admin/PlatformAdmin/PlatformSettings'))
const PlatformFeatureFlags = lazy(() => import('@/features/platform-admin/PlatformAdmin/FeatureFlags'))
const Menu = lazy(() => import('@/features/dashboard/Menu/Menu'))
const Orders = lazy(() => import('@/features/dashboard/Orders/Orders'))
const Reservations = lazy(() => import('@/features/dashboard/Reservations/Reservations'))
const Tables = lazy(() => import('@/features/dashboard/Tables/Tables'))
const Staff = lazy(() => import('@/features/dashboard/Staff/Staff'))
const Customers = lazy(() => import('@/features/dashboard/Customers/Customers'))
const RolePermissions = lazy(() => import('@/features/dashboard/RolePermissions/RolePermissions'))
const Analytics = lazy(() => import('@/features/dashboard/Analytics/Analytics'))
const Payments = lazy(() => import('@/features/dashboard/Payments/Payments'))
const Marketing = lazy(() => import('@/features/dashboard/Marketing/Marketing'))
const Reviews = lazy(() => import('@/features/dashboard/Reviews/Reviews'))
const PosIntegration = lazy(() => import('@/features/dashboard/PosIntegration/PosIntegration'))
const Notifications = lazy(() => import('@/features/dashboard/Notifications/Notifications'))
const Settings = lazy(() => import('@/features/dashboard/Settings/Settings'))
const EmailSettings = lazy(() => import('@/features/dashboard/Settings/EmailSettings'))
const PaymentSettings = lazy(() => import('@/features/dashboard/Settings/PaymentSettings'))
const GoogleAuthSettings = lazy(() => import('@/features/dashboard/Settings/GoogleAuthSettings'))
const BusinessCategoriesSettings = lazy(
  () => import('@/features/platform-admin/PlatformAdmin/BusinessCategoriesSettings'),
)
const SettingsUsers = lazy(() =>
  import('@/features/dashboard/Settings/SettingsPreview').then((m) => ({ default: m.SettingsUsers })),
)
const SettingsBilling = lazy(() =>
  import('@/features/dashboard/Settings/SettingsPreview').then((m) => ({ default: m.SettingsBilling })),
)
const SettingsSecurity = lazy(() =>
  import('@/features/dashboard/Settings/SettingsPreview').then((m) => ({ default: m.SettingsSecurity })),
)
const SettingsApiKeys = lazy(() =>
  import('@/features/dashboard/Settings/SettingsPreview').then((m) => ({ default: m.SettingsApiKeys })),
)
const SettingsBackup = lazy(() =>
  import('@/features/dashboard/Settings/SettingsPreview').then((m) => ({ default: m.SettingsBackup })),
)
const SettingsAudit = lazy(() =>
  import('@/features/dashboard/Settings/SettingsPreview').then((m) => ({ default: m.SettingsAudit })),
)
const SettingsPrivacy = lazy(() =>
  import('@/features/dashboard/Settings/SettingsPreview').then((m) => ({ default: m.SettingsPrivacy })),
)
const NotFound = lazy(() => import('@/features/system/NotFound/NotFound'))
const Unauthorized = lazy(() => import('@/features/system/Unauthorized/Unauthorized'))

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
