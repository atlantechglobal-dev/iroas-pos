import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './authContext.js'
import { ROUTES } from '../constants/routes.js'
import { isAdmin } from '../constants/roles.js'
import {
  canUseDashboard,
  ownerHomePath,
} from '../constants/restaurantStatus.js'
import { authApi, setUnauthorizedHandler } from '../services/api/index.js'
import { restaurantApi } from '../services/api/restaurantApi.js'
import {
  clearSession,
  getStoredUser,
  getToken,
  setSession,
} from '../services/storage/authStorage.js'
import { prefetchRoutes, prefetchWhenIdle } from '../lib/routePrefetch.js'

function readAwaiting(restaurant) {
  return Boolean(restaurant?.settings?.awaitingAccountApproval)
}

function readOnboardingPaid(restaurant) {
  return Boolean(restaurant?.settings?.onboardingPayment?.paid)
}

function resolvePostLoginPath(status, redirectTo, restaurant) {
  const awaiting = readAwaiting(restaurant)
  const onboardingPaid = readOnboardingPaid(restaurant)
  if (awaiting) return ROUTES.ACCOUNT_THANKS

  if (redirectTo && typeof redirectTo === 'string' && redirectTo.startsWith('/')) {
    if (canUseDashboard(status)) {
      if (redirectTo.startsWith('/c/') || redirectTo.startsWith('/s/') || redirectTo.startsWith('/l/')) {
        return ROUTES.BUSINESS_ID
      }
      return redirectTo
    }
    if (redirectTo === ROUTES.DASHBOARD || redirectTo.startsWith('/settings')) {
      return ownerHomePath(status, { awaitingAccountApproval: awaiting, onboardingPaid })
    }
  }

  return ownerHomePath(status, { awaitingAccountApproval: awaiting, onboardingPaid })
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => getStoredUser())
  const [initializing, setInitializing] = useState(Boolean(getToken()))
  // null = unknown/not fetched yet (e.g. admin, or not loaded).
  const [restaurantStatus, setRestaurantStatus] = useState(null)
  const [awaitingAccountApproval, setAwaitingAccountApproval] = useState(false)
  const [onboardingPaid, setOnboardingPaid] = useState(false)

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setRestaurantStatus(null)
    setAwaitingAccountApproval(false)
    setOnboardingPaid(false)
    navigate(ROUTES.LOGIN, { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      setUser(null)
      setAwaitingAccountApproval(false)
      setOnboardingPaid(false)
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
            setRestaurantStatus(restaurant?.status || 'onboarding')
            setAwaitingAccountApproval(awaiting)
            setOnboardingPaid(paid)
            if (awaiting) {
              clearSession()
              setUser(null)
              setRestaurantStatus(null)
              setAwaitingAccountApproval(false)
              setOnboardingPaid(false)
              try {
                sessionStorage.setItem(
                  'login_flash',
                  'Your account is not approved yet. Once an admin approves it, you will be able to sign in.',
                )
              } catch {
                /* ignore */
              }
              navigate(ROUTES.LOGIN, { replace: true })
            } else if (paid || canUseDashboard(restaurant?.status)) {
              prefetchWhenIdle(['dashboard'])
            } else {
              prefetchWhenIdle(['restaurantSetup', 'onboardingPayment', 'dashboard'])
            }
          } catch {
            if (!cancelled) {
              setRestaurantStatus('onboarding')
              setAwaitingAccountApproval(false)
              setOnboardingPaid(false)
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
        prefetchRoutes(['platformAdmin'])
        navigate(ROUTES.PLATFORM_ADMIN, { replace: true })
        return loggedInUser
      }

      try {
        const { restaurant } = await restaurantApi.get()
        const status = restaurant?.status || 'onboarding'
        const awaiting = readAwaiting(restaurant)
        const paid = readOnboardingPaid(restaurant)
        setRestaurantStatus(status)
        setAwaitingAccountApproval(awaiting)
        setOnboardingPaid(paid)
        const path = resolvePostLoginPath(status, redirectTo, restaurant)
        if (path === ROUTES.ACCOUNT_THANKS || awaiting) {
          clearSession()
          setUser(null)
          setRestaurantStatus(null)
          setAwaitingAccountApproval(false)
          setOnboardingPaid(false)
          const err = new Error(
            'Your account is not approved yet. Once an admin approves it, you will be able to sign in.',
          )
          err.code = 'ACCOUNT_PENDING_APPROVAL'
          throw err
        }
        if (path === ROUTES.DASHBOARD || paid || canUseDashboard(status)) {
          prefetchRoutes(['dashboard'])
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
      const { token, user: loggedInUser } = await authApi.googleLogin(idToken)
      return completeLogin(token, loggedInUser, redirectTo)
    },
    [completeLogin],
  )

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && getToken()),
      isAdmin: isAdmin(user),
      restaurantStatus,
      awaitingAccountApproval,
      onboardingPaid,
      initializing,
      login,
      loginWithGoogle,
      logout,
      setUser,
      setRestaurantStatus,
      setAwaitingAccountApproval,
      setOnboardingPaid,
    }),
    [
      user,
      restaurantStatus,
      awaitingAccountApproval,
      onboardingPaid,
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
