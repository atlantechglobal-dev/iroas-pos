import { useEffect, useState } from 'react'
import { api } from '@/shared/lib/api'
import { useToast } from '@/shared/ui/feedback/ToastProvider'

function Drawer({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="table-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="table-drawer" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="table-drawer-head">
          <h2>{title}</h2>
          <button type="button" className="table-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="table-drawer-body">{children}</div>
      </aside>
    </div>
  )
}

function AddPosTable({ onCreated }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    seats: '4',
    minimumSeating: '1',
    room: '',
    shape: 'Rectangle',
    takeAway: false,
  })

  const close = () => {
    if (busy) return
    setOpen(false)
  }

  const show = () => {
    setOpen(true)
    api
      .getPosTableOptions()
      .then((res) => setOptions(res?.data || null))
      .catch((err) => toast.error(err?.message || 'Could not load rooms.'))
  }

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await api.createPosTable({
        name: form.name,
        seats: Number(form.seats),
        minimumSeating: Number(form.minimumSeating),
        room: form.room,
        shape: form.shape,
        takeAway: form.takeAway,
      })
      toast.success(`${form.name.trim()} was added.`)
      setForm({ name: '', seats: '4', minimumSeating: '1', room: '', shape: 'Rectangle', takeAway: false })
      setOpen(false)
      onCreated(res?.data?.tables || null)
    } catch (err) {
      toast.error(err?.message || 'Could not add the table.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={show}>
        Add table
      </button>
      {open ? (
        <Drawer title="Add Dining Table" onClose={close}>
          <form onSubmit={save}>
            <label>
              Table name
              <input value={form.name} onChange={set('name')} placeholder="T13" required />
            </label>
            <div className="table-form-row">
              <label>
                Seats capacity
                <input type="number" min="1" max="100" value={form.seats} onChange={set('seats')} required />
              </label>
              <label>
                Min. seating
                <input type="number" min="1" max="100" value={form.minimumSeating} onChange={set('minimumSeating')} required />
              </label>
            </div>
            <label>
              Branch
              <select value={options?.branch || ''} disabled>
                <option value={options?.branch || ''}>{options?.branch || 'Branch'}</option>
              </select>
            </label>
            <label>
              Room
              <select value={form.room} onChange={set('room')} required>
                <option value="">Select room</option>
                {(options?.rooms || []).map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Table shape
              <select value={form.shape} onChange={set('shape')} required>
                {(options?.shapes || ['Square', 'Rectangle', 'Circle']).map((shape) => (
                  <option key={shape} value={shape}>
                    {shape}
                  </option>
                ))}
              </select>
            </label>
            <label className="table-switch">
              <input type="checkbox" checked={form.takeAway} onChange={set('takeAway')} />
              Is take away table
            </label>
            <div className="table-drawer-actions">
              <button className="btn btn-outline" type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save table'}
              </button>
            </div>
          </form>
        </Drawer>
      ) : null}
    </>
  )
}

export default AddPosTable
