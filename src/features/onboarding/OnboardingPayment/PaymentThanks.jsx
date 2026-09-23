import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/hooks/useAuth'
import { ROUTES } from '@/shared/constants/routes'
import { ownerLiveHomePath } from '@/shared/constants/restaurantStatus'
import { prefetchRoutes } from '@/shared/lib/routePrefetch'

/** Legacy route — after payment open the category home (dashboard or digital identity). */
function PaymentThanks() {
  const navigate = useNavigate()
  const { setRestaurantStatus, setOnboardingPaid, businessCategory } = useAuth()

  useEffect(() => {
    setRestaurantStatus('live')
    setOnboardingPaid?.(true)
    const home = ownerLiveHomePath(businessCategory)
    prefetchRoutes([home === ROUTES.DASHBOARD ? 'dashboard' : 'digitalBusinessCard'])
    navigate(home, { replace: true })
  }, [navigate, setRestaurantStatus, setOnboardingPaid, businessCategory])

  return (
    <div className="app-loading" role="status" aria-live="polite">
      <span className="app-loading-spinner" aria-hidden="true" />
      <p>Opening your workspace…</p>
    </div>
  )
}

export default PaymentThanks
