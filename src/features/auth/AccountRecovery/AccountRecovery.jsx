import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/auth/AccountRecovery/AccountRecovery.css'

function AccountRecovery() {
  const navigate = useNavigate()
  const location = useLocation()

  const email = location.state?.email || 'your email address'
  const previewUrl = location.state?.previewUrl || null

  const handleOpenPreview = () => {
    if (!previewUrl) return
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="account-recovery-page">
      <div className="left-side">
        <div className="logo">
          <img src="/images/logo.svg.svg" alt="IROAS Logo" />
        </div>

        <div className="left-content">
          <div className="section-label">
            <img src="/images/security.svg" alt="" />
            ACCOUNT RECOVERY
          </div>

          <h1>Back in, in one click.</h1>

          <p className="description">
            We'll email you a secure link that lets you choose a new password.
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
      </div>

      <div className="right-side">
        <div className="recovery-box">
          <div className="email-icon">
            <img src="/images/msg.svg" alt="" />
          </div>

          <h2>Check your inbox</h2>

          <p className="message">
            If an account exists for <strong>{email}</strong>, we sent a reset link. The link
            expires in 30 minutes.
          </p>

          {previewUrl ? (
            <button className="primary-button" type="button" onClick={handleOpenPreview}>
              Open email preview
            </button>
          ) : null}

          <button
            className={previewUrl ? 'secondary-button' : 'primary-button'}
            type="button"
            onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
          >
            Use a different email
          </button>

          <button className="back-button" type="button" onClick={() => navigate(ROUTES.LOGIN)}>
            <img src="/images/plain arrow.svg" alt="" />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountRecovery
