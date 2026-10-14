import { useMemo, useState } from 'react'

function formatPosPrice(value, currency) {
  if (typeof value !== 'number') return '—'
  if (!currency) return value.toLocaleString()
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString()}`
  }
}

function formatFetchedAt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const FILTERS = ['All', 'Available', 'Unavailable', 'Special']

function PosMenuView({ posMenu }) {
  const { status, data, reload } = posMenu
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')

  const categories = useMemo(() => data?.categories || [], [data])
  const selected = categories.find((c) => c.id === selectedId) || categories[0] || null
  const totalItems = categories.reduce((n, c) => n + c.items.length, 0)
  const availableItems = categories.reduce((n, c) => n + c.items.filter((i) => i.available).length, 0)

  const visibleItems = useMemo(() => {
    if (!selected) return []
    const q = query.trim().toLowerCase()
    return selected.items.filter((item) => {
      if (filter === 'Available' && !item.available) return false
      if (filter === 'Unavailable' && item.available) return false
      if (filter === 'Special' && !item.special) return false
      return !q || item.name.toLowerCase().includes(q)
    })
  }, [selected, filter, query])

  if (status === 'loading') return <p className="empty-note">Loading menu…</p>

  if (status === 'error') {
    return (
      <div className="card pos-menu-notice">
        <p>Menu service is temporarily unavailable. Please try again.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={reload}>
          Retry
        </button>
      </div>
    )
  }

  if (status === 'mapping_invalid') {
    return (
      <div className="card pos-menu-notice">
        <p>Your POS connection needs to be checked. Please contact IROAS support.</p>
      </div>
    )
  }

  if (status === 'not_connected') {
    return (
      <div className="card pos-menu-notice">
        <p>Your POS is not connected yet.</p>
      </div>
    )
  }

  if (data?.reason === 'no_active_menu' || data?.reason === 'menu_disabled' || totalItems === 0) {
    return (
      <div className="card pos-menu-notice">
        <p>
          {data?.reason === 'no_active_menu'
            ? 'No active menu is set in your POS yet.'
            : data?.reason === 'menu_disabled'
              ? 'Your active POS menu is currently disabled.'
              : 'No menu items have been configured yet.'}
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={reload}>
          Refresh
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="card pos-menu-banner">
        <div>
          <span className="pos-live-dot" aria-hidden="true" />
          <strong>Live from your POS</strong>
          <span className="muted-note">
            {data.menu?.name ? `${data.menu.name} · ` : ''}
            {availableItems} of {totalItems} items available
            {data.fetchedAt ? ` · updated ${formatFetchedAt(data.fetchedAt)}` : ''}
          </span>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={reload}>
          Refresh
        </button>
      </div>

      <div className="toolbar card">
        <div className="search-bar toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search POS items..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search POS menu items"
          />
        </div>
        <div className="filter-chips">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Courses</h2>
        <span className="muted-note">Managed in your POS · read-only here</span>
      </div>

      <div className="pos-course-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`chip ${selected?.id === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedId(cat.id)}
          >
            {cat.name} <span className="pos-course-count">{cat.items.length}</span>
          </button>
        ))}
      </div>

      <div className="card pos-item-list">
        {visibleItems.length === 0 ? (
          <p className="empty-note">No items match this view.</p>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className={`pos-item-row${item.available ? '' : ' is-unavailable'}`}>
              <div className="pos-item-name">
                <strong>{item.name}</strong>
                {item.special ? <span className="pos-badge special">Special</span> : null}
              </div>
              <span className={`pos-badge ${item.available ? 'available' : 'unavailable'}`}>
                {item.available ? 'Available' : 'Unavailable'}
              </span>
              <span className="pos-item-price">{formatPosPrice(item.price, data.currency)}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default PosMenuView
