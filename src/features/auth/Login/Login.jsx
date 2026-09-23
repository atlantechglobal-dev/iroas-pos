import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/shared/hooks/useAuth'
import { useGoogleSignIn } from '@/shared/hooks/useGoogleSignIn'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { isValidEmail } from '@/shared/utils/validation'
import { ROUTES } from '@/shared/constants/routes'
import { getBusinessCopy } from '@/shared/constants/businessCopy'
import { api } from '@/shared/lib/api'
import { prefetchRoute, prefetchWhenIdle } from '@/shared/lib/routePrefetch'
import '@/features/auth/Login/Login.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle } = useAuth()
  const toast = useToast()
  const redirectTo = location.state?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [flash, setFlash] = useState('')
  const [flashTone, setFlashTone] = useState('ok')
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

  const handleGoogleIdToken = useCallback(
    async (idToken) => {
      setGoogleLoading(true)
      setError('')
      try {
        const loggedInUser = await loginWithGoogle(idToken, redirectTo)
        if (loggedInUser) toast.success('Signed in with Google.')
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

  const { gisHostRef, trigger: triggerGoogle } = useGoogleSignIn(handleGoogleIdToken)

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

  const handleSocialLogin = (provider) => {
    if (provider === 'Google') {
      triggerGoogle((message) => toast.info(message))
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
              <span className="google-icon" aria-hidden="true">
                <svg viewBox="0 0 18 18" width="18" height="18">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                  />
                </svg>
              </span>
              {googleLoading ? 'Signing in…' : 'Google'}
            </button>

            <button
              className="social-button"
              type="button"
              onClick={() => handleSocialLogin('Apple')}
            >
              <span className="apple-icon" aria-hidden="true">
                <svg viewBox="0 0 384 512" width="16" height="16" fill="#000">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                </svg>
              </span>
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
