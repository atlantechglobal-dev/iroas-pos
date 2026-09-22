import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { isValidEmail } from '../../utils/validation.js'
import { ROUTES } from '../../constants/routes.js'
import { getBusinessCopy } from '../../constants/businessCopy.js'
import { api } from '../../lib/api'
import { prefetchRoute, prefetchWhenIdle } from '../../lib/routePrefetch.js'
import './Login.css'

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')))
      if (window.google?.accounts?.id) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })
}

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle } = useAuth()
  const toast = useToast()
  const redirectTo = location.state?.from
  const gisHostRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [flash, setFlash] = useState('')
  const [flashTone, setFlashTone] = useState('ok')
  const [googleConfig, setGoogleConfig] = useState({ enabled: false, clientId: '' })
  const [gisReady, setGisReady] = useState(false)
  const copy = getBusinessCopy('Other')

  useEffect(() => {
    const msg = sessionStorage.getItem('login_flash')
    if (msg) {
      setFlash(msg)
      setFlashTone(/not approved/i.test(msg) ? 'warn' : 'ok')
      sessionStorage.removeItem('login_flash')
    }
    prefetchWhenIdle(['createAccount', 'accountThanks', 'restaurantSetup', 'dashboard'])
  }, [])

  const handleGoogleCredential = useCallback(
    async (response) => {
      const idToken = response?.credential
      if (!idToken) {
        toast.error('Google did not return a sign-in token.')
        return
      }
      setGoogleLoading(true)
      setError('')
      try {
        await loginWithGoogle(idToken, redirectTo)
        toast.success('Signed in with Google.')
      } catch (err) {
        const message = err.message || 'Google sign-in failed.'
        if (/not approved/i.test(message) || err.code === 'ACCOUNT_PENDING_APPROVAL') {
          setError('')
          setFlash(message)
          setFlashTone('warn')
        } else {
          setFlash('')
          setError(message)
          toast.error(message)
        }
      } finally {
        setGoogleLoading(false)
      }
    },
    [loginWithGoogle, redirectTo, toast],
  )

  useEffect(() => {
    let cancelled = false
    api
      .googleConfig()
      .then(async (cfg) => {
        if (cancelled) return
        const next = {
          enabled: Boolean(cfg.configured || (cfg.enabled && cfg.clientId)),
          clientId: cfg.clientId || '',
        }
        setGoogleConfig(next)
        if (!next.enabled) return
        await loadGoogleScript()
        if (cancelled || !window.google?.accounts?.id) return
        window.google.accounts.id.initialize({
          client_id: next.clientId,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        if (gisHostRef.current) {
          gisHostRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(gisHostRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: 280,
          })
        }
        setGisReady(true)
      })
      .catch(() => {
        if (!cancelled) setGoogleConfig({ enabled: false, clientId: '' })
      })
    return () => {
      cancelled = true
    }
  }, [handleGoogleCredential])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const nextErrors = { email: '', password: '' }

    if (!email.trim()) nextErrors.email = 'Email is required.'
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Password is required.'
    setErrors(nextErrors)
    if (nextErrors.email || nextErrors.password) return

    setLoading(true)
    setFlash('')

    try {
      await login({ email: email.trim(), password }, redirectTo)
      toast.success('Signed in successfully.')
    } catch (err) {
      const message = err.message || 'Unable to sign in.'
      if (/not approved/i.test(message) || err.code === 'ACCOUNT_PENDING_APPROVAL') {
        setError('')
        setFlash(message)
        setFlashTone('warn')
      } else {
        setFlash('')
        setError(message)
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field) => (event) => {
    const value = event.target.value
    if (field === 'email') setEmail(value)
    else setPassword(value)
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
    if (error) setError('')
  }

  const handleForgotPassword = () => {
    if (email.trim()) {
      navigate(ROUTES.FORGOT_PASSWORD, { state: { email } })
    } else {
      navigate(ROUTES.FORGOT_PASSWORD)
    }
  }

  const handleGoogleLogin = () => {
    if (!googleConfig.enabled) {
      toast.info('Google sign-in is not configured. Ask an admin to add the Client ID.')
      return
    }
    if (!gisReady) {
      toast.info('Google Sign-In is still loading. Try again in a moment.')
      return
    }
    const btn = gisHostRef.current?.querySelector('div[role="button"]')
    if (btn) {
      btn.click()
      return
    }
    window.google?.accounts?.id?.prompt()
  }

  const handleSocialLogin = (provider) => {
    if (provider === 'Google') {
      handleGoogleLogin()
      return
    }
    toast.info(`${provider} sign-in is not available yet.`)
  }

  return (
    <main className="login-page">
      {/* LEFT SIDE */}
      <section className="brand-section">
        <div className="brand-content">
          <div className="logo">
            <img src="/images/logo.svg.svg" alt="IROAS Logo" />
          </div>
          <div className="badge">
            <img src="/images/security.svg" alt="Restaurant OS" />
            BUSINESS OS
          </div>

          <h1>
            Run your business,
            <br />
            beautifully.
          </h1>

          <p className="description">
            IROAS gives you a modern website, customer tools, payments and
            analytics — all from one login.
          </p>

          <ul className="features">
            {copy.signupDeliverables.map((item) => (
              <li key={item}>
                <span className="check">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="testimonial">
            <p>{copy.signupQuote}</p>

            <div className="user">
              <div className="avatar">{copy.signupPersonInitials}</div>

              <div>
                <strong>{copy.signupPersonName}</strong>
                <span>{copy.signupPersonRole}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="login-section">
        <div className="login-container">
          <div className="login-header">
            <h2>Welcome back</h2>
            <p>Sign in to manage your business.</p>
            {redirectTo === ROUTES.BUSINESS_ID ? (
              <p className="login-context-note">
                You&apos;ll return to your Business ID editor to update your live card.
              </p>
            ) : null}
          </div>

          {flash ? (
            <div className={`login-flash${flashTone === 'warn' ? ' is-warn' : ''}`} role="status">
              <span>{flashTone === 'warn' ? '!' : '✓'}</span>
              <p>{flash}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            {/* EMAIL */}
            <div className="form-group">
              <label htmlFor="email">EMAIL OR USERNAME</label>

              <div className={`input-wrapper ${errors.email ? 'error' : ''}`}>
                <span className="input-icon">
                  <img src="/images/msg.svg" alt="" />
                </span>

                <input
                  type="email"
                  id="email"
                  placeholder="you@yourbusiness.com"
                  value={email}
                  onChange={updateField('email')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  required
                />
              </div>
              {errors.email ? <p className="field-error" id="login-email-error">{errors.email}</p> : null}
            </div>

            {/* PASSWORD */}
            <div className="form-group">
              <div className="password-label">
                <label htmlFor="password">PASSWORD</label>

                <button
                  type="button"
                  className="forgot"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              <div className={`input-wrapper ${errors.password ? 'error' : ''}`}>
                <span className="input-icon">
                  <img src="/images/lock.svg" alt="" />
                </span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={updateField('password')}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  required
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <img src="/images/eyee.svg" alt="" />
                </button>
              </div>
              {errors.password ? <p className="field-error" id="login-password-error">{errors.password}</p> : null}
            </div>

            {/* REMEMBER */}
            <label className="remember">
              <input type="checkbox" defaultChecked />
              <span>Remember me on this device</span>
            </label>

            {error && <p className="form-error">{error}</p>}

            {/* LOGIN BUTTON */}
            <button type="submit" className="signin-button" disabled={loading}>
              <span>
                <img src="/images/arrow.svg" alt="" />
              </span>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* DIVIDER */}
          <div className="divider">
            <span></span>
            <p>OR CONTINUE WITH</p>
            <span></span>
          </div>

          {/* SOCIAL LOGIN */}
          <div className="social-buttons">
            <button
              className="social-button"
              type="button"
              disabled={googleLoading || loading}
              onClick={() => handleSocialLogin('Google')}
            >
              <span className="google-icon"></span>
              {googleLoading ? 'Signing in…' : 'Google'}
            </button>

            <button
              className="social-button"
              type="button"
              onClick={() => handleSocialLogin('Apple')}
            >
              <span className="apple-icon"></span>
              Apple
            </button>
          </div>
          <div
            ref={gisHostRef}
            className="gis-button-host"
            aria-hidden="true"
          />

          {/* SIGN UP */}
          <p className="signup">
            Don't have an account?
            <button
              type="button"
              onMouseEnter={() => prefetchRoute('createAccount')}
              onFocus={() => prefetchRoute('createAccount')}
              onClick={() => navigate(ROUTES.CREATE_ACCOUNT)}
            >
              Create one
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default Login
