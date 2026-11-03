import { useMemo, useState } from 'react'

function formatMoney(value, currency) {
  if (!currency) return Number(value || 0).toFixed(2)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value || 0)
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`
  }
}

function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length > 9 ? digits.slice(-9) : digits
}

/** One row per person: POS bills and bookings are matched on phone number. */
function mergeCustomers(pos, guests) {
  const rows = new Map()
  const empty = { bookings: 0, noShows: 0, cancellations: 0, lastBooking: null, orders: 0, spend: 0, currency: null, lastOrder: null }
  for (const c of pos) {
    const key = phoneKey(c.phone) || `pos-${c.id}`
    rows.set(key, { ...empty, id: key, name: c.name, phone: c.phone, orders: c.visits, spend: c.spend || 0, currency: c.currency, lastOrder: c.lastVisit })
  }
  for (const g of guests) {
    const row = rows.get(g.key) || { ...empty, id: g.key, name: g.name, phone: g.phone }
    rows.set(g.key, {
      ...row,
      name: row.name || g.name,
      phone: row.phone || g.phone,
      bookings: g.bookings,
      noShows: g.noShows,
      cancellations: g.cancellations,
      lastBooking: g.lastBooking,
    })
  }
  return [...rows.values()]
    .map((r) => ({ ...r, last: [r.lastOrder, r.lastBooking].filter(Boolean).sort().pop() || '' }))
    .sort((a, b) => String(b.last).localeCompare(String(a.last)))
}

function tagFor(c) {
  if (c.noShows >= 2) return ['tag-new', 'Frequent no-shows']
  return c.orders + c.bookings > 1 ? ['tag-vip', 'Repeat'] : ['tag-new', 'New']
}

function PosCustomersView({ posCustomers, guests, reload }) {
  const [query, setQuery] = useState('')
  const posList = posCustomers.data?.customers
  const customers = useMemo(() => mergeCustomers(posList || [], guests || []), [posList, guests])
  const q = query.trim().toLowerCase()
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
  const currency = customers.find((c) => c.currency)?.currency || null
  const totalSpend = customers.reduce((sum, c) => sum + c.spend, 0)
  const repeat = customers.filter((c) => c.orders + c.bookings > 1).length
  const noShows = customers.reduce((sum, c) => sum + c.noShows, 0)

  if (posCustomers.status === 'loading' || guests === null) return <p className="muted-note">Loading customers…</p>

  const posProblem =
    posCustomers.status === 'mapping_invalid'
      ? 'Your POS connection needs to be checked. Please contact IROAS support.'
      : posCustomers.status === 'error'
        ? 'POS bills are temporarily unavailable, so only bookings are shown.'
        : posCustomers.status === 'not_connected'
          ? 'Your POS is not connected yet. POS bills will appear here once it is.'
          : ''

  return (
    <>
      {posProblem ? <p className="muted-note">{posProblem}</p> : null}
      <div className="stat-cards">
        <div className="stat-card">
          <span>Guests</span>
          <strong>{customers.length}</strong>
        </div>
        <div className="stat-card">
          <span>Repeat guests</span>
          <strong>{repeat}</strong>
        </div>
        <div className="stat-card">
          <span>No-shows</span>
          <strong>{noShows}</strong>
        </div>
        <div className="stat-card">
          <span>Paid spend</span>
          <strong>{formatMoney(totalSpend, currency)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input type="text" placeholder="Search by name or phone..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className="btn btn-outline" onClick={reload}>
            Refresh
          </button>
        </div>

        <ul className="customer-list">
          {filtered.map((c) => {
            const [tagClass, tagText] = tagFor(c)
            const parts = [
              c.bookings ? `${c.bookings} ${c.bookings === 1 ? 'booking' : 'bookings'}` : '',
              c.orders ? `${c.orders} ${c.orders === 1 ? 'order' : 'orders'}` : '',
              c.noShows ? `${c.noShows} no-show${c.noShows === 1 ? '' : 's'}` : '',
              c.last ? `Last ${c.last}` : '',
              c.phone,
            ].filter(Boolean)
            return (
              <li key={c.id}>
                <div>
                  <strong>{c.name}</strong>
                  <p>{parts.join(' · ')}</p>
                </div>
                <span className={`tag ${tagClass}`}>{tagText}</span>
                <strong className="spend">{c.spend ? formatMoney(c.spend, c.currency) : '—'}</strong>
              </li>
            )
          })}
        </ul>
        {customers.length === 0 ? <p className="pos-empty">No guests yet. A guest appears here after their first booking or POS bill.</p> : null}
        {customers.length > 0 && filtered.length === 0 ? <p className="pos-empty">No guests match your search.</p> : null}
      </div>
    </>
  )
}

export default PosCustomersView
