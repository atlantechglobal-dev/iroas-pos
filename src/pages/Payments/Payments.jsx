import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { MESSAGES } from '../../constants/messages.js'
import './Payments.css'

const TRANSACTIONS = [
  { txn: 'TXN-58812', order: '#10428', name: 'Rhea Menon', meta: 'Delivery · 2 min ago', method: 'UPI · GPay', amount: '₹2,480', status: 'Captured' },
  { txn: 'TXN-58811', order: '#10427', name: 'Kabir Shah', meta: 'Pickup · 5 min ago', method: 'Card · Visa ••42', amount: '₹860', status: 'Captured' },
  { txn: 'TXN-58809', order: '#10424', name: 'Table 07', meta: 'Dine-in · 22 min ago', method: 'Cash', amount: '₹1,240', status: 'Captured' },
  { txn: 'TXN-58805', order: '#10419', name: 'Anita Desai', meta: 'Delivery · 48 min ago', method: 'UPI · PhonePe', amount: '₹1,690', status: 'Partly refunded' },
  { txn: 'TXN-58801', order: '#10411', name: 'Farhan Q.', meta: 'Pickup · 1 hr ago', method: 'Card · MC ••08', amount: '₹540', status: 'Refunded' },
  { txn: 'TXN-58796', order: '#10406', name: 'Table 12', meta: 'Dine-in · 2 hr ago', method: 'Card · Amex ••11', amount: '₹3,120', status: 'Pending' },
  { txn: 'TXN-58788', order: '#10399', name: 'Ishaan V.', meta: 'Delivery · 3 hr ago', method: 'Wallet · Paytm', amount: '₹2,180', status: 'Failed' },
]

const TABS = ['Transactions', 'Refunds', 'Settlements', 'Disputes']

function Payments() {
  const toast = useToast()
  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))

  const [tab, setTab] = useState('Transactions')
  const [query, setQuery] = useState('')

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const filtered = TRANSACTIONS.filter((t) =>
    `${t.txn} ${t.order} ${t.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const handleRefund = (txn) => alert(`Refund ${txn} — coming soon in this demo.`)

  
  return (
    <DashboardLayout pageClassName="payments-page" activeNav="payments">
<div className="page-head">
              <div>
                <p className="eyebrow">Finance</p>
                <h1>Payments & refunds</h1>
                <p className="page-desc">Every transaction, refund, payout and dispute across dine-in, delivery and pickup.</p>
              </div>
              <button className="btn btn-outline" type="button" onClick={() => comingSoon('Export statement')}>⇩ Export statement</button>
            </div>

            <div className="stat-cards">
              <div className="stat-card"><span>Gross volume · today</span><strong>₹1,28,450</strong></div>
              <div className="stat-card"><span>Net after fees</span><strong>₹1,23,716</strong></div>
              <div className="stat-card"><span>Refunds · today</span><strong>₹860</strong></div>
              <div className="stat-card"><span>Effective fee</span><strong>3.68%</strong></div>
              <div className="stat-card"><span>Open disputes</span><strong>2</strong></div>
            </div>

            <div className="tab-row">
              <div className="tabs">
                {TABS.map((t) => (
                  <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>
              <input className="txn-search" type="text" placeholder="Search order, guest, txn..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <div className="card">
              {tab === 'Transactions' ? (
                <>
                  <h2>Transactions</h2>
                  <span className="muted-note">{filtered.length} shown · all channels</span>
                  <ul className="txn-list">
                    {filtered.map((t) => (
                      <li key={t.txn}>
                        <div className="txn-main">
                          <strong>{t.txn} · {t.order}</strong>
                          <p>{t.name} · {t.meta}</p>
                        </div>
                        <div className="txn-method">{t.method}</div>
                        <div className="txn-amount">{t.amount}</div>
                        <span className={`status-pill status-${t.status.toLowerCase().replace(/\s+/g, '-')}`}>{t.status}</span>
                        <button
                          className="refund-btn"
                          type="button"
                          disabled={t.status === 'Refunded' || t.status === 'Failed'}
                          onClick={() => handleRefund(t.txn)}
                        >
                          ↩ Refund
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h2>{tab}</h2>
                  <p className="muted-note">{tab} view — coming soon in this demo.</p>
                </>
              )}
            </div>
    </DashboardLayout>
  )
}

export default Payments
