import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import './NotFound.css'

export default function NotFound() {
  return (
    <div className="status-page">
      <div className="status-card">
        <p className="status-code">404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or has been moved.</p>
        <Link to={ROUTES.LOGIN} className="status-link">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
