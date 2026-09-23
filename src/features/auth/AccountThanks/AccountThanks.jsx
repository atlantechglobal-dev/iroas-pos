import { Link, useLocation } from 'react-router-dom'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/auth/AccountThanks/AccountThanks.css'

function AccountThanks() {
  const location = useLocation()
  const email = String(location.state?.email || '').trim()

  return (
    <div className="account-thanks-page">
      <section className="left-panel">
        <div className="logo">
          <img src="/images/logo.svg.svg" alt="IROAS Logo" />
        </div>

        <div className="left-content">
          <div className="security-badge">
            <span>
              <img src="/images/security.svg" alt="" />
            </span>{' '}
            UNDER REVIEW
          </div>

          <h1>
            Thanks for
            <br />
            signing up.
          </h1>

          <p className="description">
            Our team reviews every new account before access is unlocked. You’ll get an email as
            soon as you’re approved.
          </p>
        </div>
      </section>

      <section className="right-panel">
        <div className="success-container">
          <div className="success-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3L19 6V11.5C19 16.1 16.1 20.1 12 21C7.9 20.1 5 16.1 5 11.5V6L12 3Z" />
              <path d="M9 12L11 14L15 10" />
            </svg>
          </div>

          <h2>Thank you</h2>
          <p className="lead">
            Your account is in review for approval.
            {email ? (
              <>
                {' '}
                We’ll send a confirmation to <strong>{email}</strong> once an admin approves it.
              </>
            ) : (
              <> We’ll email you once an admin approves it.</>
            )}
          </p>

          <p className="hint">You can close this page. Sign in after you receive the approval email.</p>

          <Link className="thanks-btn" to={ROUTES.LOGIN}>
            Back to login
          </Link>
        </div>
      </section>
    </div>
  )
}

export default AccountThanks
