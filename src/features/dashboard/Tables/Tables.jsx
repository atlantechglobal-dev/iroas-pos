import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { QrCodePreview, downloadQrPng } from '@/shared/ui/QrCodePreview'
import { api } from '@/shared/lib/api'
import { guestTableUrl, restaurantPublicSlug } from '@/shared/utils/guestLinks'
import '@/features/dashboard/Tables/Tables.css'

function Tables() {
  const toast = useToast()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [siteSlug, setSiteSlug] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({ name: '', seats: '4', zone: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [tablesRes, restRes] = await Promise.all([
        api.getDiningTables(),
        api.getRestaurant(),
      ])
      const rows = (tablesRes?.tables || []).filter((t) => t.active !== 0 && t.active !== false)
      setTables(rows)
      const restaurant = restRes?.restaurant
      if (restaurant) {
        setSiteSlug(restaurantPublicSlug(restaurant, 'your-restaurant'))
        setRestaurantName(restaurant.name || '')
      }
      if (!selectedId && rows[0]) setSelectedId(rows[0].id)
      if (selectedId && !rows.some((t) => t.id === selectedId) && rows[0]) {
        setSelectedId(rows[0].id)
      }
    } catch (err) {
      toast.error(err.message || 'Unable to load tables.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = useMemo(
    () => tables.find((t) => Number(t.id) === Number(selectedId)) || null,
    [tables, selectedId],
  )

  const orderUrl = selected?.publicCode && siteSlug
    ? guestTableUrl(siteSlug, selected.publicCode)
    : ''

  const addTable = async (event) => {
    event.preventDefault()
    try {
      const { table } = await api.createDiningTable({
        name: form.name,
        seats: form.seats,
        zone: form.zone,
      })
      setTables((prev) => [...prev, table])
      setSelectedId(table.id)
      setForm({ name: '', seats: '4', zone: '' })
      toast.success(`${table.name} added — QR ready to print.`)
    } catch (err) {
      toast.error(err.message || 'Unable to add table.')
    }
  }

  const archiveTable = async (id) => {
    try {
      await api.deleteDiningTable(id)
      setTables((prev) => prev.filter((t) => t.id !== id))
      if (Number(selectedId) === Number(id)) setSelectedId(null)
      toast.success('Table archived.')
    } catch (err) {
      toast.error(err.message || 'Unable to archive table.')
    }
  }

  const copyLink = async () => {
    if (!orderUrl) return
    try {
      await navigator.clipboard.writeText(orderUrl)
      toast.success('Order link copied.')
    } catch {
      toast.info(orderUrl)
    }
  }

  const downloadQr = async (table = selected) => {
    if (!table?.publicCode || !siteSlug) {
      toast.error('QR is not ready yet.')
      return
    }
    try {
      const url = guestTableUrl(siteSlug, table.publicCode)
      await downloadQrPng(url, `table-${table.name || table.publicCode}-qr.png`, { width: 640 })
      toast.success(`Downloaded QR for ${table.name}`)
    } catch (err) {
      toast.error(err.message || 'Unable to download QR.')
    }
  }

  const printSelected = () => {
    if (!selected || !orderUrl) {
      toast.error('Select a table with a QR first.')
      return
    }
    window.print()
  }

  return (
    <DashboardLayout pageClassName="tables-page table-qr-page" activeNav="tables">
      <div className="page-head">
        <div>
          <p className="eyebrow">Dine-in ordering</p>
          <h1>Table QR codes</h1>
          <p className="page-desc">
            Print one QR per table. Guests scan → open the menu → add to cart → order for that table.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-outline" type="button" onClick={printSelected}>
            Print selected
          </button>
          <button className="btn btn-primary" type="button" onClick={() => downloadQr()}>
            Download QR
          </button>
        </div>
      </div>

      <div className="table-qr-layout">
        <section className="table-qr-list-card">
          <div className="card-title-head">
            <h2>Dining tables</h2>
            <span>{tables.length} active</span>
          </div>

          <form className="table-qr-add" onSubmit={addTable}>
            <input
              required
              placeholder="Table name (e.g. T-08)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              type="number"
              min={1}
              max={40}
              required
              value={form.seats}
              onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
              aria-label="Seats"
            />
            <input
              placeholder="Zone (optional)"
              value={form.zone}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
            />
            <button type="submit" className="btn btn-primary">
              + Add table
            </button>
          </form>

          {loading ? <p className="empty-tables">Loading…</p> : null}
          {!loading && tables.length === 0 ? (
            <p className="empty-tables">
              No tables yet. Add your first table to generate a dine-in QR.
            </p>
          ) : null}

          <div className="table-qr-grid">
            {tables.map((t) => {
              const url = siteSlug && t.publicCode ? guestTableUrl(siteSlug, t.publicCode) : ''
              const active = Number(selectedId) === Number(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`table-qr-tile${active ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <div className="table-qr-tile-top">
                    <strong>{t.name}</strong>
                    <span>{t.seats} seats</span>
                  </div>
                  <div className="table-qr-mini">
                    <QrCodePreview
                      value={url}
                      size={88}
                      alt={`QR for ${t.name}`}
                      emptyMessage="—"
                    />
                  </div>
                  <small>{t.zone || 'No zone'} · {t.publicCode || 'pending code'}</small>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="table-qr-detail-card">
          {selected ? (
            <>
              <div className="print-sheet" id="table-qr-print">
                <p className="print-brand">{restaurantName || 'Restaurant'}</p>
                <h2>{selected.name}</h2>
                <p className="print-sub">Scan to view the menu and order to this table</p>
                <div className="table-qr-preview">
                  <QrCodePreview
                    value={orderUrl}
                    size={220}
                    alt={`QR for ${selected.name}`}
                    emptyMessage="Set your public site slug to generate QR."
                  />
                </div>
                <p className="print-url">{orderUrl || 'Link unavailable'}</p>
              </div>

              <div className="table-qr-actions no-print">
                <button type="button" className="btn btn-primary" onClick={() => downloadQr(selected)}>
                  Download PNG
                </button>
                <button type="button" className="btn btn-outline" onClick={copyLink}>
                  Copy order link
                </button>
                <button type="button" className="btn btn-outline" onClick={printSelected}>
                  Print tent card
                </button>
                <button
                  type="button"
                  className="btn btn-outline danger"
                  onClick={() => archiveTable(selected.id)}
                >
                  Archive table
                </button>
              </div>

              <ol className="table-qr-steps no-print">
                <li>Print or place the QR on {selected.name}.</li>
                <li>Guest scans → menu opens locked to this table.</li>
                <li>They add dishes to cart and checkout (bill now or pay later).</li>
                <li>Order appears in Incoming Orders as dine-in.</li>
              </ol>
            </>
          ) : (
            <p className="empty-tables">Select a table to preview its QR.</p>
          )}
        </aside>
      </div>
    </DashboardLayout>
  )
}

export default Tables
