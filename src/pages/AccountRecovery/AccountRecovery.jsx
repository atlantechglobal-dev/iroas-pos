import { useNavigate, useLocation } from 'react-router-dom'
import './AccountRecovery.css'

function AccountRecovery() {
  const navigate = useNavigate()
  const location = useLocation()

  const email = location.state?.email || 'your email address'
  const resetToken = location.state?.resetToken

  const handleOpenResetLink = () => {
    if (resetToken) {
      navigate('/new-password', { state: { token: resetToken, email } })
    } else {
      alert(
        "In a live environment this link arrives by email. This demo couldn't find an account for that address.",
      )
    }
  }

  return (
    <div className="account-recovery-page">
      {/* LEFT SIDE */}
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
            We'll email you a secure link that signs you in and lets you
            choose a new password.
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

        {/* Testimonial */}
        <div className="testimonial">
          <p>
            "IROAS cut our onboarding to a single afternoon. Orders, QR menus
            and staff scheduling just work."
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

      {/* RIGHT SIDE */}
      <div className="right-side">
        <div className="recovery-box">
          <div className="email-icon">
            <img src="/images/msg.svg" alt="" />
          </div>

          <h2>Check your inbox</h2>

          <p className="message">
            We sent a reset link to <strong>{email}</strong>. The link
            expires in 30
            <br />
            minutes.
          </p>

          <button className="primary-button" onClick={handleOpenResetLink}>
            Open reset link
          </button>

          <button
            className="secondary-button"
            onClick={() => navigate('/forgot-password')}
          >
            Use a different email
          </button>

          <button className="back-button" onClick={() => navigate('/login')}>
            <img src="/images/plain arrow.svg" alt="" />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountRecovery
