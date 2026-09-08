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
    time: '19:00',
    notes: '',
  })

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
      setForm({ guestName: '', phone: '', guests: '2', date: '', time: '19:00', notes: '' })
      toast.success('Booking created.')
    } catch (err) {
      toast.error(err.message || 'Unable to create booking.')
    }
  }

  const upcoming = reservations.filter((r) => r.status !== 'cancelled')

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
            <span>{upcoming.length} active</span>
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
                onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
            <label>
              Time
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </label>
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
              <button type="submit" className="btn-new-booking">
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
