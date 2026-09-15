import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import './Reservations.css'

function formatTimeLabel(time) {
  if (!time) return '—'
  const [h, m] = String(time).split(':')
  const hour = Number(h)
  if (Number.isNaN(hour)) return time
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = ((hour + 11) % 12) + 1
  return `${h12}:${m || '00'} ${ampm}`
}

function statusLabel(status) {
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'cancelled') return 'Cancelled'
  return 'Pending'
}

function Reservations() {
  const toast = useToast()
  const [activeView, setActiveView] = useState('List')
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    guestName: '',
    phone: '',
    guests: '2',
    date: '',
    time: '',
    notes: '',
  })
  const [availSlots, setAvailSlots] = useState([])
  const [availMeta, setAvailMeta] = useState({ closed: false, reason: '', loading: false })

  const load = async () => {
    setLoading(true)
    try {
      const { reservations: rows } = await api.getReservations()
      setReservations(rows || [])
    } catch (err) {
      toast.error(err.message || 'Unable to load reservations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!modalOpen || !form.date) {
      setAvailSlots([])
      setAvailMeta({ closed: false, reason: '', loading: false })
      return undefined
    }

    let cancelled = false
    setAvailMeta((prev) => ({ ...prev, loading: true }))
    api
      .getReservationAvailability({ date: form.date, guests: form.guests })
      .then((data) => {
        if (cancelled) return
        setAvailSlots(data.slots || [])
        setAvailMeta({
          closed: Boolean(data.closed),
          reason: data.reason || '',
          loading: false,
        })
        setForm((prev) => {
          if (!prev.time) return prev
          const stillOpen = (data.slots || []).some((s) => s.time === prev.time && !s.full)
          return stillOpen ? prev : { ...prev, time: '' }
        })
      })
      .catch((err) => {
        if (cancelled) return
        setAvailSlots([])
        setAvailMeta({
          closed: true,
          reason: err.message || 'Unable to load availability.',
          loading: false,
        })
      })

    return () => {
      cancelled = true
    }
  }, [modalOpen, form.date, form.guests])

  const setStatus = async (id, status) => {
    try {
      const { reservation } = await api.updateReservation(id, { status })
      setReservations((prev) => prev.map((r) => (r.id === id ? reservation : r)))
      toast.success(`Reservation ${status}.`)
    } catch (err) {
      toast.error(err.message || 'Unable to update reservation.')
    }
  }

  const createBooking = async (event) => {
    event.preventDefault()
    if (!form.time) {
      toast.error('Please select an available time slot.')
      return
    }
    try {
      const { reservation } = await api.createReservation({
        guestName: form.guestName,
        phone: form.phone,
        guests: form.guests,
        date: form.date,
        time: form.time,
        notes: form.notes,
        status: 'confirmed',
      })
      setReservations((prev) => [...prev, reservation])
      setModalOpen(false)
      setForm({ guestName: '', phone: '', guests: '2', date: '', time: '', notes: '' })
      toast.success('Booking created.')
    } catch (err) {
      toast.error(err.message || 'Unable to create booking.')
    }
  }

  const upcoming = reservations.filter((r) => r.status !== 'cancelled')
  const todayIso = new Date().toISOString().slice(0, 10)
  const todayCovers = upcoming
    .filter((r) => r.date === todayIso)
    .reduce((sum, r) => sum + (Number(r.guests) || 0), 0)

  return (
    <DashboardLayout pageClassName="reservations-page" activeNav="reservations">
      <div className="page-head">
        <div>
          <p className="eyebrow">FRONT OF HOUSE</p>
          <h1>Reservations</h1>
          <p className="page-desc">
            Guest bookings from your website appear here. Confirm, cancel, or add walk-ins.
          </p>
        </div>

        <div className="head-right-actions">
          <div className="view-toggle-bar">
            {['Timeline', 'List'].map((view) => (
              <button
                key={view}
                type="button"
                className={`view-toggle-btn ${activeView === view ? 'active' : ''}`}
                onClick={() => setActiveView(view)}
              >
                {view}
              </button>
            ))}
          </div>

          <button type="button" className="btn-new-booking" onClick={() => setModalOpen(true)}>
            + New booking
          </button>
        </div>
      </div>

      {activeView === 'Timeline' ? (
        <div className="timeline-card">
          <div className="card-title-head">
            <h2>Booking timeline</h2>
            <span>
              {upcoming.length} active · {todayCovers} covers today
            </span>
          </div>
          <div className="timeline-simple">
            {loading ? <p className="empty-res">Loading…</p> : null}
            {!loading && upcoming.length === 0 ? (
              <p className="empty-res">No upcoming bookings yet. Guests can book from your site.</p>
            ) : null}
            {upcoming.map((res) => (
              <div className="timeline-simple-row" key={res.id}>
                <div className="party-badge">{res.guests}</div>
                <div className="res-main-info">
                  <strong>{res.guestName}</strong>
                  <small>
                    {res.date} · {formatTimeLabel(res.time)} · {res.phone}
                  </small>
                </div>
                <span className={`status-badge ${res.status === 'confirmed' ? 'confirmed' : 'pending'}`}>
                  {statusLabel(res.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="upcoming-card">
        <div className="card-title-head" style={{ marginBottom: 0 }}>
          <h2>All reservations</h2>
          <span>Confirm pending requests from the guest website</span>
        </div>

        <div className="upcoming-list">
          {loading ? <p className="empty-res">Loading…</p> : null}
          {!loading && reservations.length === 0 ? (
            <p className="empty-res">No reservations yet.</p>
          ) : null}
          {reservations.map((res) => (
            <div className="upcoming-row" key={res.id}>
              <div className="party-badge">{res.guests}</div>

              <div className="res-main-info">
                <strong>{res.guestName}</strong>
                <small>
                  {res.phone}
                  {res.notes ? ` · ${res.notes}` : ''}
                </small>
              </div>

              <div className="res-time-info">
                <strong>{formatTimeLabel(res.time)}</strong>
                <small>{res.date}</small>
              </div>

              <span
                className={`status-badge ${
                  res.status === 'confirmed'
                    ? 'confirmed'
                    : res.status === 'cancelled'
                      ? 'cancelled'
                      : 'pending'
                }`}
              >
                {statusLabel(res.status)}
              </span>

              <div className="res-actions">
                {res.status !== 'confirmed' ? (
                  <button type="button" className="btn-manage-res" onClick={() => setStatus(res.id, 'confirmed')}>
                    Confirm
                  </button>
                ) : null}
                {res.status !== 'cancelled' ? (
                  <button type="button" className="btn-manage-res" onClick={() => setStatus(res.id, 'cancelled')}>
                    Cancel
                  </button>
                ) : null}
                {res.status === 'cancelled' ? (
                  <button type="button" className="btn-manage-res" onClick={() => setStatus(res.id, 'pending')}>
                    Restore
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen ? (
        <div className="res-modal" role="dialog" aria-modal="true">
          <div className="res-modal-backdrop" onClick={() => setModalOpen(false)} />
          <form className="res-modal-card" onSubmit={createBooking}>
            <h3>New booking</h3>
            <label>
              Guest name
              <input
                required
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label>
              Guests
              <select
                value={form.guests}
                onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value, time: '' }))}
              >
                {['1', '2', '3', '4', '5', '6', '8', '10'].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, time: '' }))}
              />
            </label>
            <div className="res-slot-field">
              <span className="res-slot-label">Available times</span>
              {!form.date ? (
                <p className="empty-res">Pick a date to see open slots.</p>
              ) : availMeta.loading ? (
                <p className="empty-res">Loading availability…</p>
              ) : availMeta.closed || availSlots.length === 0 ? (
                <p className="empty-res">
                  {availMeta.reason || 'No open slots for this date and party size.'}
                </p>
              ) : (
                <div className="res-slot-grid" role="listbox" aria-label="Available time slots">
                  {availSlots.map((slot) => {
                    const selected = form.time === slot.time
                    const disabled = Boolean(slot.full)
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`res-slot${selected ? ' is-selected' : ''}${disabled ? ' is-full' : ''}`}
                        disabled={disabled}
                        onClick={() => setForm((f) => ({ ...f, time: slot.time }))}
                      >
                        <strong>{slot.time}</strong>
                        <span>{disabled ? 'Full' : `${slot.remainingCovers} left`}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <label>
              Notes
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className="res-modal-actions">
              <button type="button" className="btn-manage-res" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-new-booking" disabled={!form.time}>
                Save booking
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default Reservations
