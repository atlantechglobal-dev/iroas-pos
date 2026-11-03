import { useEffect, useMemo, useState } from 'react'
import { api } from '@/shared/lib/api'
import { useToast } from '@/shared/ui/feedback/ToastProvider'

function money(value, currency) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  if (currency === 'ZAR') return `R ${amount.toFixed(2)}`
  if (!currency) return amount.toFixed(2)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function whenLabel(postedAt) {
  if (!postedAt) return ''
  const date = new Date(String(postedAt).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return postedAt
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

function openReceipt(bill) {
  const popup = window.open('', 'pos-bill', 'noopener,width=420,height=680')
  if (!popup) return false
  const rows = (bill.items || [])
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.qty)} × ${escapeHtml(item.name)}</td><td style="text-align:right">${escapeHtml(money(item.amount ?? item.rate, bill.currency))}</td></tr>`,
    )
    .join('')
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(bill.id)}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#17171a}h1{font-size:18px}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid #eee}</style>
    </head><body>
    <h1>${escapeHtml(bill.id)}</h1>
    <p>${escapeHtml(bill.customer || '')}${bill.table ? ` · Table ${escapeHtml(bill.table)}` : ''}</p>
    <table>${rows}</table>
    <h2>Total ${escapeHtml(money(bill.total, bill.currency))}</h2>
    <script>window.addEventListener('load', () => window.print())<\/script>
    </body></html>`)
  popup.document.close()
  return true
}

function PosOrderSheet({ invoiceId, onClose, onPaid, onCancelled }) {
  const toast = useToast()
  const [bill, setBill] = useState(null)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [printPrompt, setPrintPrompt] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [amounts, setAmounts] = useState({})

  useEffect(() => {
    let cancelled = false
    setBill(null)
    setError('')
    setPaying(false)
    setCancelling(false)
    setPrintPrompt(false)
    setReason('')
    api
      .getPosOrderBill(invoiceId)
      .then((res) => {
        if (cancelled) return
        const data = res?.data
        setBill(data)
        const first = data?.modes?.[0]
        setAmounts(first ? { [first]: data.total } : {})
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not open this order.')
      })
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  const entered = useMemo(
    () => Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [amounts],
  )
  const balanced = bill ? Math.round(entered * 100) === Math.round(Number(bill.total) * 100) : false

  const print = async () => {
    if (!bill) return false
    setBusy(true)
    try {
      await api.printPosOrder(bill.id)
      setBill((current) => ({ ...current, printed: true }))
      if (!openReceipt(bill)) toast.info('Allow pop-ups to print this bill.')
      else toast.success(`${bill.id} marked printed.`)
      return true
    } catch (err) {
      toast.error(err?.message || 'Could not print this bill.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const startPayment = () => {
    if (bill.printed) setPaying(true)
    else setPrintPrompt(true)
  }

  const printThenPay = async () => {
    if (await print()) {
      setPrintPrompt(false)
      setPaying(true)
    }
  }

  const cancel = async (event) => {
    event.preventDefault()
    if (!bill || reason.trim().length < 3) return
    setBusy(true)
    try {
      await api.cancelPosOrder(bill.id, reason.trim())
      toast.success(`${bill.id} cancelled.`)
      onCancelled?.()
    } catch (err) {
      toast.error(err?.message || 'Could not cancel this order.')
    } finally {
      setBusy(false)
    }
  }

  const pay = async (event) => {
    event.preventDefault()
    if (!bill || !balanced) return
    setBusy(true)
    try {
      const payments = Object.entries(amounts)
        .map(([mode, amount]) => ({ mode, amount: Number(amount) || 0 }))
        .filter((row) => row.amount > 0)
      await api.payPosOrder(bill.id, payments)
      toast.success(`${bill.id} paid.`)
      onPaid()
    } catch (err) {
      toast.error(err?.message || 'Could not take payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="order-sheet-backdrop" role="presentation" onClick={onClose}>
      <aside className="order-sheet" role="dialog" aria-modal="true" aria-label={invoiceId} onClick={(event) => event.stopPropagation()}>
        <header className="order-sheet-head">
          <h2>{invoiceId}</h2>
          <div className="order-sheet-tools">
            <button type="button" className="order-icon-btn" aria-label="Print" disabled={!bill || busy} onClick={print}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.8" />
                <rect x="7" y="14" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <button type="button" className="order-icon-btn" aria-label="Close" onClick={onClose}>
              ×
            </button>
            {bill ? <span className={bill.canPay ? 'high-pill' : 'paid-pill'}>{bill.canPay ? 'Draft' : bill.posStatus || 'Paid'}</span> : null}
          </div>
        </header>

        {error ? <p className="order-sheet-note">{error}</p> : null}
        {!bill && !error ? <p className="order-sheet-note">Loading order…</p> : null}

        {bill ? (
          <>
            <div className="order-sheet-meta">
              <span>{bill.customer || 'Guest'}</span>
              {bill.waiter ? <span>{bill.waiter}</span> : null}
              {bill.postedAt ? <span>{whenLabel(bill.postedAt)}</span> : null}
              {bill.table ? <span>Table {bill.table}</span> : null}
            </div>
            <h3>Order items</h3>
            <ul className="order-sheet-items">
              {(bill.items || []).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>Qty: {item.qty}</small>
                  </div>
                  <span>{money(item.amount ?? (item.rate || 0) * (item.qty || 0), bill.currency)}</span>
                </li>
              ))}
            </ul>
            <footer className="order-sheet-foot">
              <button type="button" className="order-icon-btn" aria-label="Print bill" disabled={busy} onClick={print}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="7" y="14" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </button>
              {bill.canPay ? (
                <button type="button" className="order-cancel-btn" disabled={busy} onClick={() => setCancelling(true)}>
                  Cancel order
                </button>
              ) : null}
              {bill.canPay ? (
                <button type="button" className="order-pay-btn" disabled={busy} onClick={startPayment}>
                  Payment
                </button>
              ) : null}
              <strong>{money(bill.total, bill.currency)}</strong>
            </footer>
          </>
        ) : null}

        {printPrompt && bill ? (
          <div className="pay-modal-backdrop" role="presentation" onClick={() => !busy && setPrintPrompt(false)}>
            <div className="cancel-modal" role="dialog" aria-label="Print the bill first" onClick={(event) => event.stopPropagation()}>
              <h2>Print the bill first</h2>
              <p>The POS takes payment only after the bill is printed. Printing locks the item quantities.</p>
              <div className="cancel-actions">
                <button type="button" disabled={busy} onClick={() => setPrintPrompt(false)}>
                  Back
                </button>
                <button type="button" className="is-primary" disabled={busy} onClick={printThenPay}>
                  {busy ? 'Printing…' : 'Print bill and continue'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {cancelling && bill ? (
          <div className="pay-modal-backdrop" role="presentation" onClick={() => !busy && setCancelling(false)}>
            <form className="cancel-modal" onClick={(event) => event.stopPropagation()} onSubmit={cancel}>
              <h2>Cancel {bill.id}?</h2>
              <p>The order is removed from the kitchen and the table is freed. This cannot be undone.</p>
              <label>
                Reason
                <input
                  autoFocus
                  value={reason}
                  maxLength={140}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Guest left, wrong table"
                />
              </label>
              <div className="cancel-actions">
                <button type="button" disabled={busy} onClick={() => setCancelling(false)}>
                  Keep order
                </button>
                <button type="submit" className="is-danger" disabled={busy || reason.trim().length < 3}>
                  {busy ? 'Cancelling…' : 'Cancel order'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {paying && bill ? (
          <div className="pay-modal-backdrop" role="presentation" onClick={() => !busy && setPaying(false)}>
            <form className="pay-modal" onClick={(event) => event.stopPropagation()} onSubmit={pay}>
              <section>
                <header>
                  <h2>Payment</h2>
                  <button type="button" aria-label="Close payment" onClick={() => setPaying(false)} disabled={busy}>
                    ×
                  </button>
                </header>
                <h3>Payment methods</h3>
                {(bill.modes || []).map((mode) => (
                  <label key={mode}>
                    {mode}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amounts[mode] ?? ''}
                      onChange={(event) => setAmounts((current) => ({ ...current, [mode]: event.target.value }))}
                    />
                  </label>
                ))}
                <p className={balanced ? 'is-balanced' : ''}>
                  Total entered
                  <strong>
                    {money(entered, bill.currency)} / {money(bill.total, bill.currency)}
                  </strong>
                </p>
              </section>
              <section className="pay-summary">
                <h3>Order summary</h3>
                <p>
                  Subtotal <span>{money(bill.subtotal, bill.currency)}</span>
                </p>
                <p className="pay-total">
                  Total <span>{money(bill.total, bill.currency)}</span>
                </p>
                <button type="submit" disabled={!balanced || busy}>
                  {busy ? 'Paying…' : `Pay ${money(bill.total, bill.currency)}`}
                </button>
              </section>
            </form>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export default PosOrderSheet
