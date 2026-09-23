import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { downloadQrPng } from '@/shared/ui/QrCodePreview'
import { guestTableUrl, restaurantPublicSlug } from '@/shared/utils/guestLinks'
import { todayIso } from '@/shared/utils/localDate'
import '@/features/dashboard/Reservations/Reservations.css'

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
  const [activeView, setActiveView] = useState('Timeline')
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [calendarDate, setCalendarDate] = useState(todayIso())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [tableForm, setTableForm] = useState({ name: '', seats: '4', zone: '' })
  const [form, setForm] = useState({
    guestName: '',
    phone: '',
    email: '',
    guests: '2',
    date: todayIso(),
    time: '',
    notes: '',
    tableId: '',
    status: 'confirmed',
  })
  const [availSlots, setAvailSlots] = useState([])
  const [availMeta, setAvailMeta] = useState({ closed: false, reason: '', loading: false })
  const [dayHours, setDayHours] = useState({
    openHour: 10,
    closeHour: 22,
    slotTimes: [],
    closed: false,
    reason: '',
  })
  const [siteSlug, setSiteSlug] = useState('')
  const [modalError, setModalError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [{ reservations: rows }, tablesRes, restRes] = await Promise.all([
        api.getReservations(),
        api.getDiningTables().catch(() => ({ tables: [] })),
        api.getRestaurant().catch(() => null),
      ])
      setReservations(rows || [])
      setTables((tablesRes?.tables || []).filter((t) => t.active !== 0 && t.active !== false))
      if (restRes?.restaurant) {
        setSiteSlug(restaurantPublicSlug(restRes.restaurant, 'your-restaurant'))
      }
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
        const slots = data.slots || []
        setAvailSlots(slots)
        setAvailMeta({
          closed: Boolean(data.closed),
          reason: data.reason || '',
          loading: false,
        })
        const openTimes = slots.map((s) => s.time).filter(Boolean)
        if (openTimes.length) {
          const hours = openTimes.map((t) => Number(String(t).split(':')[0])).filter((n) => !Number.isNaN(n))
          if (hours.length) {
            setDayHours((prev) => ({
              ...prev,
              openHour: Math.min(...hours),
              closeHour: Math.max(...hours) + 1,
            }))
          }
        }
        setForm((prev) => {
          if (!prev.time) return prev
          const stillOpen = slots.some(
            (s) => s.time === prev.time && (!s.full || Number(editingId) > 0),
          )
          // When editing, allow current time even if marked full (capacity excludes self server-side)
          if (editingId && prev.time) return prev
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
  }, [modalOpen, form.date, form.guests, editingId])

  // Prefetch day hours / slots for calendar when date changes
  useEffect(() => {
    let cancelled = false
    api
      .getReservationAvailability({ date: calendarDate, guests: 2, includePast: true })
      .then((data) => {
        if (cancelled) return
        const allTimes = (data.slots || []).map((s) => s.time).filter(Boolean)
        // Include full slots for calendar columns so staff still see the grid
        if (data.closed || !allTimes.length) {
          setDayHours((prev) => ({
            ...prev,
            slotTimes: [],
            closed: Boolean(data.closed) || !allTimes.length,
            reason: data.reason || (data.closed ? 'Closed' : 'No remaining slots today.'),
          }))
          return
        }
        const hours = allTimes.map((t) => Number(String(t).split(':')[0])).filter((n) => !Number.isNaN(n))
        setDayHours({
          openHour: hours.length ? Math.min(...hours) : 10,
          closeHour: hours.length ? Math.max(...hours) + 1 : 22,
          slotTimes: allTimes,
          closed: false,
          reason: '',
        })
      })
      .catch(() => {
        if (!cancelled) {
          setDayHours((prev) => ({
            ...prev,
            closed: false,
            reason: '',
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [calendarDate])

  const setStatus = async (id, status) => {
    try {
      const { reservation } = await api.updateReservation(id, { status })
      setReservations((prev) => prev.map((r) => (r.id === id ? reservation : r)))
      toast.success(`Reservation ${status}.`)
    } catch (err) {
      toast.error(err.message || 'Unable to update reservation.')
    }
  }

  const openNewBooking = (date = calendarDate, extras = {}) => {
    setEditingId(null)
    setModalError('')
    setForm({
      guestName: '',
      phone: '',
      email: '',
      guests: '2',
      date: date || todayIso(),
      time: extras.time || '',
      notes: '',
      tableId: extras.tableId != null && extras.tableId !== 'unassigned' ? String(extras.tableId) : '',
      status: 'confirmed',
    })
    setModalOpen(true)
  }

  const openEditBooking = (res) => {
    setEditingId(res.id)
    setModalError('')
    setForm({
      guestName: res.guestName || '',
      phone: res.phone || '',
      email: res.email || '',
      guests: String(res.guests || 2),
      date: res.date || todayIso(),
      time: res.time || '',
      notes: res.notes || '',
      tableId: res.tableId ? String(res.tableId) : '',
      status: res.status || 'pending',
    })
    setModalOpen(true)
  }

  const saveBooking = async (event) => {
    event.preventDefault()
    setModalError('')
    if (!form.time) {
      setModalError('Please select an available time slot.')
      toast.error('Please select an available time slot.')
      return
    }
    const payload = {
      guestName: form.guestName,
      phone: form.phone,
      email: form.email,
      guests: form.guests,
      date: form.date,
      time: form.time,
      notes: form.notes,
      tableId: form.tableId || null,
      status: form.status || 'confirmed',
    }
    try {
      if (editingId) {
        const { reservation } = await api.updateReservation(editingId, payload)
        setReservations((prev) => prev.map((r) => (r.id === editingId ? reservation : r)))
        toast.success('Booking updated.')
      } else {
        const { reservation } = await api.createReservation({
          ...payload,
          status: 'confirmed',
        })
        setReservations((prev) => [...prev, reservation])
        toast.success('Booking created.')
      }
      setModalOpen(false)
      setEditingId(null)
      setModalError('')
    } catch (err) {
      const msg = err.message || 'Unable to save booking.'
      setModalError(msg)
      toast.error(msg)
    }
  }

  const addTable = async (event) => {
    event.preventDefault()
    try {
      const { table } = await api.createDiningTable({
        name: tableForm.name,
        seats: tableForm.seats,
        zone: tableForm.zone,
      })
      setTables((prev) => [...prev, table])
      setTableForm({ name: '', seats: '4', zone: '' })
      toast.success('Table added.')
    } catch (err) {
      toast.error(err.message || 'Unable to add table.')
    }
  }

  const removeTable = async (id) => {
    try {
      await api.deleteDiningTable(id)
      setTables((prev) => prev.filter((t) => t.id !== id))
      toast.success('Table archived.')
    } catch (err) {
      toast.error(err.message || 'Unable to remove table.')
    }
  }

  const downloadTableQr = async (table) => {
    if (!siteSlug || !table.publicCode) {
      toast.error('Table QR code is not ready yet.')
      return
    }
    try {
      const url = guestTableUrl(siteSlug, table.publicCode)
      await downloadQrPng(url, `table-${table.name || table.publicCode}-qr.png`, { width: 512 })
      toast.success(`QR downloaded for ${table.name}`)
    } catch (err) {
      toast.error(err.message || 'Unable to download QR.')
    }
  }

  const upcoming = reservations.filter((r) => r.status !== 'cancelled')
  const dayBookings = useMemo(
    () =>
      upcoming
        .filter((r) => r.date === calendarDate)
        .sort((a, b) => String(a.time).localeCompare(String(b.time))),
    [upcoming, calendarDate],
  )
  const todayCovers = upcoming
    .filter((r) => r.date === todayIso())
    .reduce((sum, r) => sum + (Number(r.guests) || 0), 0)

  const slotColumns = useMemo(() => {
    if (Array.isArray(dayHours.slotTimes) && dayHours.slotTimes.length) {
      return dayHours.slotTimes
    }
    // Fallback 30-min grid from open/close hours when availability hasn't loaded
    const slots = []
    const start = Math.max(0, Math.min(23, dayHours.openHour ?? 10))
    const end = Math.max(start, Math.min(23, dayHours.closeHour ?? 22))
    for (let h = start; h < end; h += 1) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }, [dayHours])

  const tableName = (id) => tables.find((t) => Number(t.id) === Number(id))?.name
  const useTableGrid = tables.length > 0
  const calendarRows = useMemo(() => {
    if (!useTableGrid) return []
    return [...tables, { id: 'unassigned', name: 'Unassigned', seats: '—' }]
  }, [tables, useTableGrid])

  const normalizeTime = (t) => {
    const parts = String(t || '').split(':')
    if (parts.length < 2) return String(t || '')
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }

  const bookingsForCell = (rowId, slotTime) =>
    dayBookings.filter((r) => {
      const matchesTable =
        rowId === 'unassigned'
          ? !r.tableId
          : Number(r.tableId) === Number(rowId)
      return matchesTable && normalizeTime(r.time) === normalizeTime(slotTime)
    })

  const openCellBooking = (slotTime, rowId) => {
    openNewBooking(calendarDate, {
      time: slotTime,
      tableId: rowId === 'unassigned' ? '' : rowId,
    })
  }

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
            {['Timeline', 'List', 'Tables'].map((view) => (
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

          <button type="button" className="btn-new-booking" onClick={() => openNewBooking()}>
            + New booking
          </button>
        </div>
      </div>

      {activeView === 'Timeline' ? (
        <div className="timeline-card">
          <div className="card-title-head">
            <h2>Day calendar</h2>
            <span>
              {dayBookings.length} bookings · {todayCovers} covers today
            </span>
          </div>

          <div className="calendar-toolbar">
            <label>
              Date
              <input
                type="date"
                value={calendarDate}
                onChange={(e) => setCalendarDate(e.target.value)}
              />
            </label>
            <button type="button" className="btn-manage-res" onClick={() => setCalendarDate(todayIso())}>
              Today
            </button>
            <button type="button" className="btn-new-booking" onClick={() => openNewBooking(calendarDate)}>
              Book this day
            </button>
            <div className="calendar-legend" aria-label="Status legend">
              <span className="legend-item">
                <span className="legend-swatch amber" /> Pending
              </span>
              <span className="legend-item">
                <span className="legend-swatch green" /> Confirmed
              </span>
            </div>
          </div>

          {dayHours.closed ? (
            <div className="calendar-closed-banner" role="status">
              <strong>Closed</strong>
              <span>{dayHours.reason || 'No booking slots for this day.'}</span>
            </div>
          ) : null}

          <div className="timeline-grid-wrapper">
            {loading ? <p className="empty-res">Loading…</p> : null}
            {!loading && !dayHours.closed && dayBookings.length === 0 ? (
              <p className="empty-res">No bookings on this day. Click an empty cell to add one.</p>
            ) : null}
            {!loading && !dayHours.closed && useTableGrid ? (
              <table className="timeline-table table-grid">
                <thead>
                  <tr>
                    <th className="col-label">Table</th>
                    {slotColumns.map((slot) => (
                      <th key={slot}>{formatTimeLabel(slot)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarRows.map((row) => (
                    <tr key={row.id}>
                      <td className="table-row-label">
                        <strong>{row.name}</strong>
                        {row.seats !== '—' ? <small>{row.seats} seats</small> : null}
                      </td>
                      {slotColumns.map((slot) => {
                        const cellBookings = bookingsForCell(row.id, slot)
                        return (
                          <td key={`${row.id}-${slot}`} className="slot-cell">
                            <div className="booking-pill-row">
                              {cellBookings.map((res) => (
                                <button
                                  key={res.id}
                                  type="button"
                                  className={`booking-pill ${res.status === 'confirmed' ? 'green' : 'amber'}`}
                                  title={`${res.guestName} · ${res.phone}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditBooking(res)
                                  }}
                                >
                                  {formatTimeLabel(res.time)} · {res.guestName} · {res.guests}
                                </button>
                              ))}
                              {!cellBookings.length ? (
                                <button
                                  type="button"
                                  className="slot-empty-btn"
                                  title={`Book ${formatTimeLabel(slot)} · ${row.name}`}
                                  onClick={() => openCellBooking(slot, row.id)}
                                >
                                  +
                                </button>
                              ) : null}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {!loading && !dayHours.closed && !useTableGrid ? (
              <table className="timeline-table">
                <thead>
                  <tr>
                    <th className="col-label">Time</th>
                    <th>Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {slotColumns.map((slot) => {
                    const inSlot = dayBookings.filter(
                      (r) => normalizeTime(r.time) === normalizeTime(slot),
                    )
                    return (
                      <tr key={slot}>
                        <td className="table-row-label">{formatTimeLabel(slot)}</td>
                        <td className="slot-cell">
                          <div className="booking-pill-row">
                            {inSlot.map((res) => (
                              <button
                                key={res.id}
                                type="button"
                                className={`booking-pill ${res.status === 'confirmed' ? 'green' : 'amber'}`}
                                title={`${res.guestName} · ${res.phone}`}
                                onClick={() => openEditBooking(res)}
                              >
                                {formatTimeLabel(res.time)} · {res.guestName} · {res.guests}
                                {res.tableId
                                  ? ` · ${tableName(res.tableId) || `T${res.tableId}`}`
                                  : ''}
                              </button>
                            ))}
                            {!inSlot.length ? (
                              <button
                                type="button"
                                className="slot-empty-btn"
                                title={`Book ${formatTimeLabel(slot)}`}
                                onClick={() => openCellBooking(slot, 'unassigned')}
                              >
                                + Add
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeView === 'List' ? (
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
                    {res.email ? ` · ${res.email}` : ''}
                    {res.tableId ? ` · ${tableName(res.tableId) || `Table ${res.tableId}`}` : ''}
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
                  <button type="button" className="btn-manage-res" onClick={() => openEditBooking(res)}>
                    Edit
                  </button>
                  {res.status !== 'confirmed' ? (
                    <button
                      type="button"
                      className="btn-manage-res"
                      onClick={() => setStatus(res.id, 'confirmed')}
                    >
                      Confirm
                    </button>
                  ) : null}
                  {res.status !== 'cancelled' ? (
                    <button
                      type="button"
                      className="btn-manage-res"
                      onClick={() => setStatus(res.id, 'cancelled')}
                    >
                      Cancel
                    </button>
                  ) : null}
                  {res.status === 'cancelled' ? (
                    <button
                      type="button"
                      className="btn-manage-res"
                      onClick={() => setStatus(res.id, 'pending')}
                    >
                      Restore
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === 'Tables' ? (
        <div className="upcoming-card">
          <div className="card-title-head">
            <h2>Dining tables</h2>
            <span>Print QR codes for dine-in ordering · also used for reservation seating</span>
          </div>

          <form className="table-add-form" onSubmit={addTable}>
            <input
              required
              placeholder="Table name (e.g. T-08)"
              value={tableForm.name}
              onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              type="number"
              min={1}
              max={40}
              required
              value={tableForm.seats}
              onChange={(e) => setTableForm((f) => ({ ...f, seats: e.target.value }))}
              aria-label="Seats"
            />
            <input
              placeholder="Zone (optional)"
              value={tableForm.zone}
              onChange={(e) => setTableForm((f) => ({ ...f, zone: e.target.value }))}
            />
            <button type="submit" className="btn-new-booking">
              Add table
            </button>
          </form>

          <div className="upcoming-list">
            {tables.length === 0 ? (
              <p className="empty-res">No tables yet — bookings use covers capacity only.</p>
            ) : null}
            {tables.map((t) => (
              <div className="upcoming-row" key={t.id}>
                <div className="party-badge">{t.seats}</div>
                <div className="res-main-info">
                  <strong>{t.name}</strong>
                  <small>
                    {t.seats} seats{t.zone ? ` · ${t.zone}` : ''}
                    {t.publicCode ? ` · QR /s/…/t/${t.publicCode}` : ''}
                  </small>
                </div>
                <div className="res-actions">
                  <button type="button" className="btn-manage-res" onClick={() => downloadTableQr(t)}>
                    Download QR
                  </button>
                  <button type="button" className="btn-manage-res" onClick={() => removeTable(t.id)}>
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="res-modal" role="dialog" aria-modal="true">
          <div
            className="res-modal-backdrop"
            onClick={() => {
              setModalOpen(false)
              setEditingId(null)
              setModalError('')
            }}
          />
          <form className="res-modal-card" onSubmit={saveBooking}>
            <h3>{editingId ? 'Edit booking' : 'New booking'}</h3>
            {modalError ? (
              <p className="res-modal-error" role="alert">
                {modalError}
              </p>
            ) : null}
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
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label>
              Guests
              <select
                value={form.guests}
                onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value, time: editingId ? f.time : '' }))}
              >
                {['1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20'].map((n) => (
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value, time: editingId ? f.time : '' }))
                }
              />
            </label>
            {editingId ? (
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            ) : null}
            {tables.length > 0 ? (
              <label>
                Table (optional)
                <select
                  value={form.tableId}
                  onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
                >
                  <option value="">Auto-assign / none</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.seats})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
                    const disabled = Boolean(slot.full) && form.time !== slot.time
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
              <button
                type="button"
                className="btn-manage-res"
                onClick={() => {
                  setModalOpen(false)
                  setEditingId(null)
                  setModalError('')
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-new-booking" disabled={!form.time}>
                {editingId ? 'Save changes' : 'Save booking'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default Reservations
