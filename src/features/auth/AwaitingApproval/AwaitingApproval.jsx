import { Link } from 'react-router-dom'
import { useAuth } from '@/shared/hooks/useAuth'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/onboarding/OnboardingPayment/PaymentThanks.css'

function AwaitingApproval() {
  const { user, logout } = useAuth()

  return (
    <main className="pay-thanks-page">
      <div className="pay-thanks-card">
        <div className="pay-thanks-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3L19 6V11.5C19 16.1 16.1 20.1 12 21C7.9 20.1 5 16.1 5 11.5V6L12 3Z" />
            <path d="M9 12L11 14L15 10" />
          </svg>
        </div>
        <p className="pay-thanks-kicker">Under review</p>
        <h1>Account in review</h1>
        <p className="pay-thanks-lead">
          Payment is complete. Your account is waiting for admin review and approval.
          {user?.email ? (
            <>
              {' '}
              We’ll email <strong>{user.email}</strong> when you’re approved.
            </>
          ) : (
            <> We’ll email you when you’re approved.</>
          )}
        </p>
        <p className="pay-thanks-hint" style={{ marginBottom: 20 }}>
          Dashboard and setup stay locked until an admin approves your account.
        </p>
        <div className="pay-thanks-actions">
          <button type="button" className="pay-thanks-primary" onClick={logout}>
            Sign out
          </button>
          <Link className="pay-thanks-secondary" to={ROUTES.LOGIN} onClick={logout}>
            Back to login
          </Link>
        </div>
      </div>
    </main>
  )
}

export default AwaitingApproval
