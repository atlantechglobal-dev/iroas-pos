import { useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import './Payments.css'

const TRANSACTIONS = [
  {
    txn: 'TXN-58812',
    order: '#10428',
    time: '2 min ago',
    method: 'Card · Visa ••42',
    amount: '₹2,480',
    status: 'Captured',
  },
  {
    txn: 'TXN-58811',
    order: '#10427',
    time: '5 min ago',
    method: 'Cash',
    amount: '₹860',
    status: 'Captured',
  },
  {
    txn: 'TXN-58809',
    order: '#10424',
    time: '12 min ago',
    method: 'UPI · GPay',
    amount: '₹1,240',
    status: 'Captured',
  },
  {
    txn: 'TXN-58805',
    order: '#10419',
    time: '48 min ago',
    method: 'Card · MC ••08',
    amount: '₹540',
    status: 'Refunded',
  },
  {
    txn: 'TXN-58801',
    order: '#10411',
    time: '1 hr ago',
    method: 'UPI · PhonePe',
    amount: '₹1,690',
    status: 'Captured',
  },
  {
    txn: 'TXN-58796',
    order: '#10406',
    time: '2 hr ago',
    method: 'Wallet · Paytm',
    amount: '₹2,180',
    status: 'Failed',
  },
  {
    txn: 'TXN-58788',
    order: '#10399',
    time: '3 hr ago',
    method: 'Card · Amex ••11',
    amount: '₹3,120',
    status: 'Captured',
  },
]

function statusClass(status) {
  return `status-pill status-${status.toLowerCase()}`
}

function Payments() {
  const toast = useToast()
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () =>
      TRANSACTIONS.filter((row) =>
        `${row.txn} ${row.order} ${row.method}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  )

  const exportCsv = () => {
    const header = 'Transaction,Order,Time,Method,Amount,Status'
    const lines = filtered.map(
      (row) => `${row.txn},${row.order},${row.time},${row.method.replaceAll(',', ' ')},${row.amount},${row.status}`,
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'iroas-payments.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast.info('Statement downloaded.')
  }

  return (
    <DashboardLayout pageClassName="payments-page" activeNav="payments">
      <div className="page-head">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Payments</h1>
          <p className="page-desc">
            Transactions, refunds, settlements and tax. Pull statements for accounting in one click.
          </p>
        </div>
        <button className="btn btn-outline export-btn" type="button" onClick={exportCsv}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 4v10M8 10l4 4 4-4M5 18h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Export
        </button>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span>Gross volume · today</span>
          <strong>₹1,28,450</strong>
        </div>
        <div className="stat-card">
          <span>Net after fees</span>
          <strong>₹1,23,716</strong>
        </div>
        <div className="stat-card">
          <span>Refunds</span>
          <strong>₹540</strong>
        </div>
        <div className="stat-card">
          <span>Next settlement</span>
          <strong>Tomorrow</strong>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Recent transactions</h2>
            <span>Across all channels</span>
          </div>
          <input
            className="txn-search"
            type="search"
            placeholder="Search txn or order…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search transactions"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="empty-note">No transactions match that search.</p>
        ) : (
          <ul className="txn-list">
            {filtered.map((row) => (
              <li key={row.txn}>
                <div className="txn-main">
                  <strong>
                    {row.txn} / Order {row.order}
                  </strong>
                  <p>{row.time}</p>
                </div>
                <div className="txn-method">{row.method}</div>
                <div className="txn-amount">{row.amount}</div>
                <span className={statusClass(row.status)}>{row.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardLayout>
  )
}

export default Payments
