import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/shared/lib/api'
import '@/features/dashboard/Tables/Tables.css'

const STATUS_LABELS = {
  occupied: 'Occupied',
  free: 'Free',
  unknown: 'Status unknown',
}

function formatInvoiceTime(value) {
  if (!value) return ''
  const [h, m] = String(value).split(':')
  if (h == null || m == null) return ''
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

function PosTablesPanel({ hideWhenNotConnected = false }) {
  const [state, setState] = useState({ status: 'loading', tables: [] })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }))
    try {
      const res = await api.getPosTables()
      setState({ status: 'ready', tables: res?.data?.tables || [] })
    } catch (err) {
      setState({
        status: err?.code === 'pos_not_connected' ? 'not_connected' : 'error',
        tables: [],
      })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rooms = useMemo(() => {
    const groups = new Map()
    for (const table of state.tables) {
      const key = table.room || 'Other'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(table)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [state.tables])

  const occupiedCount = state.tables.filter((t) => t.status === 'occupied').length

  if (hideWhenNotConnected && state.status === 'not_connected') return null

  return (
    <section className="pos-tables-card">
      <div className="card-title-head">
        <h2>Live floor status</h2>
        {state.status === 'ready' && state.tables.length > 0 ? (
          <span>
            {occupiedCount} of {state.tables.length} occupied
          </span>
        ) : null}
      </div>

      {state.status === 'loading' ? <p className="empty-tables">Loading tables…</p> : null}

      {state.status === 'not_connected' ? (
        <p className="empty-tables">
          Your POS is not connected yet. Contact IROAS support to link your restaurant&apos;s POS.
        </p>
      ) : null}

      {state.status === 'error' ? (
        <div className="pos-tables-error">
          <p>Table service is temporarily unavailable. Please try again.</p>
          <button type="button" className="btn btn-outline" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {state.status === 'ready' && state.tables.length === 0 ? (
        <p className="empty-tables">No tables have been configured in your POS yet.</p>
      ) : null}

      {state.status === 'ready' && state.tables.length > 0 ? (
        <>
          {rooms.map(([room, tables]) => (
            <div key={room} className="pos-tables-room">
              <h3>{room}</h3>
              <div className="pos-tables-grid">
                {tables.map((t) => (
                  <div key={t.id} className={`pos-table-tile is-${t.status}`}>
                    <div className="pos-table-tile-top">
                      <strong>{t.name}</strong>
                      {t.seats ? <span>{t.seats} seats</span> : null}
                    </div>
                    <span className={`pos-table-status is-${t.status}`}>{STATUS_LABELS[t.status]}</span>
                    {t.status === 'occupied' && formatInvoiceTime(t.lastInvoiceTime) ? (
                      <small>Last bill {formatInvoiceTime(t.lastInvoiceTime)}</small>
                    ) : null}
                    {t.takeAway ? <small>Take-away</small> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pos-tables-foot">
            <button type="button" className="btn btn-outline" onClick={load}>
              Refresh
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default PosTablesPanel
