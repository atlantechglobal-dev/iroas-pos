import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/shared/api'
import { guestSitePath } from '@/shared/utils/guestLinks'

const LIVE_LABELS = {
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

export default function UryCheckout({ slug, cart, setCart, money, restaurantName }) {
  const uryCart = useMemo(() => cart.filter((line) => line.source === 'ury' && line.code), [cart])
  const otherLines = cart.length - uryCart.length
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [saved, setSaved] = useState(() => loadSaved(slug))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pollRef = useRef(null)

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
    [persist, setCart],
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

  const pending = Boolean(saved && PENDING.has(saved.status))
  const placed = saved?.status === 'placed'

  useEffect(() => {
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
    const key = itemsKey(items)
    const reuse = saved && saved.itemsKey === key && saved.status !== 'placed'
    const base = {
      submissionId: reuse ? saved.submissionId : newSubmissionId(),
      itemsKey: key,
      items,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
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
    const { submissionId, items, guestName: name, guestPhone: phone } = saved
    try {
      applyResult(saved, await api.createPublicUryOrder(slug, { submissionId, items, guestName: name, guestPhone: phone }))
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

  if (placed) {
    const order = saved.order || {}
    const live = order.live
    return (
      <section className="gs-checkout-page" aria-live="polite">
        <h1>Order placed</h1>
        <div className="gs-checkout-card">
          <p>
            <strong>{restaurantName}</strong> received your order in its POS.
          </p>
          <p>
            Pickup code: <strong>{order.pickupCode || order.invoice}</strong>
            {order.invoice && order.pickupCode && order.pickupCode !== order.invoice ? ` · Ref ${order.invoice}` : ''}
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
          {order.total != null ? (
            <p>
              Total charged by the POS: <strong>{money(order.total)}</strong> · pay at the counter
            </p>
          ) : null}
          <p className="gs-muted">
            Status: {live ? LIVE_LABELS[live.state] || live.posStatus || 'Received' : 'Received'}
          </p>
          <div className="gs-form-actions">
            <button type="button" className="gs-btn" onClick={refresh}>
              Refresh status
            </button>
            <button type="button" className="gs-btn primary" onClick={() => persist(null)}>
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

  return (
    <section className="gs-checkout-page">
      <h1>Order for pickup</h1>
      {otherLines > 0 ? (
        <p className="gs-pos-note is-warning">
          {otherLines} item(s) in your cart are not on the live menu and will not be sent.
        </p>
      ) : null}
      {!uryCart.length ? (
        <div className="gs-checkout-card">
          <p className="gs-muted">Your cart is empty.</p>
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
        <form className="gs-checkout-layout" onSubmit={submit}>
          <div className="gs-checkout-card">
            <h2>Your order</h2>
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
            <p className="gs-muted">
              Menu estimate: {money(uryCart.reduce((sum, line) => sum + line.price * line.qty, 0))}. The restaurant’s
              POS sets the final price when it accepts the order. Payment is at the counter.
            </p>
          </div>
          <div className="gs-checkout-card">
            <h2>Your details</h2>
            <div className="gs-form-grid two">
              <label>
                Full name
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" required />
              </label>
              <label>
                Phone
                <input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </label>
            </div>
            <p className="gs-muted">
              Your name and phone are kept by IROAS so the restaurant can contact you; they are not yet stored in the
              restaurant’s POS.
            </p>
            {error ? (
              <p className="gs-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="gs-btn primary" disabled={busy}>
              {busy ? 'Sending to the restaurant…' : 'Place pickup order'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
