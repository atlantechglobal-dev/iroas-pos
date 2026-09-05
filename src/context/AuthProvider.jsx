import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './authContext.js'
import { ROUTES } from '../constants/routes.js'
import { isAdmin } from '../constants/roles.js'
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

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
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
      .then(({ user: freshUser }) => {
        if (cancelled) return
        setUser(freshUser)
        setSession(token, freshUser)
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
        await restaurantApi.get()
        navigate(ROUTES.DASHBOARD, { replace: true })
      } catch {
        navigate(ROUTES.DASHBOARD, { replace: true })
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
      initializing,
      login,
      logout,
      setUser,
    }),
    [user, initializing, login, logout],
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
