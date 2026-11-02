import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/shared/lib/api'
import { guestSitePath } from '@/shared/utils/guestLinks'
import './GuestBooking.css'

const STATUS_TEXT = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  no_show: 'Missed',
  cancelled: 'Cancelled',
}

function GuestBooking() {
  const { slug, token } = useParams()
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .getPublicBooking(slug, token)
      .then((data) => alive && setBooking(data.booking))
      .catch((err) => alive && setError(err.message || 'Booking not found.'))
    return () => {
      alive = false
    }
  }, [slug, token])

  const cancel = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api.cancelPublicBooking(slug, token)
      setBooking(data.booking)
    } catch (err) {
      setError(err.message || 'Unable to cancel this booking.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="guest-booking">
      <section className="guest-booking-card">
        {!booking && !error ? <p>Loading…</p> : null}
        {booking ? (
          <>
            <p className="guest-booking-eyebrow">{booking.restaurantName}</p>
            <h1>Your table booking</h1>
            <dl>
              <div><dt>Name</dt><dd>{booking.guestName}</dd></div>
              <div><dt>Date</dt><dd>{booking.date}</dd></div>
              <div><dt>Time</dt><dd>{booking.time}</dd></div>
              <div><dt>Guests</dt><dd>{booking.guests}</dd></div>
              <div><dt>Status</dt><dd>{STATUS_TEXT[booking.status] || booking.status}</dd></div>
            </dl>
            {booking.canCancel ? (
              <button type="button" className="guest-booking-cancel" onClick={cancel} disabled={busy}>
                {busy ? 'Cancelling…' : 'Cancel this booking'}
              </button>
            ) : booking.status === 'cancelled' ? (
              <p className="guest-booking-note">This booking has been cancelled.</p>
            ) : (
              <p className="guest-booking-note">This booking can no longer be changed online. Please call the restaurant.</p>
            )}
          </>
        ) : null}
        {error ? <p className="guest-booking-error" role="alert">{error}</p> : null}
        <Link className="guest-booking-back" to={guestSitePath(slug)}>
          Back to the restaurant
        </Link>
      </section>
    </main>
  )
}

export default GuestBooking
