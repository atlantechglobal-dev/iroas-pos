import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import './Customers.css'

const CUSTOMERS = [
  { name: 'Riya Mehta', visits: 18, spend: '₹42,800', last: 'Yesterday', tag: 'VIP' },
  { name: 'Arjun Shah', visits: 9, spend: '₹18,240', last: '3 days ago', tag: 'Regular' },
  { name: 'Meera Kapoor', visits: 4, spend: '₹6,120', last: '1 week ago', tag: 'New' },
  { name: 'Vikram Patel', visits: 22, spend: '₹61,050', last: 'Today', tag: 'VIP' },
  { name: 'Sneha Iyer', visits: 2, spend: '₹2,480', last: '2 weeks ago', tag: 'New' },
  { name: 'Dev Nair', visits: 11, spend: '₹24,900', last: '4 days ago', tag: 'Regular' },
]

function Customers() {
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')

  const filtered = CUSTOMERS.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const preview = (label) => {
    setNote(`${label} — demo preview with sample customer data.`)
    setTimeout(() => setNote(''), 2500)
  }

  return (
    <DashboardLayout pageClassName="customers-page" activeNav="customers">
      <div className="page-head">
        <div>
          <p className="eyebrow">People</p>
          <h1>Customers</h1>
          <p className="page-desc">
            Guest profiles, visit history and spend — preview data for demo evaluation.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => preview('Export guests')}>
          Export guests
        </button>
      </div>

      {note ? <p className="muted-note">{note}</p> : null}

      <div className="stat-cards">
        <div className="stat-card">
          <span>Guests</span>
          <strong>{CUSTOMERS.length * 48}</strong>
        </div>
        <div className="stat-card">
          <span>VIP</span>
          <strong>{CUSTOMERS.filter((c) => c.tag === 'VIP').length * 12}</strong>
        </div>
        <div className="stat-card">
          <span>Avg. spend</span>
          <strong>₹2,640</strong>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search customers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn btn-outline" onClick={() => preview('Filters')}>
            Filters
          </button>
        </div>

        <ul className="customer-list">
          {filtered.map((c) => (
            <li key={c.name}>
              <div>
                <strong>{c.name}</strong>
                <p>
                  {c.visits} visits · Last {c.last}
                </p>
              </div>
              <span className={`tag tag-${c.tag.toLowerCase()}`}>{c.tag}</span>
              <strong className="spend">{c.spend}</strong>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => preview(c.name)}>
                View
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  )
}

export default Customers
