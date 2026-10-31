import { useMemo, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { usePosResource } from '@/shared/hooks/usePosResource'
import { api } from '@/shared/lib/api'
import '@/features/dashboard/Payments/Payments.css'

function formatMoney(value, currency) {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR' }).format(amount)
  } catch {
    return amount.toFixed(2)
  }
}

function Payments() {
  const [query, setQuery] = useState('')
  const orders = usePosResource(api.getPosOrders, { refreshMs: 60_000 })
  const summary = usePosResource(api.getDashboard, { refreshMs: 60_000 })

  const paid = useMemo(
    () =>
      (orders.data?.orders || [])
        .filter((order) => order.state === 'paid')
        .sort((a, b) => String(b.postedAt || '').localeCompare(String(a.postedAt || ''))),
    [orders.data],
  )
  const filtered = paid.filter((order) =>
    `${order.id} ${order.customer} ${order.orderType} ${order.table}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const currency = summary.data?.currency || paid[0]?.currency || ''
  const weekTotal = (summary.data?.series || []).reduce((sum, day) => sum + day.revenue, 0)
  const notConnected = orders.status === 'not_connected' || summary.status === 'not_connected'

  const exportCsv = () => {
    const lines = filtered.map((order) =>
      [order.id, order.postedAt || '', order.customer, order.orderType, order.table, order.total ?? ''].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    const blob = new Blob([['Order,Time,Customer,Type,Table,Total', ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'iroas-payments.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout pageClassName="payments-page" activeNav="payments">
      <div className="page-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Payments</h1>
          <p className="page-desc">Orders settled at your POS. Download the list for your accountant.</p>
        </div>
        <button className="btn btn-outline export-btn" type="button" disabled={!filtered.length} onClick={exportCsv}>
          Export
        </button>
      </div>

      {notConnected ? <p className="empty-note">Your POS is not connected yet. Payments will appear here once it is.</p> : null}

      <div className="stat-cards">
        <div className="stat-card">
          <span>Takings today</span>
          <strong>{summary.data ? formatMoney(summary.data.today.revenue, currency) : '—'}</strong>
        </div>
        <div className="stat-card">
          <span>Last 7 days</span>
          <strong>{summary.data ? formatMoney(weekTotal, currency) : '—'}</strong>
        </div>
        <div className="stat-card">
          <span>Paid orders today</span>
          <strong>{summary.data ? summary.data.today.paidOrders : '—'}</strong>
        </div>
        <div className="stat-card">
          <span>Open orders (unpaid)</span>
          <strong>{summary.data ? formatMoney(summary.data.today.openValue, currency) : '—'}</strong>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Paid orders</h2>
            <span>Latest from your POS</span>
          </div>
          <input
            className="txn-search"
            type="search"
            placeholder="Search order, guest or table…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search paid orders"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="empty-note">{paid.length ? 'No paid orders match that search.' : 'No paid orders yet.'}</p>
        ) : (
          <ul className="txn-list">
            {filtered.map((order) => (
              <li key={order.id}>
                <div className="txn-main">
                  <strong>{order.id}</strong>
                  <p>{order.postedAt || ''}</p>
                </div>
                <div className="txn-method">{order.table ? `Table ${order.table}` : order.orderType || 'Order'} · {order.customer || 'Guest'}</div>
                <div className="txn-amount">{formatMoney(order.total, order.currency || currency)}</div>
                <span className="status-pill status-captured">Paid</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardLayout>
  )
}

export default Payments
