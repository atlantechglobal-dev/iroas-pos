import { useMemo, useState } from 'react'
import { api } from '@/shared/lib/api'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import PosOrderSheet from '@/features/dashboard/Orders/PosOrderSheet'

/** Payment lane — mirrors URY POS Orders tabs. */
const PAYMENT_COLUMNS = [
  { key: 'draft', label: 'Draft', tint: 'blue', hint: 'Takeaway / counter' },
  { key: 'unbilled', label: 'Unbilled', tint: 'yellow', hint: 'Dine-in open or awaiting payment' },
  { key: 'paid', label: 'Paid', tint: 'green', hint: 'Settled in POS' },
  { key: 'closed', label: 'Cancelled / returned', tint: 'gray', hint: '' },
]

/** Kitchen lane — staff advances step-by-step in IROAS (does not change URY payment). */
const KITCHEN_COLUMNS = [
  { key: 'received', label: 'Received', tint: 'blue' },
  { key: 'accepted', label: 'Accepted', tint: 'green' },
  { key: 'preparing', label: 'Preparing', tint: 'yellow' },
  { key: 'ready', label: 'Ready', tint: 'green' },
  { key: 'completed', label: 'Completed', tint: 'gray' },
]

const KITCHEN_NEXT_LABEL = {
  received: 'Accepted',
  accepted: 'Preparing',
  preparing: 'Ready',
  ready: 'Completed',
}

function paymentColumnFor(order) {
  if (order.state === 'cancelled' || order.state === 'returned') return 'closed'
  if (order.state === 'draft') return 'draft'
  if (order.state === 'paid') return 'paid'
  return 'unbilled'
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

function channelLabel(order) {
  const type = String(order.orderType || '').toLowerCase()
  if (type === 'take away') return 'Take Away'
  if (type === 'dine in' || order.table) return 'Dine In'
  if (type === 'delivery') return 'Delivery'
  if (type === 'phone in') return 'Phone In'
  if (type === 'aggregators') return 'Aggregator'
  return order.orderType || 'POS'
}

function paymentLabel(order) {
  if (order.state === 'paid') return 'Paid'
  if (order.state === 'draft') return 'Draft'
  if (order.state === 'unbilled' || order.state === 'open' || order.state === 'unpaid') return 'Unbilled'
  if (order.state === 'cancelled') return 'Cancelled'
  if (order.state === 'returned') return 'Returned'
  return order.posStatus || order.state
}

function timeLabel(postedAt) {
  if (!postedAt) return ''
  const [date, time] = postedAt.split(' ')
  return time ? `${date} ${time.slice(0, 5)}` : date
}

function PosOrdersBoard({ posOrders, filterMode }) {
  const toast = useToast()
  const [boardView, setBoardView] = useState('kitchen') // kitchen | payment
  const [busyId, setBusyId] = useState(null)
  const [openId, setOpenId] = useState(null)
  const orders = useMemo(() => posOrders.data?.orders || [], [posOrders.data])

  const filtered = useMemo(() => {
    if (filterMode === 'all') return orders
    return orders.filter((o) => {
      const type = String(o.orderType || '').toLowerCase()
      if (filterMode === 'dinein') return type === 'dine in' || (!type && o.table)
      if (filterMode === 'pickup') return type === 'take away'
      if (filterMode === 'delivery') return type === 'delivery' || type === 'aggregators'
      return true
    })
  }, [orders, filterMode])

  const columns = useMemo(() => {
    if (boardView === 'payment') {
      return PAYMENT_COLUMNS.map((col) => ({
        ...col,
        orders: filtered.filter((o) => paymentColumnFor(o) === col.key),
      }))
    }
    return KITCHEN_COLUMNS.map((col) => ({
      ...col,
      orders: filtered.filter((o) => (o.kitchenStep || 'received') === col.key),
    }))
  }, [filtered, boardView])

  const advanceKitchen = async (order) => {
    if (!order.nextKitchenStep) return
    setBusyId(order.id)
    try {
      const res = await api.advancePosKitchen(order.id, { advance: true })
      const data = res?.data || {}
      posOrders.replaceData?.((prev) => {
        if (!prev?.orders) return prev
        return {
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  kitchenStep: data.kitchenStep,
                  kitchenLabel: data.kitchenLabel,
                  nextKitchenStep: data.nextKitchenStep,
                }
              : o,
          ),
        }
      })
      if (!posOrders.replaceData) posOrders.reload?.()
      toast.success(`${order.id} → ${data.kitchenLabel || data.kitchenStep}`)
    } catch (err) {
      toast.error(err.message || 'Could not advance kitchen status.')
    } finally {
      setBusyId(null)
    }
  }

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
      <div className="pos-board-toolbar">
        <p className="pos-orders-note">
          {boardView === 'kitchen'
            ? 'Kitchen flow: advance Received → Accepted → Preparing → Ready → Completed. Open an order to print the bill or take payment.'
            : 'Payment flow (URY): open a Draft or Unbilled order to print the bill or take payment. Paid orders are already settled.'}
        </p>
        <div className="orders-source-switch" role="tablist" aria-label="POS board view">
          <button
            type="button"
            role="tab"
            aria-selected={boardView === 'kitchen'}
            className={`source-chip ${boardView === 'kitchen' ? 'active' : ''}`}
            onClick={() => setBoardView('kitchen')}
          >
            By kitchen steps
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={boardView === 'payment'}
            className={`source-chip ${boardView === 'payment' ? 'active' : ''}`}
            onClick={() => setBoardView('payment')}
          >
            By payment (URY)
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="pos-orders-note">No orders have been placed in your POS yet. New POS orders appear here automatically.</p>
      ) : null}

      <div className="board">
        {columns.map((col) => (
          <div className="board-col" key={col.key}>
            <div className="col-head">
              <span className={`col-count tint-${col.tint}`}>{col.orders.length}</span>
              <strong title={col.hint}>{col.label}</strong>
            </div>
            <div className="col-body">
              {col.orders.map((order) => (
                <div
                  className="order-card"
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setOpenId(order.id)
                    }
                  }}
                >
                  <div className="order-card-top">
                    <strong>{order.id}</strong>
                    <span className={order.state === 'paid' ? 'paid-pill' : 'high-pill'}>{paymentLabel(order)}</span>
                  </div>
                  <p className="order-meta">
                    <span className={`pos-channel-pill is-${channelLabel(order).toLowerCase().replace(/\s+/g, '-')}`}>
                      {channelLabel(order)}
                    </span>
                    {order.table ? ` · Table ${order.table}` : ''}
                    {order.customer ? ` · ${order.customer}` : ''}
                  </p>
                  <p className="order-meta">
                    Kitchen · <strong>{order.kitchenLabel || 'Received'}</strong>
                    {' · '}
                    Payment · {paymentLabel(order)}
                  </p>
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
                  {order.nextKitchenStep ? (
                    <div className="order-card-actions">
                      <button
                        type="button"
                        className="advance-btn"
                        disabled={busyId === order.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          advanceKitchen(order)
                        }}
                      >
                        {busyId === order.id
                          ? 'Updating…'
                          : `Move to ${KITCHEN_NEXT_LABEL[order.kitchenStep] || order.nextKitchenStep} →`}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {col.orders.length === 0 && <p className="empty-col">No orders</p>}
            </div>
          </div>
        ))}
      </div>
      {openId ? (
        <PosOrderSheet
          invoiceId={openId}
          onClose={() => setOpenId(null)}
          onPaid={() => {
            setOpenId(null)
            posOrders.reload?.()
          }}
        />
      ) : null}
    </>
  )
}

export default PosOrdersBoard
