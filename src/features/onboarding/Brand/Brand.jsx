import { useAuth } from '@/shared/hooks/useAuth'
import { RESTAURANT_STATUS } from '@/shared/constants/restaurantStatus'
import BrandWizard from '@/features/onboarding/Brand/BrandWizard'
import BrandStudio from '@/features/onboarding/Brand/BrandStudio'

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
        <span className="app-loading-spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    )
  }
  if (restaurantStatus === RESTAURANT_STATUS.ONBOARDING) return <BrandWizard />
  return <BrandStudio />
}

export default Brand
