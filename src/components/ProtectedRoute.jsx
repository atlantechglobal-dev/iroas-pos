import { Navigate } from 'react-router-dom'
import { getStoredUser, getToken } from '../lib/api'

function ProtectedRoute({ adminOnly = false, children }) {
  const token = getToken()
  const user = getStoredUser()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/restaurant-setup" replace />
  }

  if (!adminOnly && user.role === 'admin') {
    return <Navigate to="/platform-admin" replace />
  }

  return children
}

export default ProtectedRoute
