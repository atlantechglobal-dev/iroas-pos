import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import './ForgotPassword.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ForgotPassword() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    setError('')
    setSuccess(false)

    const trimmed = email.trim()

    if (trimmed === '') {
      setError('Please enter your email address.')
      return
    }

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)

    try {
      const { resetToken } = await api.forgotPassword(trimmed)
      setSuccess(true)
      setEmail('')
      navigate('/account-recovery', { state: { email: trimmed, resetToken } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="forgot-password-page">
      {/* LEFT SIDE */}
      <section className="left-panel">
        <div className="logo">
          <img src="/images/logo.svg.svg" alt="IROAS Logo" />
        </div>

        <div className="brand">
          <span>
            <img src="/images/security.svg" alt="" />
            ACCOUNT RECOVERY
          </span>
        </div>

        <div className="left-content">
          <h1>Back in, in one click.</h1>

          <p className="description">
            We'll email you a secure link that signs you in and lets you
            choose a new password.
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
        </div>

        {/* TESTIMONIAL */}
        <div className="testimonial">
          <p>
            "IROAS cut our onboarding to a single afternoon. Orders, QR menus
            and staff scheduling just work."
          </p>

          <div className="author">
            <div className="avatar">AK</div>

            <div>
              <strong>Arun Kapoor</strong>
              <span>Owner, Kashi & Fig</span>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="right-panel">
        <div className="form-container">
          <h2>Forgot password</h2>

          <p className="form-description">
            We'll send a reset link to your email.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">EMAIL</label>

            <div className="input-wrapper">
              <span className="email-icon">
                <img src="/images/msg.svg" alt="" />
              </span>

              <input
                type="email"
                id="email"
                placeholder="you@restaurant.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {error && <p className="error-message show">{error}</p>}

            <button type="submit" className={loading ? 'loading' : ''}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <button className="back-link" onClick={() => navigate('/login')}>
            <span>
              <img src="/images/plain arrow.svg" alt="" />
            </span>
            Back to sign in
          </button>

          {success && (
            <div className="success-message show">
              ✓ Reset link sent! Check your email.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default ForgotPassword
