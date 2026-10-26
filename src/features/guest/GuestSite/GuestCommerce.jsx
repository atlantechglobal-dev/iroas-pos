import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { guestDishPath, guestSitePath } from '@/shared/utils/guestLinks'
import { api } from '@/shared/lib/api'
import { QrCodePreview } from '@/shared/ui/QrCodePreview'
import {
  guestPhoneHint,
  loadGuestOrderHistory,
  rememberGuestOrder,
} from '@/shared/utils/guestOrderHistory'
import { clearGuestAccount, loadGuestAccount, saveGuestAccount } from '@/shared/utils/guestAccount'

function formatPrice(n) {
  return `₹${Math.round(Number(n) || 0)}`
}

function localDateIso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function DishThumb({ src, alt = '' }) {
  const [broken, setBroken] = useState(false)
  const resolved = src && !broken ? src : ''
  useEffect(() => {
    setBroken(false)
  }, [src])
  if (resolved) {
    return (
      <img
        src={resolved}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    )
  }
  return (
    <div className="gs-photo placeholder" aria-hidden="true">
      <span>{String(alt || '·').charAt(0).toUpperCase()}</span>
    </div>
  )
}

const CHECKOUT_STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'delivery', label: 'Service' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
]

const TAKEAWAY_PAYMENT_OPTIONS = [
  { id: 'upi', label: 'UPI', badge: 'Pay via QR' },
  { id: 'cash', label: 'Cash', badge: 'Pay at counter' },
]

const TABLE_PAYMENT_OPTIONS = [
  { id: 'bill', label: 'Pay bill now', badge: 'UPI / Cash' },
  { id: 'pay_later', label: 'Pay later', badge: 'Settle at table' },
]

function upiPayUri(upiId, payeeName, amount) {
  if (!upiId) return ''
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName || 'Restaurant',
    am: String(Math.round(Number(amount) || 0)),
    cu: 'INR',
  })
  return `upi://pay?${params.toString()}`
}

function trackStepsForStatus(status) {
  const flow = ['new', 'accepted', 'preparing', 'ready', 'completed']
  const idx = Math.max(0, flow.indexOf(status || 'new'))
  const labels = ['Received', 'Accepted', 'Preparing', 'Ready', 'Completed']
  return labels.map((label, i) => ({
    label,
    state: i < idx ? 'done' : i === idx ? 'active' : 'pending',
  }))
}

/** Kitchen lane step → guest track strip status. */
function statusFromKitchenStep(step) {
  if (step === 'received') return 'new'
  if (step === 'accepted') return 'accepted'
  if (step === 'preparing') return 'preparing'
  if (step === 'ready') return 'ready'
  if (step === 'completed') return 'completed'
  return 'new'
}

function mapUryTrackToGuestOrder(data) {
  if (!data?.id) return null
  const state = data.state || ''
  const paid = state === 'paid'
  const kitchenStep = data.kitchenStep || (paid ? 'completed' : 'received')
  return {
    publicCode: data.id,
    id: data.id,
    status: statusFromKitchenStep(kitchenStep),
    kitchenStep,
    kitchenLabel: data.kitchenLabel || '',
    items: (data.items || []).map((it) => ({
      id: it.id,
      name: it.name,
      qty: it.qty,
      price: it.rate,
      unitPrice: it.rate,
      amount: it.amount,
    })),
    total: data.total,
    subtotal: data.total,
    paymentStatus: paid ? 'paid' : 'payment_pending',
    paymentTiming: paid ? 'paid' : 'pay_later',
    paymentMethod: paid ? 'pos' : 'pay_at_counter',
    serviceMode: String(data.orderType || '').toLowerCase().includes('dine') ? 'dinein' : 'takeaway',
    tableName: data.table || '',
    phone: data.phone || '',
    customer: data.customer || '',
    posState: state,
    posStatus: data.posStatus || '',
    paymentLabel: data.paymentLabel || '',
    currency: data.currency || null,
    orderType: data.orderType || '',
    fromPos: true,
  }
}

function OrderSummaryCard({ cart, subtotal, deliveryFee, gst, total, serviceMode }) {
  return (
    <aside className="gs-summary-card">
      <h3>Order summary</h3>
      <ul className="gs-summary-lines">
        {cart.map((item) => (
          <li key={item.lineKey || item.id || item.name}>
            <span>
              {item.qty}× {item.name}
            </span>
            <b>{formatPrice(item.price * item.qty)}</b>
          </li>
        ))}
      </ul>
      <div className="gs-summary-break">
        <div>
          <span>Subtotal</span>
          <b>{formatPrice(subtotal)}</b>
        </div>
        <div>
          <span>Delivery</span>
          <b>{serviceMode === 'delivery' ? formatPrice(deliveryFee) : 'Free'}</b>
        </div>
        <div>
          <span>GST</span>
          <b>{formatPrice(gst)}</b>
        </div>
      </div>
      <div className="gs-summary-total">
        <span>Total</span>
        <strong>{formatPrice(total)}</strong>
      </div>
    </aside>
  )
}

function CheckoutStepper({ stepIndex }) {
  return (
    <ol className="gs-checkout-steps" aria-label="Checkout progress">
      {CHECKOUT_STEPS.map((step, i) => {
        const done = i < stepIndex
        const active = i === stepIndex
        return (
          <li key={step.id} className={done ? 'is-done' : active ? 'is-active' : ''}>
            <span className="gs-step-dot">{done ? '✓' : i + 1}</span>
            <em>{step.label}</em>
          </li>
        )
      })}
    </ol>
  )
}

export function GuestCartPage({
  slug,
  cart,
  setCart,
  serviceMode,
  setServiceMode,
  coupon,
  setCoupon,
  photoFor,
  tableSession = null,
  setTableSession,
  diningTables = [],
}) {
  const navigate = useNavigate()
  const [couponInput, setCouponInput] = useState(coupon || '')
  const tableLocked = Boolean(tableSession?.id) && Boolean(tableSession?.fromQr)

  const itemCount = cart.reduce((n, i) => n + i.qty, 0)
  const readyMins = Math.max(
    18,
    ...cart.map((i) => (Number(i.prepMinutes) || 12) + (i.qty > 1 ? 4 : 0)),
    0,
  )
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const deliveryFee = serviceMode === 'delivery' ? 49 : 0
  const discount = coupon === 'IROAS10' ? Math.round(subtotal * 0.1) : 0
  const taxable = Math.max(0, subtotal - discount)
  const gst = Math.round(taxable * 0.05)
  const total = taxable + deliveryFee + gst

  const updateQty = (lineKey, nextQty) => {
    setCart((prev) =>
      prev
        .map((item) => {
          const key = item.lineKey || item.id || item.name
          if (key !== lineKey) return item
          return { ...item, qty: nextQty }
        })
        .filter((item) => item.qty > 0),
    )
  }

  const removeItem = (lineKey) => {
    setCart((prev) => prev.filter((item) => (item.lineKey || item.id || item.name) !== lineKey))
  }

  if (!cart.length) {
    return (
      <section className="gs-cart-page">
        <div className="gs-cart-empty">
          <h1>Your cart</h1>
          <p className="gs-muted">No dishes yet — add something from the menu.</p>
          <Link className="gs-btn primary" to={guestSitePath(slug, 'menu')}>
            Browse menu
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="gs-cart-page">
      <div className="gs-cart-layout">
        <div>
          <h1>Your cart</h1>
          <p className="gs-cart-meta">
            {itemCount} item{itemCount === 1 ? '' : 's'} · ready in about {readyMins} min
          </p>

          <div className="gs-order-mode-cards" role="group" aria-label="How are you ordering?">
            <button
              type="button"
              className={`gs-order-mode-card${serviceMode === 'dinein' ? ' is-active' : ''}`}
              disabled={tableLocked}
              onClick={() => {
                setServiceMode('dinein')
              }}
            >
              <strong>At table</strong>
              <span>Order from your reserved / dining table</span>
            </button>
            <button
              type="button"
              className={`gs-order-mode-card${serviceMode === 'pickup' ? ' is-active' : ''}`}
              disabled={tableLocked}
              onClick={() => {
                setServiceMode('pickup')
                setTableSession?.(null)
              }}
            >
              <strong>Takeaway</strong>
              <span>Order now, collect at the counter</span>
            </button>
            <button
              type="button"
              className={`gs-order-mode-card${serviceMode === 'delivery' ? ' is-active' : ''}`}
              disabled={tableLocked}
              onClick={() => {
                setServiceMode('delivery')
                setTableSession?.(null)
              }}
            >
              <strong>Delivery</strong>
              <span>We bring it to your address</span>
            </button>
          </div>

          {serviceMode === 'dinein' && !tableLocked ? (
            <label className="gs-table-picker">
              Select table
              <select
                value={tableSession?.id ? String(tableSession.id) : ''}
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) {
                    setTableSession?.(null)
                    return
                  }
                  const t = diningTables.find((row) => String(row.id) === id)
                  if (t) setTableSession?.({ ...t, fromQr: false })
                }}
              >
                <option value="">Choose a table…</option>
                {diningTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.zone ? ` · ${t.zone}` : ''} ({t.seats} seats)
                  </option>
                ))}
              </select>
              {diningTables.length === 0 ? (
                <small className="gs-muted">No tables listed yet — scan a table QR or ask staff.</small>
              ) : null}
            </label>
          ) : null}

          {tableSession?.name ? (
            <p className="gs-table-banner">
              Ordering for <strong>{tableSession.name}</strong>
              {tableLocked ? ' · from QR' : ''}
            </p>
          ) : null}

          <div className="gs-cart-list">
            {cart.map((item) => {
              const key = item.lineKey || item.id || item.name
              return (
                <article className="gs-cart-row" key={key}>
                  <div className="gs-cart-thumb">
                    <DishThumb src={photoFor?.(item) || item.imageDataUrl} alt={item.name} />
                  </div>
                  <div className="gs-cart-info">
                    <strong>{item.name}</strong>
                    <p>{item.desc || 'Prepared fresh to order.'}</p>
                    <div className="gs-qty compact">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => updateQty(key, item.qty - 1)}
                      >
                        −
                      </button>
                      <strong>{item.qty}</strong>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => updateQty(key, item.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="gs-cart-side">
                    <button
                      type="button"
                      className="gs-trash"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(key)}
                    />
                    <b>{formatPrice(item.price * item.qty)}</b>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <aside className="gs-summary-card">
          <h3>Order summary</h3>
          <div className="gs-coupon-row">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Add coupon"
              aria-label="Coupon code"
            />
            <button
              type="button"
              className="gs-btn dark"
              onClick={() => setCoupon(couponInput.trim().toUpperCase())}
            >
              Apply
            </button>
          </div>
          {discount > 0 ? <p className="gs-coupon-ok">Coupon applied · −{formatPrice(discount)}</p> : null}
          <div className="gs-summary-break">
            <div>
              <span>Subtotal</span>
              <b>{formatPrice(subtotal)}</b>
            </div>
            <div>
              <span>Delivery</span>
              <b>{serviceMode === 'delivery' ? formatPrice(deliveryFee) : 'Free'}</b>
            </div>
            <div>
              <span>GST</span>
              <b>{formatPrice(gst)}</b>
            </div>
          </div>
          <div className="gs-summary-total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <button
            type="button"
            className="gs-btn primary gs-wide"
            onClick={() => navigate(guestSitePath(slug, 'checkout'))}
          >
            Continue to checkout
          </button>
          <p className="gs-fine">No charge yet · cancel anytime before kitchen accepts</p>
        </aside>
      </div>
    </section>
  )
}

export function GuestCheckoutPage({
  slug,
  cart,
  setCart,
  serviceMode,
  checkout,
  setCheckout,
  onPlaced,
  restaurantContact = {},
  payments = {},
  tableSession = null,
}) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [placeError, setPlaceError] = useState('')

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const deliveryFee = serviceMode === 'delivery' ? 49 : 0
  const gst = Math.round(subtotal * 0.05)
  const total = subtotal + deliveryFee + gst
  const restaurantUpi = payments.upiId || ''
  const payeeName = payments.upiDisplayName || restaurantContact.name || 'Restaurant'
  const upiUri = upiPayUri(restaurantUpi, payeeName, total)

  if (!cart.length) {
    return (
      <section className="gs-checkout-page">
        <h1>Checkout</h1>
        <p className="gs-muted">Your cart is empty.</p>
        <Link className="gs-btn primary" to={guestSitePath(slug, 'menu')}>
          Browse menu
        </Link>
      </section>
    )
  }

  const goBack = () => {
    if (step === 0) navigate(guestSitePath(slug, 'order'))
    else setStep((s) => s - 1)
  }

  const goNext = async () => {
    setPlaceError('')
    if (step === 0) {
      if (!String(checkout.name || '').trim() || !String(checkout.phone || '').trim()) {
        setPlaceError('Name and phone are required.')
        return
      }
    }
    if (step === 1 && serviceMode === 'delivery' && !String(checkout.street || '').trim()) {
      setPlaceError('Add a delivery street address.')
      return
    }
    if (step === 1 && serviceMode === 'dinein' && !tableSession?.id) {
      setPlaceError('Select a dining table for table orders.')
      return
    }
    if (step < CHECKOUT_STEPS.length - 1) {
      if (step === 1 && serviceMode === 'dinein') {
        setCheckout((prev) => ({
          ...prev,
          payment: prev.payment === 'pay_later' ? 'pay_later' : 'bill',
          billPay: prev.billPay || 'upi',
        }))
      }
      setStep((s) => s + 1)
      return
    }

    setSubmitting(true)
    try {
      const method =
        checkout.payment === 'upi' || checkout.billPay === 'upi'
          ? 'upi'
          : checkout.payment === 'pay_later'
            ? 'pay_later'
            : 'cash'
      const paymentTiming =
        serviceMode === 'dinein' && checkout.payment === 'pay_later' ? 'pay_later' : 'bill_now'
      const { order } = await api.createPublicOrder(slug, {
        guestName: checkout.name,
        phone: checkout.phone,
        email: checkout.email,
        serviceMode,
        paymentMethod: method === 'pay_later' ? checkout.billPay || 'cash' : method,
        paymentTiming,
        preferredPayment: checkout.billPay || 'cash',
        diningTableId: tableSession?.id || null,
        tableCode: tableSession?.publicCode || null,
        street: checkout.street,
        city: checkout.city,
        pincode: checkout.pincode,
        notes: checkout.instructions,
        deliveryFee,
        items: cart.map((item) => ({
          id: item.id,
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          qty: item.qty,
          extras: item.mods || item.extras || [],
        })),
      })
      const placed = {
        id: order.publicCode,
        publicCode: order.publicCode,
        total: order.total,
        etaMinutes: order.etaMinutes,
        items: order.items,
        checkout,
        serviceMode: order.serviceMode,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentTiming: order.paymentTiming,
        tableName: order.tableName,
        phone: order.phone,
        createdAt: order.createdAt,
      }
      rememberGuestOrder(slug, placed)
      onPlaced?.(placed)
      navigate(guestSitePath(slug, 'placed'))
      setCart([])
    } catch (err) {
      setPlaceError(err.message || 'Unable to place order.')
    } finally {
      setSubmitting(false)
    }
  }

  const patch = (fields) => setCheckout((prev) => ({ ...prev, ...fields }))

  return (
    <section className="gs-checkout-page">
      <h1>Checkout</h1>
      <CheckoutStepper stepIndex={step} />

      <div className="gs-checkout-layout">
        <div className="gs-checkout-card">
          {step === 0 ? (
            <>
              <h2>
                <span className="gs-card-ico person" aria-hidden="true" />
                Your details
              </h2>
              <div className="gs-form-grid two">
                <label>
                  Full name
                  <input
                    value={checkout.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="Ashley Rein"
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={checkout.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    placeholder={restaurantContact.phone || '+91 98xxxxxxxx'}
                  />
                </label>
                <label className="full">
                  Email
                  <input
                    type="email"
                    value={checkout.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder={restaurantContact.email || 'you@email.com'}
                  />
                </label>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2>
                <span className="gs-card-ico pin" aria-hidden="true" />
                {serviceMode === 'delivery'
                  ? 'Delivery'
                  : serviceMode === 'dinein'
                    ? 'Dine-in'
                    : 'Takeaway'}
              </h2>
              {serviceMode === 'delivery' ? (
                <div className="gs-form-grid two">
                  <label className="full">
                    Street
                    <input
                      value={checkout.street}
                      onChange={(e) => patch({ street: e.target.value })}
                      placeholder="House / street"
                    />
                  </label>
                  <label>
                    City
                    <input
                      value={checkout.city}
                      onChange={(e) => patch({ city: e.target.value })}
                    />
                  </label>
                  <label>
                    Pincode
                    <input
                      value={checkout.pincode}
                      onChange={(e) => patch({ pincode: e.target.value })}
                    />
                  </label>
                  <label className="full">
                    Instructions
                    <input
                      value={checkout.instructions}
                      onChange={(e) => patch({ instructions: e.target.value })}
                      placeholder="Gate code, landmark…"
                    />
                  </label>
                </div>
              ) : (
                <div className="gs-form-grid">
                  {serviceMode === 'dinein' ? (
                    <p className="gs-muted">
                      {tableSession?.name
                        ? `Ordering for table ${tableSession.name}. Staff will bring food to your table.`
                        : 'Dine-in order — tell staff your name when you arrive, or scan a table QR.'}
                    </p>
                  ) : (
                    <p className="gs-muted">
                      Takeaway / pickup — we will prepare your order for collection at the counter.
                    </p>
                  )}
                  <label className="full">
                    Notes for kitchen
                    <input
                      value={checkout.instructions}
                      onChange={(e) => patch({ instructions: e.target.value })}
                      placeholder="No onion, extra spicy…"
                    />
                  </label>
                </div>
              )}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2>
                <span className="gs-card-ico pay" aria-hidden="true" />
                Payment
              </h2>
              {serviceMode === 'dinein' ? (
                <>
                  <div className="gs-pay-list">
                    {TABLE_PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`gs-pay-option${checkout.payment === opt.id ? ' is-active' : ''}`}
                        onClick={() =>
                          patch({
                            payment: opt.id,
                            billPay: checkout.billPay || 'upi',
                          })
                        }
                      >
                        <strong>{opt.label}</strong>
                        {opt.badge ? <em>{opt.badge}</em> : null}
                      </button>
                    ))}
                  </div>
                  {checkout.payment === 'bill' ? (
                    <div className="gs-upi-merchant">
                      <p className="gs-muted">Pay your table bill now.</p>
                      <div className="gs-pay-list compact">
                        {TAKEAWAY_PAYMENT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`gs-pay-option${(checkout.billPay || 'upi') === opt.id ? ' is-active' : ''}`}
                            onClick={() => patch({ billPay: opt.id, payment: 'bill' })}
                          >
                            <strong>{opt.label}</strong>
                          </button>
                        ))}
                      </div>
                      {(checkout.billPay || 'upi') === 'upi' ? (
                        restaurantUpi ? (
                          <>
                            <p className="gs-upi-id">
                              UPI ID: <code>{restaurantUpi}</code>
                            </p>
                            <div className="gs-upi-qr">
                              <QrCodePreview value={upiUri} size={180} alt="Restaurant UPI QR" />
                            </div>
                          </>
                        ) : (
                          <p className="gs-muted">UPI ID not set — choose Cash or Pay later.</p>
                        )
                      ) : (
                        <p className="gs-muted">Pay cash to staff when the bill is brought to your table.</p>
                      )}
                    </div>
                  ) : (
                    <p className="gs-muted">
                      Order now and settle the bill later at the table. Staff will mark payment when you
                      are ready.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="gs-pay-list">
                    {TAKEAWAY_PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`gs-pay-option${checkout.payment === opt.id ? ' is-active' : ''}`}
                        onClick={() => patch({ payment: opt.id })}
                      >
                        <strong>{opt.label}</strong>
                        {opt.badge ? <em>{opt.badge}</em> : null}
                      </button>
                    ))}
                  </div>
                  {checkout.payment === 'upi' ? (
                    <div className="gs-upi-merchant">
                      {restaurantUpi ? (
                        <>
                          <p className="gs-muted">
                            Pay <strong>{formatPrice(total)}</strong> to <strong>{payeeName}</strong>, then
                            place your order.
                          </p>
                          <p className="gs-upi-id">
                            UPI ID: <code>{restaurantUpi}</code>
                          </p>
                          <div className="gs-upi-qr">
                            <QrCodePreview value={upiUri} size={180} alt="Restaurant UPI QR" />
                          </div>
                        </>
                      ) : (
                        <p className="gs-muted">UPI ID not published yet — choose Cash.</p>
                      )}
                    </div>
                  ) : (
                    <p className="gs-muted">Pay cash when you collect your takeaway.</p>
                  )}
                </>
              )}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2>
                <span className="gs-card-ico check" aria-hidden="true" />
                Review
              </h2>
              <dl className="gs-review-dl">
                <div>
                  <dt>{serviceMode === 'delivery' ? 'Delivering to' : 'Service'}</dt>
                  <dd>
                    {serviceMode === 'delivery'
                      ? [checkout.street, checkout.city, checkout.pincode]
                          .filter(Boolean)
                          .join(', ') || '—'
                      : serviceMode === 'dinein'
                        ? tableSession?.name
                          ? `Dine-in · ${tableSession.name}`
                          : 'Dine-in'
                        : 'Takeaway'}
                  </dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    {serviceMode === 'dinein' && checkout.payment === 'pay_later'
                      ? 'Pay later at table'
                      : serviceMode === 'dinein' && checkout.payment === 'bill'
                        ? `Pay bill now · ${(checkout.billPay || 'upi').toUpperCase()}`
                        : checkout.payment === 'upi'
                          ? `UPI${restaurantUpi ? ` · ${restaurantUpi}` : ''}`
                          : 'Cash'}
                  </dd>
                </div>
                <div>
                  <dt>Guest</dt>
                  <dd>
                    {checkout.name || '—'} · {checkout.phone || '—'}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}

          {placeError ? <p className="gs-form-error">{placeError}</p> : null}

          <div className="gs-checkout-actions">
            <button type="button" className="gs-btn ghost" onClick={goBack} disabled={submitting}>
              Back
            </button>
            <button
              type="button"
              className="gs-btn primary"
              onClick={goNext}
              disabled={
                submitting ||
                (step === 2 &&
                  serviceMode !== 'dinein' &&
                  checkout.payment === 'upi' &&
                  !restaurantUpi) ||
                (step === 2 &&
                  serviceMode === 'dinein' &&
                  checkout.payment === 'bill' &&
                  (checkout.billPay || 'upi') === 'upi' &&
                  !restaurantUpi) ||
                (step === 2 && serviceMode === 'dinein' && !checkout.payment)
              }
            >
              {submitting
                ? 'Placing…'
                : step === CHECKOUT_STEPS.length - 1
                  ? `Place order · ${formatPrice(total)}`
                  : 'Continue'}
            </button>
          </div>
        </div>

        <OrderSummaryCard
          cart={cart}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          gst={gst}
          total={total}
          serviceMode={serviceMode}
        />
      </div>
    </section>
  )
}

function TrackStrip({ steps }) {
  return (
    <div className="gs-track-panel">
      <div className="gs-track-strip">
        {steps.map((s, i) => (
          <div key={s.label} className={`gs-track-chip ${s.state}`}>
            <span>{s.state === 'done' ? '✓' : s.state === 'active' ? '↻' : i + 1}</span>
            <strong>{s.label}</strong>
            <em>{s.state === 'done' ? 'Done' : s.state === 'active' ? 'In progress' : 'Pending'}</em>
          </div>
        ))}
      </div>
    </div>
  )
}

const ACCOUNT_TABS = [
  { id: 'orders', label: 'History', icon: 'bag' },
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'favorites', label: 'Favorites', icon: 'heart' },
  { id: 'alerts', label: 'Alerts', icon: 'bell' },
]

export function GuestPlacedPage({ slug, lastOrder }) {
  const steps = trackStepsForStatus(lastOrder?.status || 'new')
  return (
    <section className="gs-placed-page">
      <div className="gs-placed-card">
        <div className="gs-placed-check" aria-hidden="true">
          ✓
        </div>
        <h1>Order placed.</h1>
        <p>
          Order #{lastOrder?.publicCode || lastOrder?.id || '—'} · about{' '}
          {lastOrder?.etaMinutes || 38} minutes
          {lastOrder?.paymentTiming === 'pay_later' && lastOrder?.paymentStatus === 'payment_pending'
            ? ' · pay later at table'
            : lastOrder?.paymentStatus === 'payment_pending'
              ? ' · payment pending confirmation'
              : ''}
        </p>
        <TrackStrip steps={steps} />
        <div className="gs-placed-actions">
          <Link className="gs-btn primary" to={guestSitePath(slug, 'tracking')}>
            Track order
          </Link>
          <Link className="gs-btn ghost" to={guestSitePath(slug, 'menu')}>
            Continue browsing
          </Link>
        </div>
      </div>
    </section>
  )
}

export function GuestTrackingPage({ slug, lastOrder, restaurantAddress = '', uryOrdering = false }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const hintPhone =
    loadGuestAccount(slug)?.phone || guestPhoneHint(slug) || lastOrder?.phone || lastOrder?.checkout?.phone || ''
  const [lookupCode, setLookupCode] = useState(
    () => searchParams.get('code') || lastOrder?.publicCode || lastOrder?.id || '',
  )
  const [lookupPhone, setLookupPhone] = useState(
    () => searchParams.get('phone') || hintPhone || '',
  )
  const [live, setLive] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState(() => loadGuestOrderHistory(slug))
  const [posList, setPosList] = useState([])

  const activeCode = live?.publicCode || searchParams.get('code') || lastOrder?.publicCode || lastOrder?.id

  const money = (n, currency) =>
    currency ? `${currency} ${Number(n || 0).toFixed(2)}` : formatPrice(n)

  const fetchLiveOrder = async (code, phone) => {
    const cleanCode = String(code || '').trim()
    const cleanPhone = String(phone || '').trim()
    if (uryOrdering) {
      const res = await api.trackPublicUryOrder(slug, { invoice: cleanCode, phone: cleanPhone })
      const mapped = mapUryTrackToGuestOrder(res?.data)
      if (!mapped) throw new Error('Order not found.')
      return mapped
    }
    const { order } = await api.getPublicOrder(slug, cleanCode, { phone: cleanPhone || undefined })
    return order
  }

  const runLookup = async (code = lookupCode, phone = lookupPhone) => {
    const cleanCode = String(code || '').trim()
    const cleanPhone = String(phone || '').trim()
    if (!cleanCode) {
      setError(uryOrdering ? 'Enter your POS order number (e.g. UDT-SA-00005).' : 'Enter your order number.')
      return
    }
    if (uryOrdering && cleanPhone.replace(/\D/g, '').length < 7) {
      setError('Enter the phone number used at checkout.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const order = await fetchLiveOrder(cleanCode, cleanPhone)
      setLive(order)
      rememberGuestOrder(slug, order)
      setHistory(loadGuestOrderHistory(slug))
      setSearchParams({ code: order.publicCode, ...(cleanPhone ? { phone: cleanPhone } : {}) })
    } catch (err) {
      setLive(null)
      setError(err.message || 'Order not found.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const code = searchParams.get('code') || lastOrder?.publicCode || lastOrder?.id
    if (!code) return undefined
    let cancelled = false
    const phone = searchParams.get('phone') || hintPhone || lastOrder?.phone || lastOrder?.checkout?.phone
    const refresh = () =>
      fetchLiveOrder(code, phone)
        .then((order) => {
          if (cancelled) return
          setLive(order)
          rememberGuestOrder(slug, order)
          setHistory(loadGuestOrderHistory(slug))
        })
        .catch(() => {})
    refresh()
    const timer = setInterval(refresh, 12000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLiveOrder closes over uryOrdering/slug
  }, [slug, searchParams, lastOrder, hintPhone, uryOrdering])

  useEffect(() => {
    if (!uryOrdering) {
      setPosList([])
      return undefined
    }
    const phone = String(lookupPhone || hintPhone || '').trim()
    if (phone.replace(/\D/g, '').length < 7) {
      setPosList([])
      return undefined
    }
    let cancelled = false
    const customerId = loadGuestAccount(slug)?.customerId || ''
    api
      .getPublicUryAccount(slug, phone, { customerId })
      .then((res) => {
        if (!cancelled) setPosList(res?.data?.orders || [])
      })
      .catch(() => {
        if (!cancelled) setPosList([])
      })
    return () => {
      cancelled = true
    }
  }, [slug, uryOrdering, lookupPhone, hintPhone])

  const order = live || (lastOrder?.fromPos || lastOrder?.publicCode || lastOrder?.id ? lastOrder : null)
  const items = order?.items || []
  const total =
    order?.total ??
    items.reduce((s, i) => s + (i.price || i.unitPrice || 0) * i.qty, 0)
  const address = order?.address
    ? [order.address.street, order.address.city, order.address.pincode].filter(Boolean).join(', ')
    : [lastOrder?.checkout?.street, lastOrder?.checkout?.city, lastOrder?.checkout?.pincode]
        .filter(Boolean)
        .join(', ')
  const steps = trackStepsForStatus(order?.status || 'new')
  const payLater = order?.paymentTiming === 'pay_later'
  const unpaid = order?.paymentStatus === 'payment_pending'
  const fromPos = Boolean(order?.fromPos || uryOrdering)

  return (
    <section className="gs-tracking-page">
      <div className="gs-tracking-hero">
        <p className="gs-kicker">Order tracking</p>
        <h1>Follow your order</h1>
        <p className="gs-muted">
          {uryOrdering
            ? 'Enter the POS order number from your confirmation (e.g. UDT-SA-00005) and the phone used at checkout.'
            : 'Enter your order number and phone to see live kitchen status and your bill.'}
        </p>
      </div>

      <form
        className="gs-track-lookup"
        onSubmit={(e) => {
          e.preventDefault()
          runLookup()
        }}
      >
        <label>
          Order number
          <input
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value)}
            placeholder={uryOrdering ? 'e.g. UDT-SA-00005' : 'e.g. 10428'}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <label>
          Phone
          <input
            value={lookupPhone}
            onChange={(e) => setLookupPhone(e.target.value)}
            placeholder="Phone used at checkout"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
        <button type="submit" className="gs-btn primary" disabled={loading}>
          {loading ? 'Looking up…' : 'Track'}
        </button>
      </form>
      {error ? <p className="gs-form-error">{error}</p> : null}

      {order ? (
        <div className="gs-tracking-layout">
          <div>
            <h2>{fromPos ? order.publicCode || activeCode : `Order #${order.publicCode || activeCode}`}</h2>
            <p className="gs-muted">
              {fromPos
                ? `Kitchen: ${order.kitchenLabel || 'Received'} · Payment: ${
                    order.paymentLabel || (unpaid ? 'Unpaid' : 'Paid')
                  }${order.orderType || order.serviceMode ? ` · ${order.orderType || order.serviceMode}` : ''}${
                    order.tableName ? ` · ${order.tableName}` : ''
                  }`
                : payLater && unpaid
                  ? 'Pay later · bill open'
                  : unpaid
                    ? 'Payment pending staff confirmation'
                    : 'Payment confirmed'}
              {!fromPos ? ` · ETA ~${order.etaMinutes || 25} min` : ''}
            </p>

            <TrackStrip steps={steps} />

            <div className="gs-tracking-order">
              <h3>{order.serviceMode === 'dinein' ? 'Table bill' : 'Your order'}</h3>
              <ul>
                {items.length ? (
                  items.map((item) => (
                    <li key={item.lineKey || item.id || item.name}>
                      <span>
                        {item.qty}× {item.name}
                      </span>
                      <b>
                        {money(
                          item.amount ?? (item.price || item.unitPrice || 0) * item.qty,
                          order.currency,
                        )}
                      </b>
                    </li>
                  ))
                ) : (
                  <li>
                    <span>{fromPos ? 'Open in POS — line items load when tracked' : 'No line items'}</span>
                    <b>—</b>
                  </li>
                )}
              </ul>
              <div className="gs-summary-break">
                <div>
                  <span>Subtotal</span>
                  <b>{money(order.subtotal ?? total, order.currency)}</b>
                </div>
                {order.tax ? (
                  <div>
                    <span>Tax</span>
                    <b>{money(order.tax, order.currency)}</b>
                  </div>
                ) : null}
                {order.fees ? (
                  <div>
                    <span>Fees</span>
                    <b>{money(order.fees, order.currency)}</b>
                  </div>
                ) : null}
              </div>
              <div className="gs-summary-total">
                <span>Total</span>
                <strong>{money(total, order.currency)}</strong>
              </div>
              {payLater && unpaid ? (
                <p className="gs-bill-note">
                  {fromPos
                    ? 'Pay at the counter, or ask staff to settle this bill in the POS.'
                    : 'Ask staff for the bill when you are ready to pay.'}
                </p>
              ) : null}
            </div>
          </div>

          <aside className="gs-tracking-aside">
            <h3>Details</h3>
            <p>
              <strong>Service</strong>
              <br />
              {order.serviceMode === 'dinein'
                ? `Dine In${order.tableName ? ` · ${order.tableName}` : ''}`
                : order.serviceMode === 'delivery'
                  ? 'Delivery'
                  : order.orderType || 'Takeaway'}
            </p>
            <p>
              <strong>Payment</strong>
              <br />
              {fromPos
                ? `${order.paymentLabel || (unpaid ? 'Unpaid' : 'Paid')} · POS ${order.posStatus || order.posState || ''}`
                : `${payLater ? 'Pay later' : (order.paymentMethod || 'cash').toUpperCase()}${
                    unpaid ? ' · unpaid' : ' · paid'
                  }`}
            </p>
            {order.customer ? (
              <p>
                <strong>Customer in POS</strong>
                <br />
                {order.customer}
              </p>
            ) : null}
            <p>
              <strong>Address</strong>
              <br />
              {address || restaurantAddress || 'Pickup / dine-in'}
            </p>
            <Link className="gs-btn ghost" to={guestSitePath(slug, 'menu')}>
              Back to menu
            </Link>
            <Link className="gs-btn primary" to={guestSitePath(slug, 'account')}>
              All orders
            </Link>
          </aside>
        </div>
      ) : (
        <div className="gs-track-empty">
          <p className="gs-muted">
            {uryOrdering
              ? 'No live order yet. Use the pickup code from “Order placed”, or open All orders on Account.'
              : 'No live order yet. Place an order or look one up above.'}
          </p>
          <div className="gs-placed-actions">
            <Link className="gs-btn primary" to={guestSitePath(slug, 'order')}>
              Start ordering
            </Link>
          </div>
        </div>
      )}

      {uryOrdering && posList.length ? (
        <div className="gs-recent-orders">
          <h3>Your website orders</h3>
          <ul>
            {posList.slice(0, 12).map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="gs-history-row"
                  onClick={() => {
                    setLookupCode(h.id)
                    runLookup(h.id, lookupPhone || hintPhone)
                  }}
                >
                  <strong>{h.id}</strong>
                  <span>
                    {h.orderType || 'order'}
                    {h.table ? ` · ${h.table}` : ''} · {h.paymentLabel || h.posStatus}
                    {h.total != null ? ` · ${money(h.total, h.currency)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!uryOrdering && history.length ? (
        <div className="gs-recent-orders">
          <h3>Recent on this device</h3>
          <ul>
            {history.slice(0, 6).map((h) => (
              <li key={h.publicCode}>
                <button
                  type="button"
                  className="gs-history-row"
                  onClick={() => {
                    setLookupCode(h.publicCode)
                    setLookupPhone(h.phone || '')
                    runLookup(h.publicCode, h.phone)
                  }}
                >
                  <strong>#{h.publicCode}</strong>
                  <span>
                    {h.serviceMode || 'order'}
                    {h.tableName ? ` · ${h.tableName}` : ''} · {formatPrice(h.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export function GuestAccountPage({
  slug,
  restaurantName,
  checkout,
  lastOrder,
  favorites = [],
  photoFor,
  restaurantContact = {},
  uryOrdering = false,
}) {
  const [tab, setTab] = useState('orders')
  const [account, setAccount] = useState(() => loadGuestAccount(slug))
  const [formName, setFormName] = useState(() => loadGuestAccount(slug)?.name || checkout?.name || '')
  const [formPhone, setFormPhone] = useState(
    () => loadGuestAccount(slug)?.phone || checkout?.phone || guestPhoneHint(slug) || '',
  )
  const [accountBusy, setAccountBusy] = useState(false)
  const [historyPhone, setHistoryPhone] = useState(
    () => loadGuestAccount(slug)?.phone || checkout?.phone || guestPhoneHint(slug) || '',
  )
  const [remoteOrders, setRemoteOrders] = useState([])
  const [uryOrders, setUryOrders] = useState([])
  const [localHistory, setLocalHistory] = useState(() => loadGuestOrderHistory(slug))
  const [historyError, setHistoryError] = useState('')
  const [uryCustomerName, setUryCustomerName] = useState(() => loadGuestAccount(slug)?.name || '')

  useEffect(() => {
    const saved = loadGuestAccount(slug)
    setAccount(saved)
    if (saved?.phone) {
      setHistoryPhone(saved.phone)
      setFormPhone(saved.phone)
      setFormName(saved.name || '')
      setUryCustomerName(saved.name || '')
    }
  }, [slug])

  useEffect(() => {
    setLocalHistory(loadGuestOrderHistory(slug))
  }, [slug, lastOrder])

  useEffect(() => {
    const phone = String(historyPhone || '').trim()
    if (phone.replace(/\D/g, '').length < 7) {
      setRemoteOrders([])
      setUryOrders([])
      return undefined
    }
    let cancelled = false
    if (uryOrdering) {
      const customerId = account?.customerId || loadGuestAccount(slug)?.customerId || ''
      api
        .getPublicUryAccount(slug, phone, { customerId })
        .then((res) => {
          if (cancelled) return
          const rows = res?.data?.orders || []
          const cust = res?.data?.customer
          const savedId = account?.customerId || loadGuestAccount(slug)?.customerId || ''
          if (savedId && cust?.id && cust.id !== savedId) {
            setUryOrders([])
            setHistoryError('')
            return
          }
          setUryOrders(rows)
          if (cust?.name && (!savedId || cust.id === savedId)) {
            setUryCustomerName(cust.name)
            if (account?.phone === phone || !account) {
              const next = saveGuestAccount(slug, {
                name: cust.name,
                phone: cust.phone || phone,
                customerId: cust.id,
              })
              setAccount(next)
            }
          }
          setHistoryError('')
        })
        .catch((err) => {
          if (!cancelled) {
            setUryOrders([])
            setHistoryError(err.message || 'Unable to load POS orders.')
          }
        })
    } else {
      setUryOrders([])
    }
    api
      .getPublicOrderHistory(slug, phone)
      .then(({ orders }) => {
        if (!cancelled) {
          setRemoteOrders(orders || [])
          if (!uryOrdering) setHistoryError('')
        }
      })
      .catch((err) => {
        if (!cancelled && !uryOrdering) setHistoryError(err.message || 'Unable to load history.')
      })
    return () => {
      cancelled = true
    }
  }, [slug, historyPhone, uryOrdering, account?.phone])

  const openAccount = async (event) => {
    event?.preventDefault?.()
    if (!uryOrdering) return
    setAccountBusy(true)
    setHistoryError('')
    try {
      const phone = formPhone.trim()
      const name = formName.trim()
      if (!name) {
        setHistoryError('Enter your name (same as the Customer name in the POS is fine).')
        return
      }
      if (phone.replace(/\D/g, '').length < 7) {
        setHistoryError('Enter the Mobile Number saved on your POS customer (e.g. +918317274115).')
        return
      }
      // findOrCreate: opens an existing URY Customer when the phone matches, otherwise creates one
      const res = await api.createPublicUryAccount(slug, { name, phone })
      const customer = res?.data?.customer
      const orders = res?.data?.orders || []
      if (!customer?.id) {
        setHistoryError('Could not open your POS account. Please try again.')
        return
      }
      const next = saveGuestAccount(slug, {
        name: customer.name || name,
        phone: customer.phone || phone,
        customerId: customer.id,
      })
      setAccount(next)
      setUryCustomerName(next.name)
      setHistoryPhone(next.phone)
      setFormPhone(next.phone)
      setUryOrders(orders)
      setTab('orders')
    } catch (err) {
      setHistoryError(err?.message || 'Could not open your POS account.')
    } finally {
      setAccountBusy(false)
    }
  }

  const signOutAccount = () => {
    clearGuestAccount(slug)
    setAccount(null)
    setUryCustomerName('')
    setUryOrders([])
    setHistoryPhone('')
    setFormName('')
    setFormPhone('')
  }

  const profile = {
    name: account?.name || checkout?.name || uryCustomerName || 'Guest',
    email: checkout?.email || restaurantContact.email || '',
    phone: account?.phone || checkout?.phone || historyPhone || '',
    address:
      [checkout?.street, checkout?.city, checkout?.pincode].filter(Boolean).join(', ') ||
      restaurantContact.address ||
      '',
    customerId: account?.customerId || '',
  }
  const initials = profile.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const signedIn = Boolean(uryOrdering && account?.phone && account?.customerId)

  const orders = useMemo(() => {
    if (uryOrdering) {
      const wantId = String(account?.customerId || '').trim()
      const wantName = String(uryCustomerName || account?.name || '').trim().toLowerCase()
      return uryOrders
        .filter((o) => {
          const gotId = String(o.customerId || '').trim()
          const gotName = String(o.customer || '').trim().toLowerCase()
          if (wantId && gotId) return gotId === wantId
          if (wantName && gotName) return gotName === wantName
          return false
        })
        .map((o) => ({
          id: o.id,
          when: o.postedAt ? String(o.postedAt).slice(0, 16) : '',
          status: o.paymentLabel || o.posStatus || o.state,
          total: o.total,
          live: o.state === 'draft' || o.state === 'unbilled',
          serviceMode: o.orderType || '',
          tableName: o.table || '',
          paymentTiming: o.state === 'paid' ? 'paid' : 'pay_later',
          paymentStatus: o.state === 'paid' ? 'paid' : 'payment_pending',
          currency: o.currency,
          fromPos: true,
        }))
    }
    if (remoteOrders.length) {
      return remoteOrders.map((o) => ({
        id: o.publicCode,
        when: o.createdAt ? String(o.createdAt).slice(0, 16).replace('T', ' ') : '',
        status: o.status,
        total: o.total,
        live: !['completed', 'cancelled'].includes(o.status),
        serviceMode: o.serviceMode,
        tableName: o.tableName,
        paymentTiming: o.paymentTiming,
        paymentStatus: o.paymentStatus,
      }))
    }
    return localHistory.map((o) => ({
      id: o.publicCode,
      when: o.createdAt ? String(o.createdAt).slice(0, 16).replace('T', ' ') : '',
      status: o.status || 'new',
      total: o.total,
      live: true,
      serviceMode: o.serviceMode,
      tableName: o.tableName,
      paymentTiming: o.paymentTiming,
      paymentStatus: o.paymentStatus,
    }))
  }, [uryOrdering, uryOrders, remoteOrders, localHistory, account?.customerId, account?.name, uryCustomerName])

  const notifications = useMemo(() => {
    const notes = []
    if (lastOrder?.publicCode || lastOrder?.id) {
      notes.push({
        text: `Your order #${lastOrder.publicCode || lastOrder.id} is being prepared.`,
        when: 'Just now',
      })
    }
    return notes
  }, [lastOrder])

  const favItems =
    favorites.length > 0
      ? favorites
      : [
          { id: 'demo-1', name: 'Burrata & Heirloom Tomato', price: 400 },
          { id: 'demo-2', name: 'Truffle Mushroom Risotto', price: 480 },
          { id: 'demo-3', name: 'Wood-Fired Margherita', price: 350 },
        ]

  return (
    <section className="gs-account-page">
      <div className="gs-account-hero">
        <span className="gs-account-av" aria-hidden="true">
          {initials || 'G'}
        </span>
        <div>
          <h1>{signedIn ? profile.name : 'Your account'}</h1>
          <p className="gs-muted">
            {signedIn
              ? `${orders.length} order${orders.length === 1 ? '' : 's'} · linked to ${restaurantName} POS`
              : uryOrdering
                ? 'Create a customer account to order takeaway or dine-in and track Paid / Unpaid in the POS.'
                : `${orders.length} order${orders.length === 1 ? '' : 's'} on file`}
          </p>
        </div>
      </div>

      {uryOrdering && !signedIn ? (
        <form className="gs-account-card gs-account-signin" onSubmit={openAccount}>
          <p className="gs-muted">
            Enter your name and the <strong>Mobile Number</strong> on your URY Customer. If that
            phone already exists we open it; otherwise we create a new POS customer.
          </p>
          <div className="gs-form-grid two">
            <label>
              Full name
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label>
              Phone
              <input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="+918317274115"
                required
              />
            </label>
          </div>
          {historyError ? (
            <p className="gs-form-error" role="alert">
              {historyError}
            </p>
          ) : null}
          <button type="submit" className="gs-btn primary" disabled={accountBusy}>
            {accountBusy ? 'Opening…' : 'Open POS account'}
          </button>
        </form>
      ) : null}

      <div className="gs-account-order-actions">
        <Link className="gs-btn primary" to={guestSitePath(slug, 'menu')}>
          Order takeaway
        </Link>
        <Link className="gs-btn ghost" to={guestSitePath(slug, 'order')}>
          {uryOrdering ? 'View cart / checkout' : 'Order at table / takeaway'}
        </Link>
        <Link className="gs-btn ghost" to={guestSitePath(slug, 'tracking')}>
          Track an order
        </Link>
        {signedIn ? (
          <button type="button" className="gs-btn ghost" onClick={signOutAccount}>
            Sign out
          </button>
        ) : null}
      </div>

      <div className="gs-account-tabs" role="tablist" aria-label="Account sections">
        {ACCOUNT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`gs-account-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className={`gs-tab-ico ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="gs-account-card gs-profile-grid">
          {uryOrdering && !signedIn ? (
            <p className="gs-muted">Open your POS account above to see your profile here.</p>
          ) : (
            <>
              <div>
                <span className="gs-side-label">Name</span>
                <strong>{profile.name}</strong>
                <span className="gs-side-label">Email</span>
                <strong>{profile.email || '—'}</strong>
              </div>
              <div>
                <span className="gs-side-label">Phone</span>
                <strong>{profile.phone || '—'}</strong>
                <span className="gs-side-label">{uryOrdering ? 'POS customer' : 'Default address'}</span>
                <strong>
                  {uryOrdering
                    ? profile.customerId || profile.name
                    : profile.address || 'Add an address at checkout.'}
                </strong>
              </div>
              <p className="gs-fine gs-profile-hint">
                {uryOrdering
                  ? 'This account is the customer record in the restaurant POS. Orders you place with this phone attach to it.'
                  : 'Guest details come from your latest checkout.'}
              </p>
            </>
          )}
        </div>
      ) : null}

      {tab === 'orders' ? (
        <div className="gs-order-history">
          {uryOrdering && (signedIn || historyPhone) ? (
            <p className="gs-muted">
              {signedIn
                ? <>Orders placed from this website account for <strong>{profile.name || profile.phone}</strong> (Draft / Unbilled / Paid).</>
                : 'Open your POS account to see only orders placed from this website.'}
            </p>
          ) : null}
          {uryOrdering && !signedIn ? (
            <p className="gs-muted">Or create an account above so orders stay linked to your POS customer.</p>
          ) : null}
          {!signedIn ? (
            <label className="gs-history-phone">
              Lookup by phone
              <input
                value={historyPhone}
                onChange={(e) => setHistoryPhone(e.target.value)}
                placeholder="Phone used on orders"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
          ) : null}
          {historyError && signedIn ? (
            <p className="gs-form-error" role="alert">
              {historyError}
            </p>
          ) : null}
          <div className="gs-order-list">
            {orders.length === 0 ? (
              <p className="gs-muted">
                {uryOrdering
                  ? signedIn
                    ? 'No website orders for this account yet. Place a takeaway or scan a table QR.'
                    : 'Open your POS account above to load your orders.'
                  : 'No orders yet. Start a table or takeaway order.'}
              </p>
            ) : null}
            {orders.map((o) => (
              <article key={o.id} className="gs-order-row">
                <div>
                  <strong>{o.fromPos ? o.id : `Order #${o.id}`}</strong>
                  <p>
                    {o.when}
                    {o.serviceMode ? ` · ${o.serviceMode}` : ''}
                    {o.tableName ? ` · ${o.tableName}` : ''} · {o.status}
                    {o.paymentTiming === 'pay_later' && o.paymentStatus === 'payment_pending'
                      ? ' · unpaid'
                      : ''}
                  </p>
                </div>
                <div className="gs-order-row-side">
                  <b>{o.currency ? `${o.currency} ${Number(o.total || 0).toFixed(2)}` : formatPrice(o.total)}</b>
                  <Link
                    className="gs-text-cta"
                    to={`${guestSitePath(slug, 'tracking')}?code=${encodeURIComponent(o.id)}${
                      (profile.phone || historyPhone)
                        ? `&phone=${encodeURIComponent(profile.phone || historyPhone)}`
                        : ''
                    }`}
                  >
                    {o.fromPos ? 'Track status' : 'Track / bill'}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'favorites' ? (
        <div className="gs-fav-grid">
          {favItems.map((item) => (
            <article key={item.id || item.name} className="gs-fav-card">
              <div className="gs-fav-photo">
                <DishThumb src={photoFor?.(item) || item.imageDataUrl} alt={item.name} />
              </div>
              <strong>{item.name}</strong>
              <span>{formatPrice(item.price)}</span>
              <Link className="gs-text-cta" to={guestDishPath(slug, item.id || item.name)}>
                View dish
              </Link>
            </article>
          ))}
        </div>
      ) : null}

      {tab === 'notifications' ? (
        <div className="gs-account-card gs-notify-list">
          {notifications.map((n) => (
            <div key={n.text} className="gs-notify-row">
              <span className="gs-notify-dot" aria-hidden="true" />
              <div>
                <strong>{n.text}</strong>
                <p>{n.when}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <p className="gs-fine gs-account-note">Guest account preview for {restaurantName}</p>
    </section>
  )
}

export function GuestBookPage({
  slug,
  restaurantName,
  booking,
  setBooking,
  booked,
  setBooked,
  bookError,
  bookingBusy,
  availSlots,
  availMeta,
  submitBooking,
  restaurantPhone = '',
}) {
  const account = useMemo(() => loadGuestAccount(slug), [slug])
  const dateChips = useMemo(() => {
    const chips = []
    const start = new Date()
    for (let i = 0; i < 10; i += 1) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = localDateIso(d)
      chips.push({
        iso,
        dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        day: d.getDate(),
        mon: d.toLocaleDateString('en-IN', { month: 'short' }),
        today: i === 0,
      })
    }
    return chips
  }, [])

  useEffect(() => {
    if (booking.date || !dateChips[0]?.iso) return
    setBooking((b) => (b.date ? b : { ...b, date: dateChips[0].iso }))
  }, [booking.date, dateChips, setBooking])

  useEffect(() => {
    if (!account) return
    setBooking((b) => {
      const name = b.name || account.name || ''
      const phone = b.phone || account.phone || ''
      if (name === b.name && phone === b.phone) return b
      return { ...b, name, phone }
    })
  }, [account, setBooking])

  const [uiStep, setUiStep] = useState(1)
  const selectedDateLabel = useMemo(() => {
    if (!booking.date) return 'Choose a date'
    try {
      return new Date(`${booking.date}T12:00:00`).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    } catch {
      return booking.date
    }
  }, [booking.date])

  useEffect(() => {
    if (uiStep >= 3 && !booking.time) setUiStep(2)
    else if (uiStep >= 2 && !booking.date) setUiStep(1)
  }, [booking.date, booking.time, uiStep])

  const slotLabel = (slot) => {
    if (slot.full) return 'Full'
    const left = Number(slot.remainingCovers)
    if (!Number.isFinite(left)) return 'Open'
    if (left <= 4) return `${left} left`
    return 'Available'
  }

  const goStep = (n) => {
    if (n === 2 && !booking.date) return
    if (n === 3 && (!booking.date || !booking.time)) return
    setUiStep(n)
  }

  if (booked) {
    const dateLabel = (() => {
      try {
        return new Date(`${booked.date}T12:00:00`).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      } catch {
        return booked.date
      }
    })()
    const reservationId = booked.id != null ? String(booked.id) : null
    const pending = booked.status !== 'confirmed'

    return (
      <section className="gs-book-page gs-book-confirm">
        <div className="gs-book-confirm-inner">
          <div className="gs-book-confirm-ico" aria-hidden="true">
            {pending ? '…' : '✓'}
          </div>
          <h1>{pending ? 'Request received' : 'Table confirmed'}</h1>
          <p className="gs-muted">
            {reservationId ? `Reservation #${reservationId} · ` : ''}
            {dateLabel} at {booked.time} for {booked.guests} guests
            {pending ? ' · Awaiting confirmation' : ''}
          </p>
          <div className="gs-book-confirm-card">
            <div>
              <span>Date</span>
              <strong>{dateLabel}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{booked.time}</strong>
            </div>
            <div>
              <span>Guests</span>
              <strong>{booked.guests} people</strong>
            </div>
            <div>
              <span>Restaurant</span>
              <strong>{restaurantName}</strong>
            </div>
            <p className="gs-fine">
              {pending
                ? booked.email
                  ? 'We’ll email you when the restaurant confirms.'
                  : 'The restaurant will confirm shortly.'
                : booked.email
                  ? 'A confirmation is on its way to your inbox.'
                  : 'You’re all set.'}
              {restaurantPhone ? ` Questions? Call ${restaurantPhone}.` : ''}
            </p>
          </div>
          <div className="gs-placed-actions">
            <button
              type="button"
              className="gs-btn primary"
              onClick={() => {
                setBooked(null)
                setBooking((b) => ({ ...b, notes: '', time: '' }))
              }}
            >
              Make another booking
            </button>
            <Link className="gs-btn ghost" to={guestSitePath(slug, 'website')}>
              Back to home
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="gs-book-page is-pro">
      <div className="gs-book-shell">
        <header className="gs-book-hero">
          <p className="gs-kicker">Reservations</p>
          <h1>Book a table</h1>
          <p className="gs-muted">
            Reserve at <strong>{restaurantName}</strong>. Pick a date, choose a time, then leave your details.
          </p>
        </header>

        <ol className="gs-book-steps" aria-label="Booking steps">
          <li className={uiStep === 1 ? 'is-active' : uiStep > 1 ? 'is-done' : ''}>
            <button type="button" className="gs-book-step-btn" onClick={() => goStep(1)}>
              <span className="gs-book-step-num" aria-hidden="true">
                1
              </span>
              When
            </button>
          </li>
          <li className={uiStep === 2 ? 'is-active' : uiStep > 2 ? 'is-done' : ''}>
            <button
              type="button"
              className="gs-book-step-btn"
              onClick={() => goStep(2)}
              disabled={!booking.date}
            >
              <span className="gs-book-step-num" aria-hidden="true">
                2
              </span>
              Time
            </button>
          </li>
          <li className={uiStep === 3 ? 'is-active' : ''}>
            <button
              type="button"
              className="gs-book-step-btn"
              onClick={() => goStep(3)}
              disabled={!booking.date || !booking.time}
            >
              <span className="gs-book-step-num" aria-hidden="true">
                3
              </span>
              Details
            </button>
          </li>
        </ol>

        <div className="gs-book-summary-bar" aria-label="Booking summary">
          <div>
            <span>Date</span>
            <strong>{booking.date ? selectedDateLabel : '—'}</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{booking.time || '—'}</strong>
          </div>
          <div>
            <span>Party</span>
            <strong>
              {booking.guests} guest{Number(booking.guests) === 1 ? '' : 's'}
            </strong>
          </div>
        </div>

        <form className="gs-book-main" onSubmit={submitBooking}>
          {bookError ? (
            <p className="gs-form-error" role="alert">
              {bookError}
              {restaurantPhone ? ` Call ${restaurantPhone} if you need help.` : ''}
            </p>
          ) : null}

          {uiStep === 1 ? (
            <section className="gs-book-panel">
              <div className="gs-book-panel-head">
                <h2>Date &amp; party</h2>
                <p className="gs-muted">Up to 12 guests online</p>
              </div>
              <div className="gs-book-field">
                <span className="gs-book-label">Date</span>
                <div className="gs-date-chips" role="listbox" aria-label="Choose a date">
                  {dateChips.map((chip) => (
                    <button
                      key={chip.iso}
                      type="button"
                      role="option"
                      aria-selected={booking.date === chip.iso}
                      className={`gs-date-chip${booking.date === chip.iso ? ' is-selected' : ''}`}
                      onClick={() => {
                        setBooking((b) => ({ ...b, date: chip.iso, time: '' }))
                      }}
                    >
                      <em>{chip.today ? 'Today' : chip.dow}</em>
                      <strong>{chip.day}</strong>
                      <span>{chip.mon}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="gs-book-field gs-book-party">
                <span className="gs-book-label">Party size</span>
                <div className="gs-qty book">
                  <button
                    type="button"
                    aria-label="Fewer guests"
                    onClick={() =>
                      setBooking((b) => ({
                        ...b,
                        guests: String(Math.max(1, Number(b.guests) - 1)),
                        time: '',
                      }))
                    }
                  >
                    −
                  </button>
                  <strong>
                    {booking.guests} <span>guests</span>
                  </strong>
                  <button
                    type="button"
                    aria-label="More guests"
                    onClick={() =>
                      setBooking((b) => ({
                        ...b,
                        guests: String(Math.min(12, Number(b.guests) + 1)),
                        time: '',
                      }))
                    }
                  >
                    +
                  </button>
                </div>
                {restaurantPhone ? (
                  <p className="gs-fine">Larger parties — call {restaurantPhone}.</p>
                ) : (
                  <p className="gs-fine">Larger parties — call the restaurant.</p>
                )}
              </div>
              <div className="gs-book-nav">
                <button
                  type="button"
                  className="gs-btn primary"
                  disabled={!booking.date}
                  onClick={() => goStep(2)}
                >
                  Continue to time
                </button>
              </div>
            </section>
          ) : null}

          {uiStep === 2 ? (
            <section className="gs-book-panel">
              <div className="gs-book-panel-head">
                <h2>Choose a time</h2>
                <p className="gs-muted">{selectedDateLabel}</p>
              </div>
              {availMeta.loading ? (
                <p className="gs-muted">Checking availability…</p>
              ) : availMeta.closed || availSlots.length === 0 ? (
                <p className="gs-muted">
                  {availMeta.reason || 'No open slots for this date and party size.'}
                  {restaurantPhone ? ` Call ${restaurantPhone} for help.` : ''}
                </p>
              ) : (
                <div className="gs-time-grid" role="listbox" aria-label="Available times">
                  {availSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      role="option"
                      aria-selected={booking.time === slot.time}
                      disabled={Boolean(slot.full)}
                      className={`gs-time-chip${booking.time === slot.time ? ' is-selected' : ''}${slot.full ? ' is-full' : ''}`}
                      onClick={() => setBooking((b) => ({ ...b, time: slot.time }))}
                    >
                      <strong>{slot.time}</strong>
                      <span>{slotLabel(slot)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="gs-book-nav">
                <button type="button" className="gs-btn ghost" onClick={() => goStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="gs-btn primary"
                  disabled={!booking.time}
                  onClick={() => goStep(3)}
                >
                  Continue to details
                </button>
              </div>
            </section>
          ) : null}

          {uiStep === 3 ? (
            <section className="gs-book-panel">
              <div className="gs-book-panel-head">
                <h2>Your details</h2>
                <p className="gs-muted">So the restaurant can confirm your booking</p>
              </div>
              <div className="gs-book-field two-col">
                <label>
                  Full name
                  <input
                    required
                    autoComplete="name"
                    value={booking.name}
                    onChange={(e) => setBooking((b) => ({ ...b, name: e.target.value }))}
                    placeholder="Guest name"
                  />
                </label>
                <label>
                  Phone
                  <input
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    value={booking.phone}
                    onChange={(e) => setBooking((b) => ({ ...b, phone: e.target.value }))}
                    placeholder={restaurantPhone || '+91…'}
                  />
                </label>
              </div>
              <label className="gs-book-field">
                Email <span className="gs-optional">(optional)</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={booking.email || ''}
                  onChange={(e) => setBooking((b) => ({ ...b, email: e.target.value }))}
                  placeholder="you@email.com"
                />
              </label>
              <label className="gs-book-field">
                Special requests <span className="gs-optional">(optional)</span>
                <textarea
                  rows={3}
                  value={booking.notes}
                  onChange={(e) => setBooking((b) => ({ ...b, notes: e.target.value }))}
                  placeholder="Occasion, seating preference, allergies…"
                />
              </label>
              <div className="gs-book-nav">
                <button type="button" className="gs-btn ghost" onClick={() => goStep(2)}>
                  Back
                </button>
                <button
                  className="gs-btn primary"
                  type="submit"
                  disabled={bookingBusy || !booking.date || !booking.time || !booking.name || !booking.phone}
                >
                  {bookingBusy ? 'Sending request…' : 'Request reservation'}
                </button>
              </div>
              <p className="gs-fine gs-book-submit-note">
                You’ll get a confirmation once the restaurant accepts.
                {restaurantPhone ? ` Questions? Call ${restaurantPhone}.` : ''}
              </p>
            </section>
          ) : null}
        </form>
      </div>
    </section>
  )
}
