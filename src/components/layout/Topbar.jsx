import { ROUTES } from '../../constants/routes.js'
import { MESSAGES } from '../../constants/messages.js'

export function Topbar({
  user,
  roleLabel,
  profileOpen,
  onProfileToggle,
  onProfileClose,
  onMenuToggle,
  onSettings,
  onLogout,
  onQuickAction,
  onNotifications,
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="menu-toggle"
          onClick={onMenuToggle}
          aria-label="Open menu"
          aria-expanded={false}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input type="search" placeholder="Search orders, menu items, customers..." aria-label="Search" />
          <span className="kbd" aria-hidden="true">
            ⌘ K
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="btn btn-primary btn-sm" type="button" onClick={onQuickAction}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span className="quick-action-label">Quick action</span>
        </button>

        <button className="icon-btn" type="button" aria-label="Notifications" onClick={onNotifications}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V13L20 17H4L6 13V8Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span className="dot" aria-hidden="true" />
        </button>

        <div className="user-chip-wrapper">
          <button
            className="user-chip"
            type="button"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={onProfileToggle}
          >
            <span className="avatar-dark">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
            <span className="user-info">
              <strong>{user?.name || 'User'}</strong>
              <small>{roleLabel}</small>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {profileOpen && (
            <>
              <div className="menu-overlay" onClick={onProfileClose} aria-hidden="true" />
              <div className="profile-menu" role="menu">
                <button type="button" role="menuitem" onClick={onSettings}>
                  Settings
                </button>
                <button type="button" role="menuitem" className="danger" onClick={onLogout}>
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function getTopbarHandlers(toast, navigate, logout) {
  return {
    onQuickAction: () => toast.info(MESSAGES.COMING_SOON('Quick actions')),
    onNotifications: () => toast.info('No new notifications.'),
    onSettings: () => navigate(ROUTES.SETTINGS),
    onLogout: logout,
  }
}
