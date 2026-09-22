import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { ROUTES } from '../../constants/routes.js'
import { isAdmin } from '../../constants/roles.js'
import { ownerHomePath } from '../../constants/restaurantStatus.js'

export function PublicRoute({ children }) {
  const { isAuthenticated, user, restaurantStatus, awaitingAccountApproval, onboardingPaid } =
    useAuth()
  const location = useLocation()

  if (isAuthenticated) {
    if (isAdmin(user)) {
      return <Navigate to={ROUTES.PLATFORM_ADMIN} replace />
    }
    if (location.pathname === ROUTES.ACCOUNT_THANKS) {
      return children
    }
    if (location.pathname === ROUTES.CREATE_ACCOUNT) {
      return <Navigate to={ROUTES.ACCOUNT_THANKS} replace />
    }
    return (
      <Navigate
        to={ownerHomePath(restaurantStatus, {
          awaitingAccountApproval: Boolean(awaitingAccountApproval),
          onboardingPaid: Boolean(onboardingPaid),
        })}
        replace
      />
    )
  }

  return children
}
