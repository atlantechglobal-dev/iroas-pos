import { useEffect, useRef } from 'react'
import { getActiveNavKey, getNavGroupsForUser } from '@/shared/lib/navGroups'
import { prefetchNavKey } from '@/shared/lib/routePrefetch'

export function Sidebar({
  activeNav,
  pathname = '',
  isAdmin = false,
  businessCategory = '',
  workspaceName,
  workspaceStatus,
  onNavClick,
  onWorkspaceClick,
  onClose,
}) {
  const resolvedActive = getActiveNavKey(pathname, { isAdmin }) || activeNav
  const groups = getNavGroupsForUser({ isAdmin, businessCategory })
  const navRef = useRef(null)
  const name = String(workspaceName || '').trim() || 'Your restaurant'
  const initial = name.charAt(0).toUpperCase() || 'R'

  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector('.nav-item.active')
    if (!nav || !active) return
    const top = active.offsetTop
    const bottom = top + active.offsetHeight
    if (top < nav.scrollTop) nav.scrollTop = top
    else if (bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = bottom - nav.clientHeight
    }
  }, [resolvedActive])

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

      <button className="restaurant-switch" type="button" onClick={onWorkspaceClick} title={name}>
        <span className="avatar-badge" aria-hidden="true">{initial}</span>
        <span className="restaurant-info">
          <strong>{name}</strong>
          <small>{workspaceStatus}</small>
        </span>
        {!isAdmin ? (
          <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>

      <nav className="nav" ref={navRef} aria-label={isAdmin ? 'Platform navigation' : 'Main navigation'}>
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            {group.items.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`nav-item ${item.key === resolvedActive ? 'active' : ''}`}
                onPointerEnter={() => prefetchNavKey(item.key)}
                onFocus={() => prefetchNavKey(item.key)}
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
