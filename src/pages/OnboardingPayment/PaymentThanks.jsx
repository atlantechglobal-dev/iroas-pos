import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import { prefetchRoutes } from '../../lib/routePrefetch.js'

/** Legacy route — after payment we open the dashboard directly. */
function PaymentThanks() {
  const navigate = useNavigate()
  const { setRestaurantStatus, setOnboardingPaid } = useAuth()

  useEffect(() => {
    setRestaurantStatus('live')
    setOnboardingPaid?.(true)
    prefetchRoutes(['dashboard'])
    navigate(ROUTES.DASHBOARD, { replace: true })
  }, [navigate, setRestaurantStatus, setOnboardingPaid])

  return (
    <div className="app-loading" role="status" aria-live="polite">
      <span className="app-loading-spinner" aria-hidden="true" />
      <p>Opening dashboard…</p>
    </div>
  )
}

export default PaymentThanks
