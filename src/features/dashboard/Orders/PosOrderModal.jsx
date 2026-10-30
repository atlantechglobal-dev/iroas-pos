import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/shared/lib/api'
import '@/features/dashboard/Orders/PosOrderModal.css'

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`
}

function money(value) {
  return Number(value || 0).toFixed(2)
}

/** Match IROAS / URY table labels (T08 ↔ T8 ↔ t08). */
function fuzzyTableKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^t0+(\d)/, 't$1')
    .replace(/^0+(\d)/, '$1')
}

function findTableByName(list, name) {
  if (!name || !list?.length) return null
  const key = fuzzyTableKey(name)
  return list.find((t) => fuzzyTableKey(t.name) === key || fuzzyTableKey(t.id) === key) || null
}

/**
 * Sends a new order to the URY POS kitchen.
 * `initial` may prefill { guestName, phone, pax, notes, table, orderMode }.
 * orderMode: 'dinein' | 'takeaway'
 */
function PosOrderModal({ initial = {}, onClose, onPlaced }) {
  const requestId = useRef(newRequestId())
  const [tables, setTables] = useState({ status: 'loading', list: [] })
  const [orderMode, setOrderMode] = useState(initial.orderMode === 'takeaway' ? 'takeaway' : 'dinein')
  const [table, setTable] = useState('')
  const [menu, setMenu] = useState({ status: 'idle', items: [], orderType: '' })
  const [qty, setQty] = useState({})
  const [guestName, setGuestName] = useState(initial.guestName || '')
  const [phone, setPhone] = useState(initial.phone || '')
  const [pax, setPax] = useState(String(initial.pax || 2))
  const [notes, setNotes] = useState(initial.notes || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const tableLocked = Boolean(initial.table)

  useEffect(() => {
    let cancelled = false
    api
      .getPosTables()
      .then((res) => {
        if (cancelled) return
        const list = (res?.data?.tables || []).slice().sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        )
        setTables({ status: 'ready', list })
      })
      .catch((err) => {
        if (!cancelled) setTables({ status: 'error', list: [], message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Prefill / auto-pick table when POS tables load or mode changes
  useEffect(() => {
    if (tables.status !== 'ready') return

    const preferred = findTableByName(tables.list, initial.table)
    if (preferred) {
      setOrderMode(preferred.takeAway ? 'takeaway' : 'dinein')
      setTable(preferred.id)
      return
    }

    if (orderMode === 'takeaway') {
      const takeAway = tables.list.find((t) => t.takeAway)
      setTable(takeAway?.id || '')
      return
    }

    setTable((prev) => {
      if (prev) {
        const current = tables.list.find((t) => t.id === prev)
        if (current && !current.takeAway) return prev
      }
      return ''
    })
  }, [tables.status, tables.list, orderMode, initial.table])

  useEffect(() => {
    if (!table) {
      setMenu({ status: 'idle', items: [], orderType: '' })
      return undefined
    }
    let cancelled = false
    setMenu({ status: 'loading', items: [], orderType: '' })
    setQty({})
    api
      .getPosOrderMenu(table)
      .then((res) => {
        if (cancelled) return
        setMenu({ status: 'ready', items: res?.data?.items || [], orderType: res?.data?.orderType || '' })
      })
      .catch((err) => {
        if (!cancelled) setMenu({ status: 'error', items: [], orderType: '', message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [table])

  const modeTables = useMemo(() => {
    if (orderMode === 'takeaway') return tables.list.filter((t) => t.takeAway)
    return tables.list.filter((t) => !t.takeAway)
  }, [tables.list, orderMode])

  const freeInMode = modeTables.filter((t) => t.status !== 'occupied')
  const selectedMeta = tables.list.find((t) => t.id === table)

  const courses = useMemo(() => {
    const groups = new Map()
    for (const item of menu.items) {
      const key = item.course || 'Menu'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    return [...groups.entries()]
  }, [menu.items])

  const lines = menu.items.filter((it) => qty[it.code] > 0)
  const total = lines.reduce((sum, it) => sum + (it.rate || 0) * qty[it.code], 0)

  const bump = (code, delta) =>
    setQty((prev) => ({ ...prev, [code]: Math.max(0, Math.min(99, (prev[code] || 0) + delta)) }))

  const switchMode = (mode) => {
    if (tableLocked) return
    setError('')
    setOrderMode(mode)
    setTable('')
    setQty({})
    setMenu({ status: 'idle', items: [], orderType: '' })
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!table) return setError(orderMode === 'takeaway' ? 'No Take Away table is available in POS.' : 'Choose a table.')
    if (!lines.length) return setError('Add at least one item.')
    if (!phone.trim()) return setError('Enter the guest’s phone number.')
    setSubmitting(true)
    try {
      const customerRes = await api.upsertPosCustomer({ name: guestName, phone })
      const customer = customerRes?.data
      const orderRes = await api.createPosOrder({
        table,
        customer: customer.id,
        pax: Number(pax) || 1,
        comments: notes,
        items: lines.map((it) => ({ item: it.code, qty: qty[it.code] })),
        requestId: requestId.current,
      })
      onPlaced?.({ ...orderRes?.data, customer, orderMode })
    } catch (err) {
      setError(err.message || 'The order was not sent. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pos-order-modal" role="dialog" aria-modal="true" aria-label="New POS order">
      <div className="pos-order-backdrop" onClick={submitting ? undefined : onClose} />
      <form className="pos-order-card" onSubmit={submit}>
        <div className="pos-order-head">
          <h3>New POS order</h3>
          <button type="button" className="pos-order-x" onClick={onClose} disabled={submitting} aria-label="Close">
            ×
          </button>
        </div>
        <p className="pos-order-sub">
          Same as URY POS: Dine In books the table (Unbilled); Take Away creates a Draft order until paid.
        </p>

        {error ? (
          <p className="pos-order-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="pos-order-mode" role="tablist" aria-label="Order type">
          <button
            type="button"
            role="tab"
            aria-selected={orderMode === 'dinein'}
            className={`pos-order-mode-btn${orderMode === 'dinein' ? ' is-active' : ''}`}
            onClick={() => switchMode('dinein')}
            disabled={tableLocked && orderMode !== 'dinein'}
          >
            Dine In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={orderMode === 'takeaway'}
            className={`pos-order-mode-btn${orderMode === 'takeaway' ? ' is-active' : ''}`}
            onClick={() => switchMode('takeaway')}
            disabled={tableLocked && orderMode !== 'takeaway'}
          >
            Take Away
          </button>
        </div>

        <div className="pos-order-grid">
          {orderMode === 'dinein' ? (
            <label>
              Table
              <select
                value={table}
                onChange={(e) => setTable(e.target.value)}
                required
                disabled={tableLocked}
              >
                <option value="">
                  {tables.status === 'loading' ? 'Loading tables…' : 'Choose a free table'}
                </option>
                {modeTables.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.status === 'occupied' && t.id !== table}>
                    {t.name}
                    {t.room ? ` · ${t.room}` : ''}
                    {t.seats ? ` · ${t.seats} seats` : ''}
                    {t.status === 'occupied' ? ' · occupied' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Take Away
              <input
                readOnly
                value={
                  selectedMeta
                    ? `${selectedMeta.name}${selectedMeta.room ? ` · ${selectedMeta.room}` : ''}`
                    : tables.status === 'loading'
                      ? 'Loading…'
                      : 'No Take Away table in POS'
                }
              />
            </label>
          )}
          <label>
            Guests
            <input type="number" min={1} max={50} value={pax} onChange={(e) => setPax(e.target.value)} />
          </label>
          <label>
            Guest name
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Needed for new guests" />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+27…" />
          </label>
        </div>

        {tableLocked && selectedMeta ? (
          <p className="pos-order-note">
            Reserved table <strong>{selectedMeta.name}</strong>
            {selectedMeta.room ? ` · ${selectedMeta.room}` : ''} — sending this order books it in POS like a dine-in
            seat.
          </p>
        ) : null}

        {tables.status === 'ready' && orderMode === 'dinein' && freeInMode.length === 0 ? (
          <p className="pos-order-note">All dine-in tables are occupied right now.</p>
        ) : null}
        {tables.status === 'error' ? <p className="pos-order-note">{tables.message || 'Could not load tables.'}</p> : null}

        <div className="pos-order-menu">
          {!table ? (
            <p className="pos-order-note">
              {orderMode === 'takeaway' ? 'Take Away menu loads when a takeaway table is available.' : 'Choose a table to see its menu.'}
            </p>
          ) : null}
          {menu.status === 'ready' && menu.orderType ? (
            <p className="pos-order-note">
              POS menu: <strong>{menu.orderType}</strong>
              {selectedMeta?.room ? (
                <>
                  {' '}
                  · room <strong>{selectedMeta.room}</strong>
                </>
              ) : null}
              {menu.orderType === 'Take Away'
                ? ' — Draft until paid.'
                : ' — table shows occupied / Unbilled until paid.'}
            </p>
          ) : null}
          {menu.status === 'loading' ? <p className="pos-order-note">Loading menu…</p> : null}
          {menu.status === 'error' ? <p className="pos-order-note">{menu.message || 'Could not load the menu.'}</p> : null}
          {menu.status === 'ready' && menu.items.length === 0 ? (
            <p className="pos-order-note">No items are available for this order type.</p>
          ) : null}
          {courses.map(([course, items]) => (
            <div key={course} className="pos-order-course">
              <h4>{course}</h4>
              {items.map((it) => (
                <div key={it.code} className={`pos-order-item ${it.available ? '' : 'is-off'}`}>
                  <div>
                    <strong>{it.name}</strong>
                    <small>{it.available ? money(it.rate) : 'Unavailable'}</small>
                  </div>
                  <div className="pos-order-qty">
                    <button type="button" onClick={() => bump(it.code, -1)} disabled={!qty[it.code]} aria-label={`Remove ${it.name}`}>
                      −
                    </button>
                    <span>{qty[it.code] || 0}</span>
                    <button type="button" onClick={() => bump(it.code, 1)} disabled={!it.available} aria-label={`Add ${it.name}`}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <label className="pos-order-notes">
          Kitchen note
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Optional" />
        </label>

        <div className="pos-order-foot">
          <span>
            {lines.reduce((n, it) => n + qty[it.code], 0)} items · <strong>{money(total)}</strong>
          </span>
          <div>
            <button type="button" className="pos-order-btn ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="pos-order-btn" disabled={submitting || !table || !lines.length}>
              {submitting ? 'Sending…' : orderMode === 'dinein' ? 'Book table & send' : 'Send takeaway'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default PosOrderModal
