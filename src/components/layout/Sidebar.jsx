import { getActiveNavKey, getNavGroupsForUser } from '../../lib/navGroups.js'

export function Sidebar({
  activeNav,
  pathname = '',
  isAdmin = false,
  workspaceName,
  workspaceStatus,
  onNavClick,
  onWorkspaceClick,
  onClose,
}) {
  const resolvedActive = activeNav || getActiveNavKey(pathname, { isAdmin })
  const groups = getNavGroupsForUser({ isAdmin })

  return (
    <aside className="sidebar" aria-label={isAdmin ? 'Platform sidebar' : 'Sidebar'}>
      <div className="sidebar-header">
        <div className="brand">
          <img src="/images/Logo9-1 1.svg" alt="IROAS" />
        </div>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close menu">
          ×
        </button>
      </div>

      <button className="restaurant-switch" type="button" onClick={onWorkspaceClick}>
        <span className="avatar-badge">{workspaceName.charAt(0).toUpperCase()}</span>
        <span className="restaurant-info">
          <strong>{workspaceName}</strong>
          <small>{workspaceStatus}</small>
        </span>
        {!isAdmin ? (
          <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>

      <nav className="nav" aria-label={isAdmin ? 'Platform navigation' : 'Main navigation'}>
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            {group.items.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`nav-item ${item.key === resolvedActive ? 'active' : ''}`}
                onClick={() => onNavClick(item)}
                aria-current={item.key === resolvedActive ? 'page' : undefined}
              >
                <img src={item.icon} alt="" aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
