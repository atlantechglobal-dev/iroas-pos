import { useState } from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import './NewPassword.css'

function NewPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const token =
    String(searchParams.get('token') || '').trim() ||
    String(location.state?.token || '').trim() ||
    ''
  const email =
    String(searchParams.get('email') || '').trim() ||
    String(location.state?.email || '').trim() ||
    ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [messageColor, setMessageColor] = useState('#d33')
  const [loading, setLoading] = useState(false)

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }

  const handleUpdatePassword = async () => {
    if (!token) {
      setMessageColor('#d33')
      setMessage('This reset link is missing or invalid. Please request a new one.')
      return
    }

    if (password.length < 8) {
      setMessageColor('#d33')
      setMessage('Password must contain at least 8 characters.')
      return
    }

    if (!/[A-Z]/.test(password)) {
      setMessageColor('#d33')
      setMessage('Password must contain one uppercase letter.')
      return
    }

    if (!/[a-z]/.test(password)) {
      setMessageColor('#d33')
      setMessage('Password must contain one lowercase letter.')
      return
    }

    if (!/[0-9]/.test(password)) {
      setMessageColor('#d33')
      setMessage('Password must contain one number.')
      return
    }

    if (password !== confirmPassword) {
      setMessageColor('#d33')
      setMessage('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await api.resetPassword(token, password)

      setMessageColor('#82b817')
      setMessage('Password updated successfully!')

      setTimeout(() => {
        navigate(ROUTES.PASSWORD_UPDATED)
      }, 900)
    } catch (err) {
      setMessageColor('#d33')
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="new-password-page">
      <section className="left-section">
        <div className="logo">
          <img src="/images/logo.svg.svg" alt="IROAS Logo" />
        </div>

        <div className="left-content">
          <div className="security-tag">
            <img src="/images/security.svg" alt="Security" />
            <span>Security</span>
          </div>

          <h1>Choose a new password.</h1>

          <p className="description">
            Pick something strong and unique — your dashboard holds live orders and payouts.
          </p>

          <div className="features">
            <div className="feature">
              <span className="check">✓</span>
              <span>Menu, orders & tables in one dashboard</span>
            </div>

            <div className="feature">
              <span className="check">✓</span>
              <span>Branded ordering website in minutes</span>
            </div>

            <div className="feature">
              <span className="check">✓</span>
              <span>QR codes, KDS and analytics built in</span>
            </div>

            <div className="feature">
              <span className="check">✓</span>
              <span>Payments, reviews & marketing tools</span>
            </div>
          </div>
        </div>

        <div className="testimonial">
          <p>
            "IROAS cut our onboarding to a single afternoon. Orders, QR menus and staff scheduling
            just work."
          </p>

          <div className="person">
            <div className="avatar">AK</div>

            <div>
              <strong>Aarav Kapoor</strong>
              <small>Owner, Saffron & Fig</small>
            </div>
          </div>
        </div>
      </section>

      <section className="right-section">
        <div className="password-box">
          <h2>New password</h2>

          {!token ? (
            <>
              <p className="verified">
                This reset link is missing or invalid. Request a new link to continue.
              </p>
              <Link className="update-btn" to={ROUTES.FORGOT_PASSWORD} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                Request new reset link
              </Link>
            </>
          ) : (
            <>
              <p className="verified">
                {email ? `Reset link verified for ${email}.` : 'Reset link verified. Choose a new password.'}
              </p>

              <div className="input-container">
                <span className="input-icon">
                  <img src="/images/lock.svg" alt="" />
                </span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="New password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />

                <button
                  className="eye-btn"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <img src="/images/eyee.svg" alt="" />
                </button>
              </div>

              <div className="input-container">
                <span className="input-icon">
                  <img src="/images/lock.svg" alt="" />
                </span>

                <input
                  type="password"
                  id="confirmPassword"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              <div className="requirements">
                <div className={requirements.length ? 'valid' : ''}>
                  <span>✓</span>
                  At least 8 characters
                </div>

                <div className={requirements.uppercase ? 'valid' : ''}>
                  <span>✓</span>
                  One uppercase letter
                </div>

                <div className={requirements.lowercase ? 'valid' : ''}>
                  <span>✓</span>
                  One lowercase letter
                </div>

                <div className={requirements.number ? 'valid' : ''}>
                  <span>✓</span>
                  One number
                </div>
              </div>

              <button
                className="update-btn"
                type="button"
                onClick={handleUpdatePassword}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>

              {message ? (
                <p className="update-message" style={{ color: messageColor }}>
                  {message}
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default NewPassword
