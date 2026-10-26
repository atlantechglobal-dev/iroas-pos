import { useEffect, useState } from 'react'
import { api } from '@/shared/api'

function shapeMark(shape) {
  if (shape === 'Circle') return '○'
  if (shape === 'Rectangle') return '▭'
  return '□'
}

export default function UryTablePicker({ slug, onSelect, selectedName = '' }) {
  const [rooms, setRooms] = useState([])
  const [room, setRoom] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listPublicUryDineTables(slug)
      .then((res) => {
        if (cancelled) return
        const next = res?.data?.rooms || []
        setRooms(next)
        setRoom(next[0]?.name || '')
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setRooms([])
        setError(err?.message || 'Tables could not be loaded from the POS.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const current = rooms.find((r) => r.name === room) || rooms[0]

  return (
    <section className="gs-dine-picker" aria-label="Select table">
      <div className="gs-dine-picker-head">
        <h2>Select table</h2>
        <p>Free tables can take a new order. Occupied tables already have one.</p>
      </div>
      {loading ? <p className="gs-muted">Loading tables…</p> : null}
      {error ? (
        <p className="gs-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {rooms.length > 1 ? (
        <div className="gs-room-row" role="tablist" aria-label="Rooms">
          {rooms.map((r) => (
            <button
              key={r.name}
              type="button"
              role="tab"
              aria-selected={r.name === current?.name}
              className={`gs-pill${r.name === current?.name ? ' is-active' : ''}`}
              onClick={() => setRoom(r.name)}
            >
              {r.name}
            </button>
          ))}
        </div>
      ) : null}
      {current ? (
        <div className="gs-table-grid">
          {current.tables.map((table) => (
            <button
              key={table.name}
              type="button"
              className={`gs-table-card${table.occupied ? ' is-occupied' : ''}${table.name === selectedName ? ' is-selected' : ''}`}
              disabled={table.occupied}
              onClick={() => onSelect(table)}
            >
              <span className="gs-table-shape" aria-hidden="true">
                {shapeMark(table.shape)}
              </span>
              <strong>{table.name}</strong>
              <span>{table.occupied ? 'Occupied' : table.seats ? `${table.seats} seats` : 'Free'}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
