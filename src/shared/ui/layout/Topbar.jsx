import { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES, platformAccountApproveProfilePath } from '@/shared/constants/routes'
import { api } from '@/shared/lib/api'

const ADMIN_QUICK_ACTIONS = [
  {
    id: 'account-approve',
    label: 'Accounts',
    icon: '/images/platad.svg',
    tone: 'mint',
    to: ROUTES.PLATFORM_ACCOUNT_APPROVE,
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: '/images/cust.svg',
    tone: 'sky',
    to: ROUTES.PLATFORM_CUSTOMERS,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: '/images/directory.svg',
    tone: 'lilac',
    to: ROUTES.PLATFORM_CUSTOMER_ONBOARDING,
  },
  {
    id: 'payment',
    label: 'Payments',
    icon: '/images/payments.svg',
    tone: 'amber',
    to: ROUTES.PLATFORM_SETTINGS_PAYMENT,
  },
  {
    id: 'professional',
    label: 'Pro card',
    icon: '/images/digicard.svg',
    tone: 'rose',
    to: ROUTES.PLATFORM_PROFESSIONAL,
  },
  {
    id: 'staff',
    label: 'Add staff',
    icon: '/images/stafb.svg',
    tone: 'slate',
    to: ROUTES.PLATFORM_STAFF,
    dashed: true,
  },
]

const OWNER_QUICK_ACTIONS = [
  {
    id: 'orders',
    label: 'Orders',
    icon: '/images/incoming.svg',
    tone: 'mint',
    to: ROUTES.ORDERS,
  },
  {
    id: 'menu',
    label: 'Menu',
    icon: '/images/blackmenu.svg',
    tone: 'sky',
    to: ROUTES.MENU,
  },
  {
    id: 'reservations',
    label: 'Bookings',
    icon: '/images/breserve.svg',
    tone: 'lilac',
    to: ROUTES.RESERVATIONS,
  },
  {
    id: 'card',
    label: 'Biz card',
    icon: '/images/digicard.svg',
    tone: 'amber',
    to: ROUTES.DIGITAL_BUSINESS_CARD,
  },
  {
    id: 'one-link',
    label: 'One Link',
    icon: '/images/one link.svg',
    tone: 'rose',
    to: ROUTES.ONE_LINK,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '/images/settings.svg',
    tone: 'slate',
    to: ROUTES.SETTINGS,
    dashed: true,
  },
]

function tenantMatches(row, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return false
  return [row.name, row.owner_name, row.owner_email, row.plan].some((value) =>
    String(value || '').toLowerCase().includes(q),
  )
}

function tenantResultPath(row) {
  if (row.status === 'pending_approval') return platformAccountApproveProfilePath(row.id)
  if (row.status === 'onboarding') return ROUTES.PLATFORM_CUSTOMER_ONBOARDING
  if (row.status === 'rejected') return `${ROUTES.PLATFORM_CUSTOMERS}?status=rejected`
  if (row.status === 'live') return `${ROUTES.PLATFORM_CUSTOMERS}?status=live`
  return ROUTES.PLATFORM_CUSTOMERS
}

function approvalPath(item, isAdmin) {
  const meta = item?.meta && typeof item.meta === 'object' ? item.meta : {}
  const tenantId = meta.tenantId || meta.restaurantId
  const isApproval = item?.type === 'approval' || /approv/i.test(`${item?.title || ''} ${item?.body || ''}`)
  if (!isApproval) return null
  if (isAdmin && tenantId) return platformAccountApproveProfilePath(tenantId)
  if (isAdmin) return ROUTES.PLATFORM_ACCOUNT_APPROVE
  return null
}

function formatRelative(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  return new Date(iso).toLocaleDateString()
}

export function Topbar({
  user,
  roleLabel,
  isAdmin = false,
  searchPlaceholder = 'Search orders, menu items, customers...',
  profileOpen,
  onProfileToggle,
  onProfileClose,
  onMenuToggle,
  onSettings,
  onLogout,
  onNavigate,
  onNotifications,
}) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState('')
  const menuId = useId()
  const notifMenuId = useId()
  const wrapRef = useRef(null)
  const notifWrapRef = useRef(null)
  const searchRef = useRef(null)
  const searchWrapRef = useRef(null)
  const location = useLocation()
  const quickActions = isAdmin ? ADMIN_QUICK_ACTIONS : OWNER_QUICK_ACTIONS
  const isApple =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '')
  const searchShortcutLabel = isApple ? '⌘ K' : 'Ctrl K'
  const unreadCount = notifications.filter((n) => !n.read).length

  const loadNotifications = () => {
    setNotifLoading(true)
    setNotifError('')
    api
      .getNotifications()
      .then(({ notifications: rows }) => {
        setNotifications(Array.isArray(rows) ? rows.slice(0, 12) : [])
      })
      .catch((err) => {
        setNotifications([])
        setNotifError(err.message || 'Unable to load notifications.')
      })
      .finally(() => setNotifLoading(false))
  }

  useEffect(() => {
    setQuickOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      const key = String(event.key || '').toLowerCase()
      const mod = event.metaKey || event.ctrlKey
      if (mod && !event.altKey && (key === 'k' || event.code === 'KeyK')) {
        event.preventDefault()
        setQuickOpen(false)
        setNotifOpen(false)
        onProfileClose?.()
        setSearchOpen(true)
        const input = searchRef.current
        if (!input) return
        input.focus()
        input.select?.()
        return
      }
      if (key === 'escape' && (document.activeElement === searchRef.current || searchOpen)) {
        setSearchOpen(false)
        searchRef.current?.blur()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onProfileClose, searchOpen])

  useEffect(() => {
    if (!isAdmin) return undefined
    const term = query.trim()
    if (term.length < 1) {
      setSearchResults([])
      setSearchLoading(false)
      return undefined
    }
    let cancelled = false
    setSearchLoading(true)
    const timer = setTimeout(() => {
      api
        .adminTenants(term)
        .then(({ tenants }) => {
          if (cancelled) return
          setSearchResults((tenants || []).filter((row) => tenantMatches(row, term)).slice(0, 8))
        })
        .catch(() => {
          if (!cancelled) setSearchResults([])
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isAdmin, query])

  useEffect(() => {
    if (!quickOpen && !notifOpen && !searchOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setQuickOpen(false)
        setNotifOpen(false)
        setSearchOpen(false)
      }
    }
    const onPointer = (event) => {
      const inQuick = wrapRef.current?.contains(event.target)
      const inNotif = notifWrapRef.current?.contains(event.target)
      const inSearch = searchWrapRef.current?.contains(event.target)
      if (!inQuick) setQuickOpen(false)
      if (!inNotif) setNotifOpen(false)
      if (!inSearch) setSearchOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [quickOpen, notifOpen, searchOpen])

  useEffect(() => {
    if (profileOpen) {
      setQuickOpen(false)
      setNotifOpen(false)
    }
  }, [profileOpen])

  useEffect(() => {
    if (!notifOpen) return
    loadNotifications()
  }, [notifOpen])

  const closeQuick = () => setQuickOpen(false)

  const runAction = (action) => {
    closeQuick()
    onProfileClose?.()
    if (action.to) onNavigate?.(action.to)
  }

  const focusSearch = () => {
    setSearchOpen(true)
    searchRef.current?.focus()
  }

  const toggleNotifications = () => {
    onProfileClose?.()
    setQuickOpen(false)
    setNotifOpen((open) => !open)
  }

  const openAllNotifications = () => {
    setNotifOpen(false)
    onNotifications?.()
  }

  const markAllRead = async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id)
    if (!ids.length) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await api.markNotificationsRead(ids)
    } catch {
      loadNotifications()
    }
  }

  const openNotification = async (item) => {
    if (!item.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      )
      api.markNotificationsRead([item.id]).catch(() => {})
    }
    setNotifOpen(false)
    const next = approvalPath(item, isAdmin)
    if (next) {
      onNavigate?.(next)
      return
    }
    if (isAdmin && item.type === 'identity') {
      onNavigate?.(ROUTES.PLATFORM_IDENTITIES)
      return
    }
    onNotifications?.()
  }

  const openSearchResult = (row) => {
    setSearchOpen(false)
    setQuery('')
    onNavigate?.(tenantResultPath(row))
  }

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

        <div className={`search-bar${searchOpen ? ' is-open' : ''}`} ref={searchWrapRef}>
          <span className="search-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={searchRef}
            type="search"
            placeholder={searchPlaceholder}
            aria-label="Search"
            aria-keyshortcuts={isApple ? 'Meta+K' : 'Control+K'}
            aria-expanded={searchOpen}
            aria-controls="topbar-search-results"
            value={isAdmin ? query : undefined}
            onChange={isAdmin ? (event) => {
              setQuery(event.target.value)
              setSearchOpen(true)
            } : undefined}
            onFocus={() => setSearchOpen(true)}
          />
          <button
            type="button"
            className="search-keys"
            onClick={focusSearch}
            title={`Focus search (${searchShortcutLabel})`}
            aria-label={`Focus search (${searchShortcutLabel})`}
          >
            <kbd>{isApple ? '⌘' : 'Ctrl'}</kbd>
            <kbd>K</kbd>
          </button>
          {isAdmin && searchOpen ? (
            <div id="topbar-search-results" className="search-results" role="listbox" aria-label="Search results">
              {!query.trim() ? (
                <p className="search-results-empty">Search tenants, owners, or plans</p>
              ) : searchLoading ? (
                <p className="search-results-empty">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="search-results-empty">No matching records</p>
              ) : (
                searchResults.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    className="search-result"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openSearchResult(row)}
                  >
                    <strong>{row.name || 'Untitled'}</strong>
                    <span>
                      {[row.owner_name, row.plan].filter(Boolean).join(' · ') || 'Tenant'}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="topbar-actions">
        <div className="quick-action-wrap" ref={wrapRef}>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            aria-expanded={quickOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
            onClick={() => {
              onProfileClose?.()
              setNotifOpen(false)
              setQuickOpen((open) => !open)
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span className="quick-action-label">Quick action</span>
          </button>

          {quickOpen ? (
            <div
              id={menuId}
              className="quick-action-panel"
              role="menu"
              aria-label="Quick actions"
            >
              <div className="quick-action-panel-head">
                <p>Quick actions</p>
                <span>{isAdmin ? 'Platform' : 'Restaurant'}</span>
              </div>
              <div className="quick-action-grid">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    className={`quick-action-tile tone-${action.tone}${
                      action.dashed ? ' is-dashed' : ''
                    }`}
                    onClick={() => runAction(action)}
                  >
                    <span className="quick-action-logo" aria-hidden="true">
                      <img src={action.icon} alt="" />
                    </span>
                    <strong>{action.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="notif-wrap" ref={notifWrapRef}>
          <button
            className={`icon-btn${notifOpen ? ' is-open' : ''}`}
            type="button"
            aria-label="Notifications"
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            aria-controls={notifMenuId}
            onClick={toggleNotifications}
          >
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
            {unreadCount > 0 ? <span className="dot" aria-hidden="true" /> : null}
          </button>

          {notifOpen ? (
            <div
              id={notifMenuId}
              className="notif-panel"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="notif-panel-head">
                <div>
                  <p>Notifications</p>
                  <span>
                    {notifLoading
                      ? 'Loading…'
                      : unreadCount
                        ? `${unreadCount} unread`
                        : 'All caught up'}
                  </span>
                </div>
                {unreadCount > 0 ? (
                  <button type="button" className="notif-mark-read" onClick={markAllRead}>
                    Mark all read
                  </button>
                ) : null}
              </div>

              <div className="notif-panel-body">
                {notifLoading ? (
                  <div className="notif-empty">
                    <p>Loading notifications…</p>
                  </div>
                ) : notifError ? (
                  <div className="notif-empty">
                    <strong>Couldn’t load</strong>
                    <p>{notifError}</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notif-empty">
                    <span className="notif-empty-icon" aria-hidden="true">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V13L20 17H4L6 13V8Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <strong>No notifications</strong>
                    <p>You’re all caught up. New alerts will show up here.</p>
                  </div>
                ) : (
                  <ul className="notif-list">
                    {notifications.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`notif-item${!item.read ? ' is-unread' : ''}`}
                          onClick={() => openNotification(item)}
                        >
                          <span className="notif-item-dot" aria-hidden="true" />
                          <span className="notif-item-copy">
                            <strong>{item.title || 'Notification'}</strong>
                            {item.body ? <small>{item.body}</small> : null}
                            <em>{formatRelative(item.createdAt)}</em>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="notif-panel-foot">
                <button type="button" className="notif-view-all" onClick={openAllNotifications}>
                  View all notifications
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="user-chip-wrapper">
          <button
            className="user-chip"
            type="button"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => {
              setQuickOpen(false)
              setNotifOpen(false)
              onProfileToggle?.()
            }}
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

export function getTopbarHandlers(navigate, logout) {
  return {
    onNotifications: () => navigate(ROUTES.NOTIFICATIONS),
    onSettings: () => navigate(ROUTES.SETTINGS),
    onLogout: logout,
  }
}
