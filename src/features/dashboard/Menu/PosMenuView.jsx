import { useMemo, useState } from 'react'
import { api } from '@/shared/lib/api'
import { useToast } from '@/shared/ui/feedback/ToastProvider'

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

function PosItemRow({ item, currency, onSaved }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState('')
  const [stocking, setStocking] = useState(false)
  const [stockQty, setStockQty] = useState('')

  const addStock = async (event) => {
    event.preventDefault()
    const value = Number(stockQty)
    if (!(value > 0)) {
      toast.error('Enter how many to add.')
      return
    }
    setBusy(true)
    try {
      const res = await api.addPosItemStock(item.code, value)
      onSaved(res?.data || null)
      toast.success(`${value} added to ${item.name}.`)
      setStocking(false)
      setStockQty('')
    } catch (err) {
      toast.error(err?.message || 'Could not add stock.')
    } finally {
      setBusy(false)
    }
  }

  const save = async (changes, message) => {
    setBusy(true)
    try {
      const res = await api.updatePosMenuItem(item.id, changes)
      onSaved(res?.data || null)
      toast.success(message)
      setEditing(false)
    } catch (err) {
      toast.error(err?.message || 'Could not update the POS. Nothing was changed.')
    } finally {
      setBusy(false)
    }
  }

  const submitPrice = (event) => {
    event.preventDefault()
    const value = Number(price)
    if (!(value > 0)) {
      toast.error('Enter a price greater than 0.')
      return
    }
    save({ price: value }, `${item.name} price updated in your POS.`)
  }

  return (
    <div className={`pos-item-row${item.available ? '' : ' is-unavailable'}`}>
      <div className="pos-item-name">
        {item.image ? <img className="pos-item-thumb" src={item.image} alt="" loading="lazy" /> : <span className="pos-item-thumb pos-item-thumb-empty" aria-hidden="true" />}
        <strong>{item.name}</strong>
        {item.special ? <span className="pos-badge special">Special</span> : null}
      </div>
      <span className="pos-course-pill">{item.course || 'None'}</span>
      <button
        type="button"
        className={`pos-badge pos-badge-toggle ${item.available ? 'available' : 'unavailable'}`}
        disabled={busy}
        title={item.available ? 'Mark unavailable in your POS' : 'Mark available in your POS'}
        onClick={() =>
          save(
            { available: !item.available },
            `${item.name} is now ${item.available ? 'unavailable' : 'available'} in your POS.`,
          )
        }
      >
        {item.available
          ? item.stockQty != null
            ? `${Math.max(0, Math.floor(item.stockQty))} left`
            : 'Available'
          : item.stockQty === 0
            ? 'Not available today'
            : 'Unavailable'}
      </button>
      {stocking ? (
        <form className="pos-price-form" onSubmit={addStock}>
          <input
            type="number"
            min="1"
            step="1"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            aria-label={`Stock to add for ${item.name}`}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            Add
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setStocking(false)}>
            Cancel
          </button>
        </form>
      ) : editing ? (
        <form className="pos-price-form" onSubmit={submitPrice}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-label={`New price for ${item.name}`}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            Save
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="pos-item-price pos-price-edit"
          title="Change price in your POS"
          disabled={busy}
          onClick={() => {
            setPrice(typeof item.price === 'number' ? String(item.price) : '')
            setEditing(true)
          }}
        >
          {formatPosPrice(item.price, currency)}
        </button>
      )}
      {!stocking && !editing ? (
        <button type="button" className="btn btn-outline btn-sm pos-stock-btn" disabled={busy} onClick={() => setStocking(true)}>
          + Stock
        </button>
      ) : null}
    </div>
  )
}

function PosMenuView({ posMenu }) {
  const { status, data, reload, replaceData } = posMenu
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [menuName, setMenuName] = useState('')
  const [courseName, setCourseName] = useState('')
  const [layout, setLayout] = useState('list')

  const categories = useMemo(() => data?.categories || [], [data])
  const catalogItems = useMemo(() => {
    if (data?.catalog?.items?.length) return data.catalog.items
    const menu = data?.menu?.name || ''
    return categories.flatMap((category) =>
      category.items.map((item) => ({
        ...item,
        menu,
        course: item.course || (category.id === 'uncategorized' ? '' : category.name),
      })),
    )
  }, [data, categories])
  const menus = data?.catalog?.menus?.length
    ? data.catalog.menus
    : data?.menu?.name
      ? [{ name: data.menu.name, enabled: true }]
      : []
  const courses = data?.catalog?.courses?.length
    ? data.catalog.courses
    : [...new Set(catalogItems.map((item) => item.course).filter(Boolean))]
  const totalItems = catalogItems.length
  const availableItems = catalogItems.filter((item) => item.available).length

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalogItems.filter((item) => {
      if (menuName && item.menu !== menuName) return false
      if (courseName && item.course !== courseName) return false
      if (filter === 'Available' && !item.available) return false
      if (filter === 'Unavailable' && item.available) return false
      if (filter === 'Special' && !item.special) return false
      return !q || item.name.toLowerCase().includes(q)
    })
  }, [catalogItems, menuName, courseName, filter, query])

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

  if ((data?.reason === 'no_active_menu' || data?.reason === 'menu_disabled' || totalItems === 0) && catalogItems.length === 0) {
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

      <div className="toolbar card pos-menu-toolbar">
        <div className="pos-menu-filters">
          <label className="pos-select">
            <select aria-label="Menu" value={menuName} onChange={(event) => setMenuName(event.target.value)}>
              <option value="">All Menu Items</option>
              {menus.map((menu) => (
                <option key={menu.name} value={menu.name}>
                  {menu.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pos-select">
            <select aria-label="Course" value={courseName} onChange={(event) => setCourseName(event.target.value)}>
              <option value="">All Courses</option>
              {courses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </label>
          <div className="pos-layout-toggle" role="group" aria-label="Layout">
            <button type="button" className={layout === 'grid' ? 'active' : ''} aria-label="Grid" onClick={() => setLayout('grid')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
                <rect x="14" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
                <rect x="4" y="14" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
                <rect x="14" y="14" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <button type="button" className={layout === 'list' ? 'active' : ''} aria-label="List" onClick={() => setLayout('list')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 7h12M8 12h12M8 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="4.5" cy="7" r="1" fill="currentColor" />
                <circle cx="4.5" cy="12" r="1" fill="currentColor" />
                <circle cx="4.5" cy="17" r="1" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <div className="search-bar toolbar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search POS menu items"
          />
        </div>
      </div>

      <div className="filter-chips pos-status-filters">
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {layout === 'grid' ? (
        <div className="pos-item-grid">
          {visibleItems.length === 0 ? (
            <p className="empty-note">No items match this view.</p>
          ) : (
            visibleItems.map((item) => (
              <div key={item.id} className={`card pos-item-card${item.available ? '' : ' is-unavailable'}`}>
                {item.image ? <img src={item.image} alt="" /> : <div className="pos-item-card-photo" />}
                <div>
                  <strong>{item.name}</strong>
                  <span className="pos-course-pill">{item.course || 'None'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card pos-item-list">
          <div className="pos-item-head">
            <span>Item Name</span>
            <span>Course</span>
          </div>
          {visibleItems.length === 0 ? (
            <p className="empty-note">No items match this view.</p>
          ) : (
            visibleItems.map((item) => (
              <PosItemRow
                key={`${item.menu}-${item.id}`}
                item={item}
                currency={data.currency}
                onSaved={(next) => (next ? replaceData(next) : reload())}
              />
            ))
          )}
        </div>
      )}
    </>
  )
}

export default PosMenuView
