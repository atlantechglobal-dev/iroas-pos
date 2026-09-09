import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './authContext.js'
import { ROUTES } from '../constants/routes.js'
import { isAdmin } from '../constants/roles.js'
import { canUseDashboard } from '../constants/restaurantStatus.js'
import { authApi, setUnauthorizedHandler } from '../services/api/index.js'
import { restaurantApi } from '../services/api/restaurantApi.js'
import {
  clearSession,
  getStoredUser,
  getToken,
  setSession,
} from '../services/storage/authStorage.js'

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => getStoredUser())
  const [initializing, setInitializing] = useState(Boolean(getToken()))
  // null = unknown/not fetched yet (e.g. admin, or not loaded).
  const [restaurantStatus, setRestaurantStatus] = useState(null)

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setRestaurantStatus(null)
    navigate(ROUTES.LOGIN, { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      setUser(null)
      navigate(ROUTES.LOGIN, { replace: true })
    })
  }, [navigate])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setInitializing(false)
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
            if (!cancelled) setRestaurantStatus(restaurant?.status || 'onboarding')
          } catch {
            if (!cancelled) setRestaurantStatus('onboarding')
          }
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
  }, [])

  const login = useCallback(
    async (credentials) => {
      const { token, user: loggedInUser } = await authApi.login(credentials)
      setSession(token, loggedInUser)
      setUser(loggedInUser)

      if (isAdmin(loggedInUser)) {
        navigate(ROUTES.PLATFORM_ADMIN, { replace: true })
        return loggedInUser
      }

      try {
        const { restaurant } = await restaurantApi.get()
        const status = restaurant?.status || 'onboarding'
        setRestaurantStatus(status)
        navigate(canUseDashboard(status) ? ROUTES.DASHBOARD : ROUTES.RESTAURANT_SETUP, {
          replace: true,
        })
      } catch {
        setRestaurantStatus('onboarding')
        navigate(ROUTES.RESTAURANT_SETUP, { replace: true })
      }

      return loggedInUser
    },
    [navigate],
  )

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && getToken()),
      isAdmin: isAdmin(user),
      restaurantStatus,
      initializing,
      login,
      logout,
      setUser,
      setRestaurantStatus,
    }),
    [user, restaurantStatus, initializing, login, logout],
  )

  if (initializing) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        Loading…
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
