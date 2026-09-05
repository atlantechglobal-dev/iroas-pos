import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import '../NotFound/NotFound.css'

export default function Unauthorized() {
  return (
    <div className="status-page">
      <div className="status-card">
        <p className="status-code">403</p>
        <h1>Access denied</h1>
        <p>You do not have permission to view this page.</p>
        <Link to={ROUTES.DASHBOARD} className="status-link">
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
