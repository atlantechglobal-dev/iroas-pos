import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import './Orders.css'

const COLUMNS = [
  { key: 'new', label: 'New', tint: 'blue' },
  { key: 'accepted', label: 'Accepted', tint: 'green' },
  { key: 'preparing', label: 'Preparing', tint: 'yellow' },
  { key: 'ready', label: 'Ready', tint: 'green' },
  { key: 'completed', label: 'Completed', tint: 'gray' },
]

const NEXT_STATUS = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}

function formatMoney(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
}

function modeMeta(order) {
  if (order.serviceMode === 'dinein') {
    return order.tableName ? `Table · ${order.tableName}` : 'Dine-in'
  }
  if (order.serviceMode === 'delivery') return 'Delivery'
  return 'Takeaway'
}

function agoLabel(iso) {
  if (!iso) return ''
  const t = new Date(String(iso).includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
  if (Number.isNaN(t.getTime())) return ''
  const mins = Math.max(0, Math.round((Date.now() - t.getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h`
}

function Orders() {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState('all')

  const load = useCallback(async () => {
    try {
      const { orders: rows } = await api.getOrders()
      setOrders(rows || [])
    } catch (err) {
      toast.error(err.message || 'Unable to load orders.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
    const timer = setInterval(load, 20000)
    return () => clearInterval(timer)
  }, [load])

  const visible = useMemo(() => {
    if (filterMode === 'all') return orders.filter((o) => o.status !== 'cancelled')
    return orders.filter((o) => o.status !== 'cancelled' && o.serviceMode === filterMode)
  }, [orders, filterMode])

  const columns = useMemo(
    () =>
      COLUMNS.map((col) => ({
        ...col,
        orders: visible.filter((o) => o.status === col.key),
      })),
    [visible],
  )

  const advanceOrder = async (order) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    try {
      const { order: updated } = await api.updateOrder(order.id, { status: next })
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      toast.success(`Order #${updated.publicCode} → ${next}`)
    } catch (err) {
      toast.error(err.message || 'Unable to update order.')
    }
  }

  const markPaid = async (order) => {
    try {
      const { order: updated } = await api.markOrderPaid(order.id)
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      toast.success(`Order #${updated.publicCode} marked paid`)
    } catch (err) {
      toast.error(err.message || 'Unable to mark paid.')
    }
  }

  return (
    <DashboardLayout pageClassName="orders-page" activeNav="incoming-orders">
      <div className="page-head">
        <div>
          <p className="eyebrow">Live kitchen</p>
          <h1>Orders</h1>
          <p className="page-desc">
            Guest website orders (dine-in, takeaway, delivery). Advance kitchen status and confirm
            Cash / UPI payments manually.
          </p>
        </div>
        <div className="head-actions">
          <select
            className="btn btn-outline"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            aria-label="Filter by service"
          >
            <option value="all">All channels</option>
            <option value="dinein">Dine-in</option>
            <option value="pickup">Takeaway</option>
            <option value="delivery">Delivery</option>
          </select>
          <button className="btn btn-primary" type="button" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? <p className="empty-col">Loading orders…</p> : null}

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
                    <strong>#{order.publicCode}</strong>
                    {order.paymentStatus === 'payment_pending' ? (
                      <span className="high-pill">
                        {order.paymentTiming === 'pay_later' ? 'Pay later' : 'Unpaid'}
                      </span>
                    ) : (
                      <span className="paid-pill">Paid</span>
                    )}
                  </div>
                  <p className="order-meta">
                    {modeMeta(order)} · {order.guestName}
                  </p>
                  <ul>
                    {(order.items || []).map((it) => (
                      <li key={it.id || `${it.name}-${it.qty}`}>
                        {it.qty}x {it.name}
                      </li>
                    ))}
                  </ul>
                  <div className="order-card-foot">
                    <strong>{formatMoney(order.total)}</strong>
                    <span>
                      {order.paymentMethod?.toUpperCase()} · ⏱ {agoLabel(order.createdAt)}
                    </span>
                  </div>
                  <div className="order-card-actions">
                    {order.paymentStatus === 'payment_pending' ? (
                      <button type="button" className="advance-btn secondary" onClick={() => markPaid(order)}>
                        Mark paid
                      </button>
                    ) : null}
                    {NEXT_STATUS[order.status] ? (
                      <button type="button" className="advance-btn" onClick={() => advanceOrder(order)}>
                        Move to {NEXT_STATUS[order.status]} →
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {col.orders.length === 0 && <p className="empty-col">No orders</p>}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}

export default Orders
