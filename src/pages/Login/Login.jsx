import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { isValidEmail } from '../../utils/validation.js'
import { ROUTES } from '../../constants/routes.js'
import { getBusinessCopy } from '../../constants/businessCopy.js'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [flash, setFlash] = useState('')
  const copy = getBusinessCopy('Other')

  useEffect(() => {
    const msg = sessionStorage.getItem('login_flash')
    if (msg) {
      setFlash(msg)
      sessionStorage.removeItem('login_flash')
    }
  }, [])

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

    try {
      await login({ email: email.trim(), password })
      toast.success('Signed in successfully.')
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
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
          </div>

          {flash ? (
            <div className="login-flash" role="status">
              <span>✓</span>
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
              onClick={() => handleSocialLogin('Google')}
            >
              <span className="google-icon"></span>
              Google
            </button>

            <button
              className="social-button"
              onClick={() => handleSocialLogin('Apple')}
            >
              <span className="apple-icon"></span>
              Apple
            </button>
          </div>

          {/* SIGN UP */}
          <p className="signup">
            Don't have an account?
            <button onClick={() => navigate(ROUTES.CREATE_ACCOUNT)}>
              Create one
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default Login
