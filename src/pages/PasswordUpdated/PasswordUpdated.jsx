import { useNavigate } from 'react-router-dom'
import './PasswordUpdated.css'

function PasswordUpdated() {
  const navigate = useNavigate()

  return (
    <div className="password-updated-page">
      {/* LEFT SIDE */}
      <section className="left-panel">
        <div className="logo">
          <img src="/images/logo.svg.svg" alt="IROAS Logo" />
        </div>

        <div className="left-content">
          <div className="security-badge">
            <span>
              <img src="/images/security.svg" alt="" />
            </span>{' '}
            SECURITY
          </div>

          <h1>Choose a new password.</h1>

          <p className="description">
            Pick something strong and unique — your dashboard holds live
            <br />
            orders and payouts.
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
      </section>

      {/* RIGHT SIDE */}
      <section className="right-panel">
        <div className="success-container">
          <div className="success-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3L19 6V11.5C19 16.1 16.1 20.1 12 21C7.9 20.1 5 16.1 5 11.5V6L12 3Z"></path>
              <path d="M9 12L11 14L15 10"></path>
            </svg>
          </div>

          <h2>Password updated</h2>

          <p>You can now sign in with your new password.</p>

          <button onClick={() => navigate('/login')}>Go to sign in</button>
        </div>
      </section>
    </div>
  )
}

export default PasswordUpdated
