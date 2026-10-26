import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/shared/api'
import { guestSitePath } from '@/shared/utils/guestLinks'
import { loadGuestAccount, saveGuestAccount } from '@/shared/utils/guestAccount'
import UryTablePicker from './UryTablePicker.jsx'

const LIVE_LABELS = {
  draft: 'Draft in POS — with the kitchen (Take Away)',
  unbilled: 'Unbilled in POS — ready for payment',
  open: 'Received by the restaurant — being prepared',
  unpaid: 'Ready for payment at the counter',
  paid: 'Paid',
  cancelled: 'Cancelled by the restaurant',
  returned: 'Returned',
}

const PENDING = new Set(['verifying', 'unknown', 'sending'])

function storageKey(slug) {
  return `iroas.uryOrder.${slug}`
}

function loadSaved(slug) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(slug)) || 'null')
  } catch {
    return null
  }
}

function save(slug, value) {
  try {
    if (value) sessionStorage.setItem(storageKey(slug), JSON.stringify(value))
    else sessionStorage.removeItem(storageKey(slug))
  } catch {
    /* sessionStorage unavailable */
  }
}

function newSubmissionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`
}

function itemsKey(items) {
  return items.map((i) => `${i.code}x${i.qty}`).join(',')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Converts an API response or ApiError into `{ status, data, code, message }`. */
function readResult(result) {
  if (result instanceof Error) {
    const data = result.data?.data || null
    if (result.status === 0 || (result.status >= 500 && !data && result.code !== 'ordering_unavailable')) {
      return { status: 'unknown', data, code: 'network', message: '' }
    }
    if (result.status === 404) return { status: 'missing', data: null, code: 'not_found', message: result.message }
    return {
      status: data?.status || 'rejected',
      data,
      code: result.code || data?.code || '',
      message: result.message,
      retryable: Boolean(data?.retryable),
    }
  }
  const data = result?.data || {}
  return { status: data.status || 'verifying', data, code: data.code || '', message: data.message || '' }
}

export default function UryCheckout({
  slug,
  cart,
  setCart,
  money,
  restaurantName,
  table = null,
  onSelectTable,
  onClearTable,
}) {
  const uryCart = useMemo(() => cart.filter((line) => line.source === 'ury' && line.code), [cart])
  const otherLines = cart.length - uryCart.length
  const savedAccount = loadGuestAccount(slug)
  const [guestName, setGuestName] = useState(() => savedAccount?.name || '')
  const [guestPhone, setGuestPhone] = useState(() => savedAccount?.phone || '')
  const [saved, setSaved] = useState(() => loadSaved(slug))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [billPanel, setBillPanel] = useState(null) // null | 'actions' | 'pay'
  const tableLocked = Boolean(table?.fromQr)
  const [service, setService] = useState(table?.fromQr || table?.dineIn ? 'dinein' : 'takeaway')
  const pollRef = useRef(null)

  useEffect(() => {
    if (table?.fromQr || table?.dineIn) setService('dinein')
  }, [table?.fromQr, table?.dineIn, table?.name])

  const persist = useCallback(
    (next) => {
      setSaved(next)
      save(slug, next)
    },
    [slug],
  )

  const applyResult = useCallback(
    (base, result) => {
      const r = readResult(result)
      if (r.status === 'placed') {
        persist({ ...base, status: 'placed', order: r.data })
        setCart((prev) => prev.filter((line) => line.source !== 'ury'))
        setError('')
        if (base.guestName && base.guestPhone) {
          saveGuestAccount(slug, {
            name: r.data?.customerName || base.guestName,
            phone: base.guestPhone,
            customerId: r.data?.customer || '',
          })
        }
        return
      }
      if (r.status === 'missing') {
        persist({ ...base, status: 'failed', message: '' })
        setError('The restaurant has no record of this order. It was not placed — you can send it again.')
        return
      }
      if (r.status === 'unknown' || r.status === 'verifying') {
        persist({
          ...base,
          status: r.status,
          message: r.message,
          retryAfterSeconds: r.data?.retryAfterSeconds || 5,
          checkedAt: Date.now(),
        })
        setError('')
        return
      }
      if (r.status === 'failed') {
        persist({ ...base, status: 'failed' })
        setError(r.message || 'We could not reach the restaurant. Your order was not placed.')
        return
      }
      persist(null)
      if (r.code === 'pos_closed') {
        setError(
          r.message ||
            'The restaurant is not accepting online orders right now (the POS shift is closed). Your order was not placed.',
        )
      } else {
        setError(r.message || 'The restaurant could not accept this order. It was not placed.')
      }
    },
    [persist, setCart, slug],
  )

  const refresh = useCallback(async () => {
    const current = loadSaved(slug)
    if (!current?.submissionId) return
    try {
      applyResult(current, await api.getPublicUryOrder(slug, current.submissionId))
    } catch (err) {
      applyResult(current, err)
    }
  }, [applyResult, slug])

  const pending = Boolean(saved && saved.channel !== 'dine' && PENDING.has(saved.status))
  const placed = saved?.status === 'placed'
  const dineInOrder = service === 'dinein' && Boolean(table?.dineIn && table?.name && !table?.code)

  useEffect(() => {
    if (saved?.channel === 'dine') return undefined
    if (!pending && !placed) return undefined
    const delay = pending ? Math.min(Math.max(saved.retryAfterSeconds || 5, 3), 15) * 1000 : 20000
    pollRef.current = setTimeout(refresh, delay)
    return () => clearTimeout(pollRef.current)
  }, [pending, placed, saved, refresh])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const items = uryCart.map((line) => ({ code: line.code, qty: line.qty }))
    if (!items.length) return
    if (!guestName.trim() || guestPhone.replace(/\D/g, '').length < 7) {
      setError('Please enter your name and a phone number so the restaurant can reach you.')
      return
    }
    if (service === 'dinein' && !table?.name) {
      setError('Choose a free table for dine-in.')
      return
    }
    if (dineInOrder) {
      const base = {
        channel: 'dine',
        items,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        tableName: table.name,
      }
      persist({ ...base, status: 'sending' })
      setBusy(true)
      try {
        const result = await api.createPublicUryDineOrder(slug, {
          table: table.name,
          guestName: base.guestName,
          guestPhone: base.guestPhone,
          items,
          pax: 1,
        })
        const data = result?.data || {}
        persist({
          ...base,
          status: 'placed',
          order: {
            status: 'placed',
            invoice: data.invoice,
            table: data.table || table.name,
            customer: data.customer,
            customerName: data.customerName || base.guestName,
            orderType: 'Dine In',
            items: uryCart.map((line) => ({
              code: line.code,
              name: line.name,
              qty: line.qty,
              amount: line.price * line.qty,
            })),
            total: uryCart.reduce((sum, line) => sum + line.price * line.qty, 0),
            live: { orderType: 'Dine In', table: data.table || table.name, state: 'unbilled' },
          },
        })
        setCart((prev) => prev.filter((line) => line.source !== 'ury'))
        saveGuestAccount(slug, {
          name: data.customerName || base.guestName,
          phone: base.guestPhone,
          customerId: data.customer || '',
        })
        setError('')
      } catch (err) {
        persist(null)
        setError(err?.message || 'The restaurant could not accept this dine-in order. It was not placed.')
      } finally {
        setBusy(false)
      }
      return
    }
    const key = `${table?.code || 'pickup'}|${itemsKey(items)}`
    const reuse = saved && saved.channel !== 'dine' && saved.itemsKey === key && saved.status !== 'placed'
    const base = {
      submissionId: reuse ? saved.submissionId : newSubmissionId(),
      itemsKey: key,
      items,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      ...(table?.code ? { tableCode: table.code } : {}),
    }
    persist({ ...base, status: 'sending' })
    setBusy(true)
    try {
      applyResult(base, await api.createPublicUryOrder(slug, base))
    } catch (err) {
      applyResult(base, err)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!saved?.submissionId) return
    setBusy(true)
    setError('')
    const { submissionId, items, guestName: name, guestPhone: phone, tableCode } = saved
    try {
      applyResult(
        saved,
        await api.createPublicUryOrder(slug, {
          submissionId,
          items,
          guestName: name,
          guestPhone: phone,
          ...(tableCode ? { tableCode } : {}),
        }),
      )
    } catch (err) {
      applyResult(saved, err)
    } finally {
      setBusy(false)
    }
  }

  const changeQty = (lineKey, delta) => {
    setCart((prev) =>
      prev
        .map((line) => (line.lineKey === lineKey ? { ...line, qty: Math.min(20, line.qty + delta) } : line))
        .filter((line) => line.qty > 0),
    )
  }

  const openBillPanel = () => {
    setError('')
    setBillPanel('actions')
  }

  const requestBill = async () => {
    if (!saved?.submissionId) return
    setBusy(true)
    setError('')
    try {
      const result = await api.requestPublicUryBill(slug, saved.submissionId)
      const data = result?.data
      if (data?.status === 'placed') {
        persist({ ...saved, status: 'placed', order: data })
        setError('')
        setBillPanel('actions')
      } else if (/not enabled/i.test(result?.error || '')) {
        openBillPanel()
      } else {
        setError(result?.error || 'The restaurant could not prepare the bill.')
      }
    } catch (err) {
      if (/not enabled/i.test(err?.message || '') || err?.code === 'bill_not_enabled') {
        openBillPanel()
      } else {
        setError(err?.message || 'The restaurant could not prepare the bill. Please ask the staff.')
      }
    } finally {
      setBusy(false)
    }
  }

  const printBill = () => {
    setError('')
    const order = saved?.order || {}
    const live = order.live
    const channel =
      live?.orderType || (order.table || live?.table ? 'Dine In' : 'Take Away')
    const ref = order.pickupCode || order.invoice || saved?.submissionId || ''
    const total = live?.total ?? order.total
    const lines = (order.items || [])
      .map(
        (it) =>
          `<tr><td>${Number(it.qty) || 0}× ${escapeHtml(it.name || it.code || '')}</td><td style="text-align:right">${escapeHtml(money(it.amount))}</td></tr>`,
      )
      .join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bill ${escapeHtml(ref)}</title>
<style>
  body{font-family:Georgia,serif;padding:24px;color:#17171a;max-width:420px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#666;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:16px 0} td{padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
  .total{font-size:18px;font-weight:700;margin-top:12px}
</style></head><body>
  <h1>${escapeHtml(restaurantName || 'Bill')}</h1>
  <p class="muted">${escapeHtml(channel)}${order.table || live?.table ? ` · Table ${escapeHtml(order.table || live?.table)}` : ''} · ${escapeHtml(ref)}</p>
  ${order.customerName ? `<p class="muted">Customer: ${escapeHtml(order.customerName)}</p>` : ''}
  <table>${lines}</table>
  <p class="total">Total ${escapeHtml(money(total))}</p>
  <p class="muted">Payment: ${escapeHtml(live?.state === 'paid' ? 'Paid' : 'Pay at the counter')}</p>
</body></html>`
    // Hidden iframe — no pop-up blocker
    let iframe = document.getElementById('gs-bill-print-frame')
    if (!iframe) {
      iframe = document.createElement('iframe')
      iframe.id = 'gs-bill-print-frame'
      iframe.title = 'Print bill'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
      document.body.appendChild(iframe)
    }
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    const win = iframe.contentWindow
    if (!doc || !win) {
      setError('Could not open the print dialog. Try again.')
      return
    }
    doc.open()
    doc.write(html)
    doc.close()
    const trigger = () => {
      try {
        win.focus()
        win.print()
      } catch {
        setError('Could not open the print dialog. Try again.')
      }
    }
    if (doc.readyState === 'complete') setTimeout(trigger, 50)
    else iframe.onload = () => setTimeout(trigger, 50)
  }

  if (placed) {
    const order = saved.order || {}
    const live = order.live
    const channel =
      live?.orderType ||
      (order.table || live?.table ? 'Dine In' : 'Take Away')
    const statusText = live
      ? LIVE_LABELS[live.state] || live.posStatus || 'Received'
      : 'Received'
    const showBillActions =
      billPanel === 'actions' || billPanel === 'pay' || live?.billed || live?.billReady
    const showPayOptions = billPanel === 'pay'
    const dineIn = channel === 'Dine In' || Boolean(order.table || live?.table)
    const payAtCounter = live?.canPayAtCounter !== false
    return (
      <section className="gs-checkout-page" aria-live="polite">
        <h1>Order placed</h1>
        <div className="gs-checkout-card">
          <p>
            <strong>{restaurantName}</strong> received your order in its POS.
          </p>
          {order.customerName || order.guestDetailsStoredInPos ? (
            <p>
              Customer in POS:{' '}
              <strong>{order.customerName || 'Saved'}</strong>
              {order.guestDetailsStoredInPos ? ' · linked to your phone' : ''}
            </p>
          ) : null}
          <p>
            {dineIn ? (
              <>
                Dine In · Table <strong>{order.table || live?.table}</strong>
              </>
            ) : (
              <>
                Take Away · Pickup code <strong>{order.pickupCode || order.invoice}</strong>
              </>
            )}
            {order.invoice ? ` · Ref ${order.invoice}` : ''}
          </p>
          <ul className="gs-ury-lines">
            {(order.items || []).map((it) => (
              <li key={`${it.code}-${it.comment}`}>
                <span>
                  {it.qty}× {it.name}
                </span>
                <b>{money(it.amount)}</b>
              </li>
            ))}
          </ul>
          {(live?.total ?? order.total) != null ? (
            <p>
              Total charged by the POS: <strong>{money(live?.total ?? order.total)}</strong> ·{' '}
              {dineIn ? 'pay when staff bring the bill' : 'pay at the counter'}
            </p>
          ) : null}
          <p className="gs-muted">
            Payment status: <strong>{statusText}</strong>
            {live?.billed ? ' · Bill requested' : ''}
            {live?.posStatus ? ` · POS: ${live.posStatus}` : ''}
          </p>

          {showBillActions ? (
            <div className="gs-bill-actions" role="region" aria-label="Bill options">
              <p className="gs-bill-actions-title">Print &amp; payment</p>
              <p className="gs-muted">
                {payAtCounter
                  ? 'This restaurant uses pay at the counter. Print your bill, then staff take Cash / Card in the POS (same as the Payment screen).'
                  : 'Print a copy for yourself, then pay at the restaurant POS.'}
              </p>
              <div className="gs-form-actions">
                <button type="button" className="gs-btn primary" onClick={printBill}>
                  Print bill
                </button>
                <button
                  type="button"
                  className="gs-btn primary"
                  onClick={() => setBillPanel(showPayOptions ? 'actions' : 'pay')}
                >
                  {showPayOptions ? 'Hide payment' : 'Payment options'}
                </button>
              </div>
              {showPayOptions ? (
                <ul className="gs-pay-options">
                  <li>
                    <strong>{dineIn ? 'Pay at your table' : 'Pay at the counter'}</strong>
                    <span className="gs-muted">
                      {' '}
                      — show code <strong>{order.pickupCode || order.invoice}</strong> and pay{' '}
                      <strong>{money(live?.total ?? order.total)}</strong> (cash or card).
                    </span>
                  </li>
                  <li>
                    <strong>After you pay</strong>
                    <span className="gs-muted"> — tap Refresh status, or </span>
                    <Link
                      className="gs-text-cta"
                      to={`${guestSitePath(slug, 'tracking')}?code=${encodeURIComponent(order.invoice || '')}&phone=${encodeURIComponent(guestPhone || saved?.guestPhone || '')}`}
                    >
                      track payment
                    </Link>
                    <span className="gs-muted"> until it shows Paid.</span>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="gs-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="gs-form-actions">
            <button type="button" className="gs-btn" onClick={refresh} disabled={busy}>
              Refresh status
            </button>
            {live?.canRequestBill ? (
              <button type="button" className="gs-btn primary" onClick={requestBill} disabled={busy}>
                {busy ? 'Requesting…' : 'Request bill'}
              </button>
            ) : null}
            {!live?.canRequestBill && !showBillActions && live?.state !== 'paid' ? (
              <button type="button" className="gs-btn primary" onClick={openBillPanel}>
                Print &amp; payment
              </button>
            ) : null}
            <button type="button" className="gs-btn" onClick={() => persist(null)}>
              Start a new order
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (pending) {
    return (
      <section className="gs-checkout-page" aria-live="polite">
        <h1>Confirming your order</h1>
        <div className="gs-checkout-card">
          <p>
            {saved.message ||
              'We are confirming your order with the restaurant. Please do not order again — this page updates automatically.'}
          </p>
          <p className="gs-muted">Order reference: {saved.submissionId}</p>
          <div className="gs-form-actions">
            <button type="button" className="gs-btn" disabled={busy} onClick={refresh}>
              Check again
            </button>
            {saved.status === 'unknown' ? (
              <button type="button" className="gs-btn primary" disabled={busy} onClick={resend}>
                Try sending again
              </button>
            ) : null}
          </div>
          <p className="gs-muted">
            “Try sending again” is safe: the restaurant’s POS is checked first, so your order will never be placed twice.
          </p>
        </div>
      </section>
    )
  }

  const estimate = uryCart.reduce((sum, line) => sum + line.price * line.qty, 0)
  const accountLinked = Boolean(savedAccount?.customerId && savedAccount?.phone)

  return (
    <section className="gs-checkout-page">
      <div className="gs-checkout-hero">
        <p className="gs-kicker">{service === 'dinein' ? 'Dine in' : 'Take away'} checkout</p>
        <h1>{service === 'dinein' && table?.name ? `Checkout · Table ${table.name}` : 'Checkout'}</h1>
        <p className="gs-muted">
          {dineInOrder
            ? `Your name and phone are saved as the customer on ${table.name}. The order is sent to the POS and the table shows as occupied.`
            : 'Confirm your items and details. The order goes to the restaurant POS; you pay at the counter.'}
        </p>
        <ol className="gs-checkout-steps" aria-label="Checkout steps">
          <li className="is-done">
            <span className="gs-step-dot" aria-hidden="true">
              1
            </span>
            Menu
          </li>
          <li className="is-active">
            <span className="gs-step-dot" aria-hidden="true">
              2
            </span>
            Checkout
          </li>
          <li>
            <span className="gs-step-dot" aria-hidden="true">
              3
            </span>
            In the kitchen
          </li>
        </ol>
      </div>

      {tableLocked ? null : (
        <div className="gs-checkout-card">
          <div className="gs-checkout-card-head">
            <h2>Order type</h2>
          </div>
          <div className="gs-order-mode-cards is-two" role="radiogroup" aria-label="Dine in or take away">
            <button
              type="button"
              role="radio"
              aria-checked={service === 'dinein'}
              className={`gs-order-mode-card${service === 'dinein' ? ' is-active' : ''}`}
              onClick={() => setService('dinein')}
            >
              <strong>Dine in</strong>
              <span>Choose a table. The order occupies that table in the POS.</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={service === 'takeaway'}
              className={`gs-order-mode-card${service === 'takeaway' ? ' is-active' : ''}`}
              onClick={() => {
                setService('takeaway')
                onClearTable?.()
              }}
            >
              <strong>Take away</strong>
              <span>Pickup at the counter. No table is assigned.</span>
            </button>
          </div>
          {service === 'dinein' ? (
            <UryTablePicker slug={slug} selectedName={table?.name || ''} onSelect={(picked) => onSelectTable?.(picked)} />
          ) : null}
        </div>
      )}

      {otherLines > 0 ? (
        <p className="gs-pos-note is-warning">
          {otherLines} item(s) in your cart are not on the live menu and will not be sent.
        </p>
      ) : null}

      {!uryCart.length ? (
        <div className="gs-checkout-card gs-checkout-empty">
          <p className="gs-muted">Your cart is empty. Add dishes from the menu, then come back to check out.</p>
          <Link className="gs-btn primary" to={guestSitePath(slug, 'menu')}>
            Browse menu
          </Link>
          {error ? (
            <p className="gs-form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <form className="gs-checkout-layout is-checkout" onSubmit={submit}>
          <div className="gs-checkout-main">
            <div className="gs-checkout-card">
              <div className="gs-checkout-card-head">
                <h2>Contact</h2>
                {accountLinked ? (
                  <span className="gs-soft-pill">POS account</span>
                ) : (
                  <Link className="gs-text-cta" to={guestSitePath(slug, 'account')}>
                    Open account
                  </Link>
                )}
              </div>
              <div className="gs-form-grid two">
                <label>
                  Full name
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+91…"
                    required
                  />
                </label>
              </div>
              <p className="gs-muted gs-checkout-hint">
                Saved as the customer on your POS order so the kitchen and counter can find you. Use the same phone on
                Account to track orders.
              </p>
            </div>

            <div className="gs-checkout-card">
              <div className="gs-checkout-card-head">
                <h2>Payment</h2>
              </div>
              <p className="gs-pay-method">
                <strong>{service === 'dinein' ? 'Pay at the table' : 'Pay at the counter'}</strong>
                <span className="gs-muted">
                  {' '}
                  — cash or card in the restaurant POS after you place the order. No online card charge on this site.
                </span>
              </p>
            </div>
          </div>

          <aside className="gs-checkout-card gs-checkout-summary">
            <h2>Order summary</h2>
            <ul className="gs-ury-lines">
              {uryCart.map((line) => (
                <li key={line.lineKey}>
                  <span>{line.name}</span>
                  <span className="gs-qty" aria-label={`Quantity of ${line.name}`}>
                    <button type="button" onClick={() => changeQty(line.lineKey, -1)} aria-label="Decrease quantity">
                      −
                    </button>
                    <strong>{line.qty}</strong>
                    <button type="button" onClick={() => changeQty(line.lineKey, 1)} aria-label="Increase quantity">
                      +
                    </button>
                  </span>
                  <b>{money(line.price * line.qty)}</b>
                </li>
              ))}
            </ul>
            <div className="gs-checkout-total">
              <span>Estimated total</span>
              <strong>{money(estimate)}</strong>
            </div>
            <p className="gs-muted gs-checkout-hint">
              Final total is set by the POS when the kitchen accepts the order.
            </p>
            {error ? (
              <p className="gs-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="gs-btn primary gs-wide" disabled={busy || (service === 'dinein' && !table?.name)}>
              {busy
                ? 'Sending to the restaurant…'
                : service === 'dinein'
                  ? table?.name
                    ? `Send to kitchen · ${table.name}`
                    : 'Choose a table'
                  : 'Place takeaway order'}
            </button>
            <Link className="gs-btn ghost gs-wide" to={guestSitePath(slug, 'menu')}>
              Add more from menu
            </Link>
          </aside>
        </form>
      )}
    </section>
  )
}
