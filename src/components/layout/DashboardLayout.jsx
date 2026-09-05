import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRestaurant } from '../../hooks/useRestaurant.js'
import { useToast } from '../feedback/ToastProvider.jsx'
import { ROUTES } from '../../constants/routes.js'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'
import './DashboardShell.css'

/**
 * Shared dashboard shell — sidebar, topbar, responsive mobile drawer.
 * Page-specific styles stay on `pageClassName`; shell styles use `dashboard-shell`.
 */
export function DashboardLayout({
  pageClassName = '',
  activeNav,
  variant = 'owner',
  adminSubtitle,
  shellStyle,
  children,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()
  const toast = useToast()
  const { displayRestaurant, restaurantStatus } = useRestaurant({
    enabled: variant === 'owner' && !isAdmin,
  })

  const [profileOpen, setProfileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const roleLabel = isAdmin ? 'Platform Admin' : 'Owner'
  const workspaceName = variant === 'admin' ? 'IROAS Platform' : displayRestaurant
  const workspaceStatus =
    variant === 'admin'
      ? adminSubtitle || 'All tenants'
      : restaurantStatus === 'live'
        ? 'Live'
        : 'Onboarding'

  useEffect(() => {
    setSidebarOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  const handleNavClick = (item) => {
    setProfileOpen(false)
    setSidebarOpen(false)
    if (item.route) {
      navigate(item.route)
      return
    }
    toast.info(`${item.label} — demo preview with sample data.`)
  }

  const shellClass = ['dashboard-shell', pageClassName, sidebarOpen ? 'sidebar-open' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass} style={shellStyle}>
      {sidebarOpen && (
        <div
          className="menu-overlay"
          data-sidebar-backdrop
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="app">
        <Sidebar
          activeNav={activeNav}
          pathname={location.pathname}
          isAdmin={isAdmin}
          workspaceName={workspaceName}
          workspaceStatus={workspaceStatus}
          onNavClick={handleNavClick}
          onWorkspaceClick={() => toast.info('Switch restaurant — demo preview with sample data.')}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="main">
          <Topbar
            user={user}
            roleLabel={roleLabel}
            profileOpen={profileOpen}
            onProfileToggle={() => setProfileOpen((prev) => !prev)}
            onProfileClose={() => setProfileOpen(false)}
            onMenuToggle={() => setSidebarOpen(true)}
            onSettings={() => {
              setProfileOpen(false)
              navigate(ROUTES.SETTINGS)
            }}
            onLogout={logout}
            onQuickAction={() => toast.info('Quick actions — demo preview with sample data.')}
            onNotifications={() => toast.info('No new notifications.')}
          />

          <main className="content" id="top">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export { Sidebar } from './Sidebar.jsx'
export { Topbar } from './Topbar.jsx'
