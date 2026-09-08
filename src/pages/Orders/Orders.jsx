import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { MESSAGES } from '../../constants/messages.js'
import './Orders.css'

const INITIAL_COLUMNS = [
  {
    key: 'new', label: 'New', tint: 'blue',
    orders: [
      { id: '#10428', meta: 'Table 12 · Riya M.', items: ['2x Margherita', '1x Risotto', '2x Lemonade'], total: '₹2,480', time: '2 min', high: true },
      { id: '#10429', meta: 'Pickup · Aman G.', items: ['1x Butter chicken', '2x Naan'], total: '₹820', time: '30 sec' },
    ],
  },
  {
    key: 'accepted', label: 'Accepted', tint: 'green',
    orders: [
      { id: '#10424', meta: 'Delivery · Zomato', items: ['5x Mixed grill platter'], total: '₹2,180', time: '18 min' },
    ],
  },
  {
    key: 'preparing', label: 'Preparing', tint: 'yellow',
    orders: [
      { id: '#10422', meta: 'Table 04', items: ['6x Tapas selection'], total: '₹4,120', time: '6 min left' },
      { id: '#10421', meta: 'Delivery · Swiggy', items: ['2x Pasta arrabiata'], total: '₹720', time: '3 min left' },
    ],
  },
  {
    key: 'ready', label: 'Ready', tint: 'green',
    orders: [
      { id: '#10419', meta: 'Pickup · Arjun S.', items: ['2x Pizza slice'], total: '₹860', time: '14 min' },
    ],
  },
  {
    key: 'completed', label: 'Completed', tint: 'gray',
    orders: [
      { id: '#10415', meta: 'Table 09 · Meera K.', items: ['3x Thali'], total: '₹1,540', time: 'done' },
    ],
  },
]

function Orders() {
  const toast = useToast()
  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))

  const [columns, setColumns] = useState(INITIAL_COLUMNS)

  const advanceOrder = (colIndex, orderId) => {
    if (colIndex >= columns.length - 1) return
    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, orders: [...c.orders] }))
      const idx = next[colIndex].orders.findIndex((o) => o.id === orderId)
      if (idx === -1) return prev
      const [order] = next[colIndex].orders.splice(idx, 1)
      next[colIndex + 1].orders.unshift(order)
      return next
    })
  }


  
  return (
    <DashboardLayout pageClassName="orders-page" activeNav="incoming-orders">
<div className="page-head">
              <div>
                <p className="eyebrow">Live kitchen</p>
                <h1>Orders</h1>
                <p className="page-desc">Move orders across stages as they're picked up. Real-time sync with POS, delivery partners and kitchen displays.</p>
              </div>
              <div className="head-actions">
                <button className="btn btn-outline" type="button" onClick={() => comingSoon('Filter')}>▤ Filter</button>
                <button className="btn btn-primary" type="button" onClick={() => comingSoon('New order')}>+ New order</button>
              </div>
            </div>

            <div className="board">
              {columns.map((col, colIndex) => (
                <div className="board-col" key={col.key}>
                  <div className="col-head">
                    <span className={`col-count tint-${col.tint}`}>{col.orders.length}</span>
                    <strong>{col.label}</strong>
                    <button type="button" className="col-more" onClick={() => comingSoon('Column options')}>⋯</button>
                  </div>

                  <div className="col-body">
                    {col.orders.map((order) => (
                      <div className="order-card" key={order.id}>
                        <div className="order-card-top">
                          <strong>{order.id}</strong>
                          {order.high && <span className="high-pill">High</span>}
                        </div>
                        <p className="order-meta">{order.meta}</p>
                        <ul>
                          {order.items.map((it) => <li key={it}>{it}</li>)}
                        </ul>
                        <div className="order-card-foot">
                          <strong>{order.total}</strong>
                          <span>⏱ {order.time}</span>
                        </div>
                        {colIndex < columns.length - 1 && (
                          <button type="button" className="advance-btn" onClick={() => advanceOrder(colIndex, order.id)}>
                            Move to {columns[colIndex + 1].label} →
                          </button>
                        )}
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
