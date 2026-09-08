import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { MESSAGES } from '../../constants/messages.js'
import './Tables.css'

const INITIAL_TABLES = [
  { id: 'T-01', seats: 2, status: 'available' },
  { id: 'T-02', seats: 2, status: 'available', note: '32m' },
  { id: 'T-03', seats: 4, status: 'reserved', note: '8:45' },
  { id: 'T-04', seats: 6, status: 'available', note: '1h 12m' },
  { id: 'T-05', seats: 4, status: 'available', note: '18m' },
  { id: 'T-06', seats: 2, status: 'occupied' },
  { id: 'T-07', seats: 2, status: 'available' },
  { id: 'T-08', seats: 2, status: 'reserved', note: '7:30' },
  { id: 'T-09', seats: 4, status: 'available', note: '44m' },
  { id: 'T-10', seats: 4, status: 'out' },
  { id: 'T-11', seats: 2, status: 'reserved', note: '9:15' },
  { id: 'T-12', seats: 8, status: 'available', note: '2h 04m' },
  { id: 'T-13', seats: 4, status: 'available' },
  { id: 'T-14', seats: 2, status: 'available' },
  { id: 'T-15', seats: 6, status: 'reserved', note: '8:00' },
]

const STATUS_LABEL = { available: 'Available', occupied: 'Occupied', reserved: 'Reserved', out: 'Out of service' }

function Tables() {
  const toast = useToast()
  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))

  const [tables, setTables] = useState(INITIAL_TABLES)
  const [selected, setSelected] = useState([])

  const counts = tables.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

  const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0)

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const cycleStatus = (id) => {
    const order = ['available', 'occupied', 'reserved', 'cleaning', 'out']
    setTables((prev) => prev.map((t) => {
      if (t.id !== id) return t
      const idx = order.indexOf(t.status)
      const next = order[(idx + 1) % order.length]
      return { ...t, status: next }
    }))
  }

  const handleMerge = () => {
    if (selected.length < 2) { alert('Select 2 or more tables to merge.'); return }
    alert(`Merged ${selected.join(', ')} — demo only.`)
    setSelected([])
  }


  
  return (
    <DashboardLayout pageClassName="tables-page" activeNav="tables">
<div className="page-head">
              <div>
                <p className="eyebrow">Floor plan</p>
                <h1>Tables</h1>
                <p className="page-desc">Live view of your floor. Click a table to cycle status, select multiple to merge.</p>
              </div>
              <div className="head-actions">
                <button className="btn btn-outline" type="button" onClick={handleMerge}>⤴ Merge{selected.length > 0 ? ` (${selected.length})` : ''}</button>
                <button className="btn btn-outline" type="button" onClick={() => comingSoon('Split')}>⤳ Split</button>
                <button className="btn btn-primary" type="button" onClick={() => comingSoon('Add table')}>+ Add table</button>
              </div>
            </div>

            <div className="status-cards">
              <div className="status-card"><span className="dot available" /> Available<strong>{counts.available || 0}</strong></div>
              <div className="status-card"><span className="dot occupied" /> Occupied<strong>{counts.occupied || 0}</strong></div>
              <div className="status-card"><span className="dot reserved" /> Reserved<strong>{counts.reserved || 0}</strong></div>
              <div className="status-card"><span className="dot cleaning" /> Cleaning<strong>{counts.cleaning || 0}</strong></div>
              <div className="status-card"><span className="dot out" /> Out of service<strong>{counts.out || 0}</strong></div>
            </div>

            <div className="card floor-card">
              <div className="floor-head">
                <div>
                  <h2>Main hall</h2>
                  <span className="muted-note">{totalSeats} seats · Live occupancy · click to cycle status, shift-click to select</span>
                </div>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => comingSoon('Auto-seat')}>⚡ Auto-seat</button>
              </div>

              <div className="floor-plan">
                {tables.map((t) => (
                  <div
                    key={t.id}
                    className={`table-cell ${t.status} ${selected.includes(t.id) ? 'selected' : ''}`}
                    onClick={(e) => (e.shiftKey ? toggleSelect(t.id) : cycleStatus(t.id))}
                    title={`${STATUS_LABEL[t.status]} — click to change, shift+click to select`}
                  >
                    <strong>{t.id}</strong>
                    <span>{t.seats} seats</span>
                    {t.note && <small>{t.note}</small>}
                  </div>
                ))}
              </div>
            </div>
    </DashboardLayout>
  )
}

export default Tables
