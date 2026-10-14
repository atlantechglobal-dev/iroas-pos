import { useState } from 'react'

function formatMoney(value, currency) {
  if (!currency) return Number(value || 0).toFixed(2)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value || 0)
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`
  }
}

function PosCustomersView({ posCustomers }) {
  const [query, setQuery] = useState('')
  const customers = posCustomers.data?.customers || []
  const q = query.trim().toLowerCase()
  const filtered = customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
  )
  const currency = customers.find((c) => c.currency)?.currency || null
  const totalSpend = customers.reduce((sum, c) => sum + (c.spend || 0), 0)
  const repeat = customers.filter((c) => c.visits > 1).length

  if (posCustomers.status === 'loading') return <p className="muted-note">Loading customers…</p>
  if (posCustomers.status === 'mapping_invalid') {
    return (
      <div className="card">
        <p className="pos-empty">Your POS connection needs to be checked. Please contact IROAS support.</p>
      </div>
    )
  }
  if (posCustomers.status === 'error') {
    return (
      <div className="card pos-customers-error">
        <p>Customer service is temporarily unavailable. Please try again.</p>
        <button type="button" className="btn btn-outline" onClick={posCustomers.reload}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
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
          <span>Paid spend</span>
          <strong>{formatMoney(totalSpend, currency)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn btn-outline" onClick={posCustomers.reload}>
            Refresh
          </button>
        </div>

        <ul className="customer-list">
          {filtered.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <p>
                  {c.visits} {c.visits === 1 ? 'visit' : 'visits'}
                  {c.lastVisit ? ` · Last ${c.lastVisit}` : ''}
                  {c.phone ? ` · ${c.phone}` : ''}
                </p>
              </div>
              <span className={`tag ${c.visits > 1 ? 'tag-vip' : 'tag-new'}`}>{c.visits > 1 ? 'Repeat' : 'New'}</span>
              <strong className="spend">{formatMoney(c.spend, c.currency)}</strong>
            </li>
          ))}
        </ul>
        {customers.length === 0 ? (
          <p className="pos-empty">No guests have ordered through your POS yet. Guests appear here after their first POS bill.</p>
        ) : null}
        {customers.length > 0 && filtered.length === 0 ? <p className="pos-empty">No guests match your search.</p> : null}
      </div>
    </>
  )
}

export default PosCustomersView
