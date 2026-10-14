import { useMemo } from 'react'

const COLUMNS = [
  { key: 'open', label: 'Open on table', tint: 'blue' },
  { key: 'unpaid', label: 'Awaiting payment', tint: 'yellow' },
  { key: 'paid', label: 'Paid', tint: 'green' },
  { key: 'closed', label: 'Cancelled / returned', tint: 'gray' },
]

function columnFor(order) {
  if (order.state === 'cancelled' || order.state === 'returned') return 'closed'
  return order.state
}

function formatMoney(value, currency) {
  if (value == null) return '—'
  if (!currency) return Number(value).toFixed(2)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`
  }
}

function orderPlace(order) {
  const parts = []
  if (order.table) parts.push(`Table · ${order.table}`)
  else if (order.orderType) parts.push(order.orderType)
  if (order.customer) parts.push(order.customer)
  return parts.join(' · ') || 'Walk-in'
}

function timeLabel(postedAt) {
  if (!postedAt) return ''
  const [date, time] = postedAt.split(' ')
  return time ? `${date} ${time.slice(0, 5)}` : date
}

function PosOrdersBoard({ posOrders, filterMode }) {
  const orders = useMemo(() => posOrders.data?.orders || [], [posOrders.data])

  const columns = useMemo(() => {
    const visible =
      filterMode === 'all'
        ? orders
        : orders.filter((o) => {
            const type = o.orderType.toLowerCase()
            if (filterMode === 'dinein') return type === 'dine in' || (!type && o.table)
            if (filterMode === 'pickup') return type === 'take away'
            if (filterMode === 'delivery') return type === 'delivery' || type === 'aggregators'
            return true
          })
    return COLUMNS.map((col) => ({ ...col, orders: visible.filter((o) => columnFor(o) === col.key) }))
  }, [orders, filterMode])

  if (posOrders.status === 'loading' && !posOrders.data) {
    return <p className="empty-col">Loading POS orders…</p>
  }
  if (posOrders.status === 'mapping_invalid') {
    return <p className="empty-col">Your POS connection needs to be checked. Please contact IROAS support.</p>
  }
  if (posOrders.status === 'error') {
    return (
      <div className="pos-orders-error">
        <p>Order service is temporarily unavailable. Please try again.</p>
        <button type="button" className="btn btn-outline" onClick={posOrders.reload}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      {orders.length === 0 ? (
        <p className="pos-orders-note">No orders have been placed in your POS yet. New POS orders appear here automatically.</p>
      ) : null}
      <div className="board">
        {columns.map((col) => (
          <div className="board-col" key={col.key}>
            <div className="col-head">
              <span className={`col-count tint-${col.tint}`}>{col.orders.length}</span>
              <strong>{col.label}</strong>
            </div>
            <div className="col-body">
              {col.orders.map((order) => (
                <div className="order-card" key={order.id}>
                  <div className="order-card-top">
                    <strong>{order.id}</strong>
                    <span className={order.state === 'paid' ? 'paid-pill' : 'high-pill'}>{order.posStatus}</span>
                  </div>
                  <p className="order-meta">{orderPlace(order)}</p>
                  {order.items?.length ? (
                    <ul>
                      {order.items.map((it) => (
                        <li key={it.id}>
                          {it.qty ?? '?'}x {it.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="order-card-foot">
                    <strong>{formatMoney(order.total, order.currency)}</strong>
                    <span>{timeLabel(order.postedAt)}</span>
                  </div>
                  {order.waiter ? <p className="order-meta pos-order-waiter">Waiter · {order.waiter}</p> : null}
                </div>
              ))}
              {col.orders.length === 0 && <p className="empty-col">No orders</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default PosOrdersBoard
