import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useRestaurant } from '../../hooks/useRestaurant.js'
import { useToast } from '../feedback/ToastProvider.jsx'
import { ROUTES } from '../../constants/routes.js'
import { isPendingApproval } from '../../constants/restaurantStatus.js'
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
  searchPlaceholder,
  shellStyle,
  allowPendingContent = false,
  children,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAdmin, restaurantStatus: authRestaurantStatus } = useAuth()
  const toast = useToast()
  const { displayRestaurant, restaurantStatus } = useRestaurant({
    enabled: !isAdmin && variant === 'owner',
  })

  const [profileOpen, setProfileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const roleLabel = isAdmin ? 'Platform Admin' : 'Owner'
  // Platform admins always get the admin shell + sidebar, even if a page forgot variant="admin"
  const effectiveVariant = isAdmin ? 'admin' : variant
  const workspaceName = effectiveVariant === 'admin' ? 'IROAS Platform' : displayRestaurant
  const workspaceStatus =
    effectiveVariant === 'admin'
      ? adminSubtitle || 'Super admin'
      : isPendingApproval(authRestaurantStatus || restaurantStatus)
        ? 'Awaiting approval'
        : restaurantStatus === 'live' || authRestaurantStatus === 'live'
          ? 'Live'
          : 'Onboarding'

  const showApprovalGate =
    effectiveVariant === 'owner' &&
    !isAdmin &&
    !allowPendingContent &&
    isPendingApproval(authRestaurantStatus || restaurantStatus)

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
          onWorkspaceClick={() => {
            if (isAdmin) {
              navigate(ROUTES.PLATFORM_ADMIN)
              return
            }
            toast.info('Switch restaurant — demo preview with sample data.')
          }}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="main">
          <Topbar
            user={user}
            roleLabel={roleLabel}
            isAdmin={isAdmin}
            searchPlaceholder={
              searchPlaceholder ||
              (isAdmin
                ? 'Search tenants, owners, plans…'
                : 'Search orders, menu items, customers...')
            }
            profileOpen={profileOpen}
            onProfileToggle={() => setProfileOpen((prev) => !prev)}
            onProfileClose={() => setProfileOpen(false)}
            onMenuToggle={() => setSidebarOpen(true)}
            onNavigate={(to) => navigate(to)}
            onSettings={() => {
              setProfileOpen(false)
              navigate(isAdmin ? ROUTES.PLATFORM_SETTINGS : ROUTES.SETTINGS)
            }}
            onLogout={logout}
            onNotifications={() => {
              if (isAdmin) {
                navigate(ROUTES.PLATFORM_NOTIFICATIONS)
                return
              }
              navigate(ROUTES.NOTIFICATIONS)
            }}
          />

          <main className="content" id="top">
            {showApprovalGate ? (
              <div className="approval-gate" role="status">
                <div className="approval-gate-card">
                  <p className="approval-gate-kicker">Pending review</p>
                  <h1>You are not approved</h1>
                  <p>
                    Your restaurant profile is with our admin team. Once they approve it,
                    your site publishes automatically for customers and this dashboard
                    unlocks.
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export { Sidebar } from './Sidebar.jsx'
export { Topbar } from './Topbar.jsx'
