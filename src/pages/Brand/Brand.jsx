import { useAuth } from '../../hooks/useAuth.js'
import { RESTAURANT_STATUS } from '../../constants/restaurantStatus.js'
import BrandWizard from './BrandWizard.jsx'
import BrandStudio from './BrandStudio.jsx'

/**
 * /brand:
 * - Onboarding wizard while the restaurant is still in setup
 * - Dashboard Branding studio once there is a tenant to brand (live, review, rejected)
 *   or when a platform admin opens the nav item
 */
function Brand() {
  const { isAdmin, restaurantStatus } = useAuth()

  if (isAdmin) return <BrandStudio />
  if (!restaurantStatus) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        Loading…
      </div>
    )
  }
  if (restaurantStatus === RESTAURANT_STATUS.ONBOARDING) return <BrandWizard />
  return <BrandStudio />
}

export default Brand
