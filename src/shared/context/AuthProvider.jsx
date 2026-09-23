import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '@/shared/context/authContext'
import { ROUTES } from '@/shared/constants/routes'
import { isAdmin } from '@/shared/constants/roles'
import { businessCategoryFromRestaurant } from '@/shared/constants/businessCategory'
import {
  canUseDashboard,
  ownerHomePath,
} from '@/shared/constants/restaurantStatus'
import { authApi, setUnauthorizedHandler } from '@/shared/api/index'
import { restaurantApi } from '@/shared/api/restaurantApi'
import {
  clearSession,
  getStoredUser,
  getToken,
  setSession,
} from '@/shared/storage/authStorage'
import { prefetchRoutes, prefetchWhenIdle } from '@/shared/lib/routePrefetch'

function readAwaiting(restaurant) {
  return Boolean(restaurant?.settings?.awaitingAccountApproval)
}

function readOnboardingPaid(restaurant) {
  return Boolean(restaurant?.settings?.onboardingPayment?.paid)
}

function resolvePostLoginPath(status, redirectTo, restaurant) {
  const awaiting = readAwaiting(restaurant)
  const onboardingPaid = readOnboardingPaid(restaurant)
  const businessCategory = businessCategoryFromRestaurant(restaurant)
  const pathOpts = { awaitingAccountApproval: awaiting, onboardingPaid, businessCategory }
  if (awaiting) return ROUTES.ACCOUNT_THANKS

  if (redirectTo && typeof redirectTo === 'string' && redirectTo.startsWith('/')) {
    if (canUseDashboard(status, { businessCategory })) {
      if (redirectTo.startsWith('/c/') || redirectTo.startsWith('/s/') || redirectTo.startsWith('/l/')) {
        return ROUTES.BUSINESS_ID
      }
      return redirectTo
    }
    if (redirectTo === ROUTES.DASHBOARD || redirectTo.startsWith('/settings')) {
      return ownerHomePath(status, pathOpts)
    }
  }

  return ownerHomePath(status, pathOpts)
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => getStoredUser())
  const [initializing, setInitializing] = useState(Boolean(getToken()))
  // null = unknown/not fetched yet (e.g. admin, or not loaded).
  const [restaurantStatus, setRestaurantStatus] = useState(null)
  const [awaitingAccountApproval, setAwaitingAccountApproval] = useState(false)
  const [onboardingPaid, setOnboardingPaid] = useState(false)
  const [businessCategory, setBusinessCategory] = useState('')

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setRestaurantStatus(null)
    setAwaitingAccountApproval(false)
    setOnboardingPaid(false)
    setBusinessCategory('')
    navigate(ROUTES.LOGIN, { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      setUser(null)
      setAwaitingAccountApproval(false)
      setOnboardingPaid(false)
      setBusinessCategory('')
      navigate(ROUTES.LOGIN, { replace: true })
    })
  }, [navigate])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setInitializing(false)
      prefetchWhenIdle(['createAccount', 'accountThanks'])
      return
    }

    let cancelled = false

    authApi
      .me()
      .then(async ({ user: freshUser }) => {
        if (cancelled) return
        setUser(freshUser)
        setSession(token, freshUser)

        if (!isAdmin(freshUser)) {
          try {
            const { restaurant } = await restaurantApi.get()
            if (cancelled) return
            const awaiting = readAwaiting(restaurant)
            const paid = readOnboardingPaid(restaurant)
            const category = businessCategoryFromRestaurant(restaurant)
            setRestaurantStatus(restaurant?.status || 'onboarding')
            setAwaitingAccountApproval(awaiting)
            setOnboardingPaid(paid)
            setBusinessCategory(category)
            if (awaiting) {
              clearSession()
              setUser(null)
              setRestaurantStatus(null)
              setAwaitingAccountApproval(false)
              setOnboardingPaid(false)
              setBusinessCategory('')
              try {
                sessionStorage.setItem(
                  'login_flash',
                  'Your account is not approved yet. Once an admin approves it, you will be able to sign in.',
                )
              } catch {
                /* ignore */
              }
              navigate(ROUTES.LOGIN, { replace: true })
            } else if (paid || canUseDashboard(restaurant?.status, { businessCategory: category })) {
              prefetchWhenIdle(['dashboard'])
            } else {
              prefetchWhenIdle(['restaurantSetup', 'onboardingPayment', 'dashboard', 'digitalBusinessCard'])
            }
          } catch {
            if (!cancelled) {
              setRestaurantStatus('onboarding')
              setAwaitingAccountApproval(false)
              setOnboardingPaid(false)
              setBusinessCategory('')
            }
          }
        } else {
          prefetchWhenIdle(['platformAdmin'])
        }
      })
      .catch(() => {
        if (cancelled) return
        clearSession()
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  const completeLogin = useCallback(
    async (token, loggedInUser, redirectTo) => {
      setSession(token, loggedInUser)
      setUser(loggedInUser)

      if (isAdmin(loggedInUser)) {
        setAwaitingAccountApproval(false)
        setOnboardingPaid(false)
        setBusinessCategory('')
        prefetchRoutes(['platformAdmin'])
        navigate(ROUTES.PLATFORM_ADMIN, { replace: true })
        return loggedInUser
      }

      try {
        const { restaurant } = await restaurantApi.get()
        const status = restaurant?.status || 'onboarding'
        const awaiting = readAwaiting(restaurant)
        const paid = readOnboardingPaid(restaurant)
        const category = businessCategoryFromRestaurant(restaurant)
        setRestaurantStatus(status)
        setAwaitingAccountApproval(awaiting)
        setOnboardingPaid(paid)
        setBusinessCategory(category)
        const path = resolvePostLoginPath(status, redirectTo, restaurant)
        if (path === ROUTES.ACCOUNT_THANKS || awaiting) {
          clearSession()
          setUser(null)
          setRestaurantStatus(null)
          setAwaitingAccountApproval(false)
          setOnboardingPaid(false)
          setBusinessCategory('')
          const err = new Error(
            'Your account is not approved yet. Once an admin approves it, you will be able to sign in.',
          )
          err.code = 'ACCOUNT_PENDING_APPROVAL'
          throw err
        }
        if (path === ROUTES.DASHBOARD || paid || canUseDashboard(status, { businessCategory: category })) {
          prefetchRoutes(['dashboard'])
        } else if (path === ROUTES.DIGITAL_BUSINESS_CARD) {
          prefetchRoutes(['digitalBusinessCard'])
        } else if (path === ROUTES.ONBOARDING_PAYMENT) {
          prefetchRoutes(['onboardingPayment', 'dashboard'])
        } else {
          prefetchRoutes(['restaurantSetup', 'domain', 'brand', 'launch', 'onboardingPayment'])
        }
        navigate(path, { replace: true })
      } catch (caught) {
        if (caught?.code === 'ACCOUNT_PENDING_APPROVAL') {
          throw caught
        }
        setRestaurantStatus('onboarding')
        setAwaitingAccountApproval(false)
        setOnboardingPaid(false)
        setBusinessCategory('')
        prefetchRoutes(['restaurantSetup'])
        navigate(ROUTES.RESTAURANT_SETUP, { replace: true })
      }

      return loggedInUser
    },
    [navigate],
  )

  const login = useCallback(
    async (credentials, redirectTo) => {
      const { token, user: loggedInUser } = await authApi.login(credentials)
      return completeLogin(token, loggedInUser, redirectTo)
    },
    [completeLogin],
  )

  const loginWithGoogle = useCallback(
    async (idToken, redirectTo) => {
      const result = await authApi.googleLogin(idToken)
      // No IROAS account for this Google identity yet — send them to Create
      // account to fill in the same business details the signup form asks
      // for (restaurant, category, city, phone). The verified idToken rides
      // along so they don't have to click "Continue with Google" again.
      if (result.needsSignup) {
        navigate(ROUTES.CREATE_ACCOUNT, {
          replace: true,
          state: { googleIdToken: result.idToken, googleName: result.name, googleEmail: result.email },
        })
        return null
      }
      // A fresh signup (via CreateAccount's own Google button) goes through
      // the same account-approval gate as the email form — no token yet.
      if (result.pendingReview) {
        navigate(ROUTES.ACCOUNT_THANKS, { replace: true, state: { email: result.email } })
        return null
      }
      return completeLogin(result.token, result.user, redirectTo)
    },
    [completeLogin, navigate],
  )

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && getToken()),
      isAdmin: isAdmin(user),
      restaurantStatus,
      awaitingAccountApproval,
      onboardingPaid,
      businessCategory,
      initializing,
      login,
      loginWithGoogle,
      logout,
      setUser,
      setRestaurantStatus,
      setAwaitingAccountApproval,
      setOnboardingPaid,
      setBusinessCategory,
    }),
    [
      user,
      restaurantStatus,
      awaitingAccountApproval,
      onboardingPaid,
      businessCategory,
      initializing,
      login,
      loginWithGoogle,
      logout,
    ],
  )

  if (initializing) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="app-loading-spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
