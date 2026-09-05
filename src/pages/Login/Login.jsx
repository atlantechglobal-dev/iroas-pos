import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { isValidEmail } from '../../utils/validation.js'
import { ROUTES } from '../../constants/routes.js'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

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
            RESTAURANT OS
          </div>

          <h1>
            Run your restaurant,
            <br />
            beautifully.
          </h1>

          <p className="description">
            IROAS gives you a modern ordering site, kitchen display, staff
            tools and analytics — all from one login.
          </p>

          <ul className="features">
            <li>
              <span className="check">✓</span>
              <span>Menu, orders & tables in one dashboard</span>
            </li>

            <li>
              <span className="check">✓</span>
              <span>Branded ordering website in minutes</span>
            </li>

            <li>
              <span className="check">✓</span>
              <span>QR codes, KDS and analytics built in</span>
            </li>

            <li>
              <span className="check">✓</span>
              <span>Payments, reviews & marketing tools</span>
            </li>
          </ul>

          <div className="testimonial">
            <p>
              "IROAS cut our onboarding to a single afternoon. Orders, QR
              menus and staff scheduling just work."
            </p>

            <div className="user">
              <div className="avatar">AK</div>

              <div>
                <strong>Aarav Kapoor</strong>
                <span>Owner, Saffron & Fig</span>
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
            <p>Sign in to manage your restaurant.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* EMAIL */}
            <div className="form-group">
              <label htmlFor="email">EMAIL OR USERNAME</label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="/images/msg.svg" alt="" />
                </span>

                <input
                  type="email"
                  id="email"
                  placeholder="you@restaurant.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
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

              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="/images/lock.svg" alt="" />
                </span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
