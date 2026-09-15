import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { guestDishPath, guestSitePath } from '../../utils/guestLinks.js'

function formatPrice(n) {
  return `₹${Math.round(Number(n) || 0)}`
}

function DishThumb({ src, alt = '' }) {
  if (src) return <img src={src} alt={alt} loading="lazy" />
  return <div className="gs-photo placeholder" aria-hidden="true" />
}

const CHECKOUT_STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
]

const PAYMENT_OPTIONS = [
  { id: 'upi', label: 'UPI', badge: 'Fastest' },
  { id: 'card', label: 'Card' },
  { id: 'cod', label: 'Cash on delivery' },
  { id: 'wallet', label: 'Wallet' },
]

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
}) {
  const navigate = useNavigate()
  const [couponInput, setCouponInput] = useState(coupon || '')

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

          <div className="gs-service-toggle" role="tablist" aria-label="Service mode">
            {[
              { id: 'delivery', label: 'Delivery' },
              { id: 'pickup', label: 'Pickup' },
              { id: 'dinein', label: 'Dine-in' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={serviceMode === mode.id}
                className={serviceMode === mode.id ? 'is-active' : ''}
                onClick={() => setServiceMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>

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
}) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const deliveryFee = serviceMode === 'delivery' ? 49 : 0
  const gst = Math.round(subtotal * 0.05)
  const total = subtotal + deliveryFee + gst

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

  const goNext = () => {
    if (step < CHECKOUT_STEPS.length - 1) setStep((s) => s + 1)
    else {
      const orderId = String(10000 + Math.floor(Math.random() * 90000))
      onPlaced?.({
        id: orderId,
        total,
        etaMinutes: 38,
        items: cart,
        checkout,
        serviceMode,
      })
      navigate(guestSitePath(slug, 'placed'))
      setCart([])
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
                    placeholder="+91 98xxxxxxxx"
                  />
                </label>
                <label className="full">
                  Email
                  <input
                    type="email"
                    value={checkout.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder="you@email.com"
                  />
                </label>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2>
                <span className="gs-card-ico pin" aria-hidden="true" />
                Delivery address
              </h2>
              <div className="gs-form-grid">
                <label className="full">
                  Street address
                  <input
                    value={checkout.street}
                    onChange={(e) => patch({ street: e.target.value })}
                    placeholder="Flat 4B, 12 Linking Road"
                  />
                </label>
                <div className="gs-form-grid three full">
                  <label>
                    City
                    <input
                      value={checkout.city}
                      onChange={(e) => patch({ city: e.target.value })}
                      placeholder="Mumbai"
                    />
                  </label>
                  <label>
                    Pincode
                    <input
                      value={checkout.pincode}
                      onChange={(e) => patch({ pincode: e.target.value })}
                      placeholder="400050"
                    />
                  </label>
                  <label>
                    ETA
                    <input
                      value={checkout.eta}
                      onChange={(e) => patch({ eta: e.target.value })}
                      placeholder="ASAP"
                    />
                  </label>
                </div>
                <label className="full">
                  Delivery instructions (optional)
                  <textarea
                    rows={3}
                    value={checkout.instructions}
                    onChange={(e) => patch({ instructions: e.target.value })}
                    placeholder="Gate code, landmark…"
                  />
                </label>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2>
                <span className="gs-card-ico pay" aria-hidden="true" />
                Payment
              </h2>
              <div className="gs-pay-list">
                {PAYMENT_OPTIONS.map((opt) => (
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
                <label className="gs-upi-field">
                  UPI ID
                  <input
                    value={checkout.upiId}
                    onChange={(e) => patch({ upiId: e.target.value })}
                    placeholder="name@okhdfc"
                  />
                </label>
              ) : null}
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
                  <dt>Delivering to</dt>
                  <dd>
                    {[checkout.street, checkout.city, checkout.pincode].filter(Boolean).join(', ') ||
                      'Address not set'}
                  </dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    {checkout.payment === 'upi'
                      ? `UPI · ${checkout.upiId || '—'}`
                      : PAYMENT_OPTIONS.find((p) => p.id === checkout.payment)?.label || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Estimated arrival</dt>
                  <dd>{checkout.eta || '38 min'}</dd>
                </div>
              </dl>
            </>
          ) : null}

          <div className="gs-checkout-actions">
            <button type="button" className="gs-btn ghost" onClick={goBack}>
              Back
            </button>
            <button type="button" className="gs-btn primary" onClick={goNext}>
              {step === CHECKOUT_STEPS.length - 1 ? `Place order · ${formatPrice(total)}` : 'Continue'}
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

export function GuestPlacedPage({ slug, lastOrder }) {
  return (
    <section className="gs-placed-page">
      <div className="gs-placed-card">
        <div className="gs-placed-check" aria-hidden="true">
          ✓
        </div>
        <h1>Order placed.</h1>
        <p>
          Order #{lastOrder?.id || '—'} · arriving in about {lastOrder?.etaMinutes || 38} minutes
        </p>
        <TrackStrip
          steps={[
            { label: 'Received', state: 'done' },
            { label: 'Accepted', state: 'active' },
            { label: 'Preparing', state: 'pending' },
            { label: 'Ready', state: 'pending' },
            { label: 'Completed', state: 'pending' },
          ]}
        />
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

export function GuestTrackingPage({ slug, lastOrder }) {
  const items = lastOrder?.items || []
  const total = lastOrder?.total || items.reduce((s, i) => s + i.price * i.qty, 0)
  const address = [lastOrder?.checkout?.street, lastOrder?.checkout?.city, lastOrder?.checkout?.pincode]
    .filter(Boolean)
    .join(', ')

  return (
    <section className="gs-tracking-page">
      <div className="gs-tracking-layout">
        <div>
          <p className="gs-kicker">Live tracking</p>
          <h1>Order #{lastOrder?.id || '—'}</h1>
          <p className="gs-muted">
            Estimated arrival in {Math.max(12, (lastOrder?.etaMinutes || 38) - 14)} min
          </p>

          <TrackStrip
            steps={[
              { label: 'Received', state: 'done' },
              { label: 'Accepted', state: 'done' },
              { label: 'Preparing', state: 'active' },
              { label: 'Ready', state: 'pending' },
              { label: 'Completed', state: 'pending' },
            ]}
          />

          <div className="gs-tracking-order">
            <h3>Your order</h3>
            <ul>
              {items.length ? (
                items.map((item) => (
                  <li key={item.lineKey || item.id || item.name}>
                    <span>
                      {item.qty}× {item.name}
                    </span>
                    <b>{formatPrice(item.price * item.qty)}</b>
                  </li>
                ))
              ) : (
                <li>
                  <span>No line items yet</span>
                  <b>—</b>
                </li>
              )}
            </ul>
            <div className="gs-summary-total">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>
          </div>
        </div>

        <div className="gs-tracking-side">
          <div className="gs-side-card">
            <p className="gs-side-label">Rider</p>
            <div className="gs-rider">
              <span className="gs-rider-av">RP</span>
              <div>
                <strong>Ray P.</strong>
                <p>On the way · EU-12-AB-2391</p>
              </div>
            </div>
            <div className="gs-rider-actions">
              <button type="button" className="gs-btn ghost">
                Call
              </button>
              <button type="button" className="gs-btn ghost">
                Chat
              </button>
            </div>
          </div>
          <div className="gs-side-card">
            <p className="gs-side-label">Delivering to</p>
            <p className="gs-deliver-to">
              {address || '42 Maple Court, Camden — add an address at checkout.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const ACCOUNT_TABS = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'orders', label: 'Orders', icon: 'orders' },
  { id: 'favorites', label: 'Favorites', icon: 'heart' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
]

export function GuestAccountPage({
  slug,
  restaurantName,
  checkout,
  lastOrder,
  favorites = [],
  photoFor,
}) {
  const [tab, setTab] = useState('profile')
  const profile = {
    name: checkout?.name || 'Ashley Rein',
    email: checkout?.email || 'ashley@email.com',
    phone: checkout?.phone || '+91 98xxxxxxxx',
    address:
      [checkout?.street, checkout?.city, checkout?.pincode].filter(Boolean).join(', ') ||
      'Flat 4B, 12 Linking Road',
  }
  const initials = profile.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const orders = useMemo(() => {
    const list = []
    if (lastOrder?.id) {
      list.push({
        id: lastOrder.id,
        when: 'Today',
        status: 'Preparing',
        total: lastOrder.total,
        live: true,
      })
    }
    list.push(
      { id: '10412', when: '3 days ago', status: 'Delivered', total: 1240 },
      { id: '10388', when: 'Last week', status: 'Delivered', total: 890 },
    )
    return list.slice(0, 3)
  }, [lastOrder])

  const notifications = useMemo(() => {
    const notes = []
    if (lastOrder?.id) {
      notes.push({
        text: `Your order #${lastOrder.id} is being prepared.`,
        when: 'Just now',
      })
    }
    notes.push(
      { text: '₹150 off your next order — code FIG150.', when: 'Yesterday' },
      { text: 'Booking confirmed for Friday, 8:00pm.', when: 'Last week' },
    )
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
          {initials || 'AR'}
        </span>
        <div>
          <h1>{profile.name}</h1>
          <p className="gs-muted">
            Member since 2023 · {Math.max(24, orders.length)} orders
          </p>
        </div>
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
          <div>
            <span className="gs-side-label">Name</span>
            <strong>{profile.name}</strong>
            <span className="gs-side-label">Email</span>
            <strong>{profile.email}</strong>
          </div>
          <div>
            <span className="gs-side-label">Phone</span>
            <strong>{profile.phone}</strong>
            <span className="gs-side-label">Default address</span>
            <strong>{profile.address}</strong>
          </div>
          <p className="gs-fine gs-profile-hint">Details sync from your latest checkout.</p>
        </div>
      ) : null}

      {tab === 'orders' ? (
        <div className="gs-order-list">
          {orders.map((o) => (
            <article key={o.id} className="gs-order-row">
              <div>
                <strong>Order #{o.id}</strong>
                <p>
                  {o.when} · {o.status}
                </p>
              </div>
              <div className="gs-order-row-side">
                <b>{formatPrice(o.total)}</b>
                <Link
                  className="gs-text-cta"
                  to={guestSitePath(slug, o.live ? 'tracking' : 'menu')}
                >
                  View
                </Link>
              </div>
            </article>
          ))}
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
}) {
  const dateChips = useMemo(() => {
    const chips = []
    const start = new Date()
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      chips.push({
        iso,
        dow: d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(),
        day: d.getDate(),
        mon: d.toLocaleDateString('en-IN', { month: 'short' }),
      })
    }
    return chips
  }, [])

  useEffect(() => {
    if (booking.date || !dateChips[0]?.iso) return
    setBooking((b) => (b.date ? b : { ...b, date: dateChips[0].iso }))
  }, [booking.date, dateChips, setBooking])

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
    const reservationId = booked.id || booked.code || `BR-${String(booked.date || '').slice(5, 10).replace('-', '') || '2841'}`

    return (
      <section className="gs-book-page gs-book-confirm">
        <div className="gs-book-confirm-inner">
          <div className="gs-book-confirm-ico" aria-hidden="true">
            ✓
          </div>
          <h1>Table reserved.</h1>
          <p className="gs-muted">
            Reservation #{reservationId} · {dateLabel} at {booked.time} for {booked.guests} guests
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
              A confirmation will land in your inbox within a minute. We&apos;ll text a reminder 2
              hours before your booking.
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
    <section className="gs-book-page">
      <div className="gs-book-hero">
        <p className="gs-kicker">Reservations</p>
        <h1>Book a table.</h1>
        <p>Confirmed instantly. Cancellations free up to 2 hours before.</p>
      </div>

      <form className="gs-book-card" onSubmit={submitBooking}>
        {bookError ? <p className="gs-form-error">{bookError}</p> : null}

        <div className="gs-book-field">
          <span className="gs-book-label">Date</span>
          <div className="gs-date-chips">
            {dateChips.map((chip) => (
              <button
                key={chip.iso}
                type="button"
                className={`gs-date-chip${booking.date === chip.iso ? ' is-selected' : ''}`}
                onClick={() => setBooking((b) => ({ ...b, date: chip.iso, time: '' }))}
              >
                <em>{chip.dow}</em>
                <strong>{chip.day}</strong>
                <span>{chip.mon}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="gs-book-field">
          <span className="gs-book-label">Time</span>
          {!booking.date ? (
            <p className="gs-muted">Pick a date to see open slots.</p>
          ) : availMeta.loading ? (
            <p className="gs-muted">Loading availability…</p>
          ) : availMeta.closed || availSlots.length === 0 ? (
            <p className="gs-muted">{availMeta.reason || 'No open slots for this date.'}</p>
          ) : (
            <div className="gs-time-grid">
              {availSlots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={Boolean(slot.full)}
                  className={`gs-time-chip${booking.time === slot.time ? ' is-selected' : ''}${slot.full ? ' is-full' : ''}`}
                  onClick={() => setBooking((b) => ({ ...b, time: slot.time }))}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="gs-book-field">
          <span className="gs-book-label">Guests</span>
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
            <strong>{booking.guests}</strong>
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
        </div>

        <div className="gs-book-field two-col">
          <label>
            Name
            <input
              required
              value={booking.name}
              onChange={(e) => setBooking((b) => ({ ...b, name: e.target.value }))}
              placeholder="Guest name"
            />
          </label>
          <label>
            Phone
            <input
              required
              value={booking.phone}
              onChange={(e) => setBooking((b) => ({ ...b, phone: e.target.value }))}
              placeholder="+91 …"
            />
          </label>
        </div>

        <label className="gs-book-field">
          <span className="gs-book-label">Special requests</span>
          <textarea
            rows={3}
            value={booking.notes}
            onChange={(e) => setBooking((b) => ({ ...b, notes: e.target.value }))}
            placeholder="Birthday cake at 8:30pm, window table preferred…"
          />
        </label>

        <button
          className="gs-btn primary gs-wide"
          type="submit"
          disabled={bookingBusy || !booking.date || !booking.time}
        >
          {bookingBusy ? 'Sending…' : 'Confirm booking'}
        </button>
      </form>
    </section>
  )
}
