import { useCallback, useEffect, useState } from 'react'
import { api } from '@/shared/lib/api'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { QrCodePreview, downloadQrPng } from '@/shared/ui/QrCodePreview'
import { guestTableUrl } from '@/shared/utils/guestLinks'
import '@/features/dashboard/Tables/Tables.css'

/** Printable QR codes for the restaurant's POS (URY) tables. Scans order straight to that table. */
function PosTableQrPanel({ siteSlug, refreshKey = 0 }) {
  const toast = useToast()
  const [state, setState] = useState({ status: 'loading', tables: [], guestOrdering: false })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: prev.status === 'ready' ? 'ready' : 'loading' }))
    try {
      const res = await api.getPosTableQr()
      setState({ status: 'ready', tables: res?.data?.tables || [], guestOrdering: Boolean(res?.data?.guestOrdering) })
    } catch (err) {
      setState({ status: err?.code === 'pos_not_connected' ? 'not_connected' : 'error', tables: [], guestOrdering: false })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (state.status === 'not_connected') return null

  const urlFor = (table) => (siteSlug ? guestTableUrl(siteSlug, table.code) : '')

  const download = async (table) => {
    try {
      await downloadQrPng(urlFor(table), `pos-table-${table.name}-qr.png`, { width: 640 })
      toast.success(`Downloaded QR for ${table.name}`)
    } catch (err) {
      toast.error(err.message || 'Unable to download QR.')
    }
  }

  const copy = async (table) => {
    const url = urlFor(table)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Order link copied.')
    } catch {
      toast.info(url)
    }
  }

  const tables = [...state.tables].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  return (
    <section className="pos-tables-card">
      <div className="card-title-head">
        <h2>POS table QR codes</h2>
        {state.status === 'ready' ? <span>{tables.length} tables</span> : null}
      </div>
      <p className="pos-qr-note">
        Guests scan a code, see your live POS menu and send their order straight to that table in your POS kitchen.
      </p>

      {state.status === 'loading' ? <p className="empty-tables">Loading tables…</p> : null}

      {state.status === 'error' ? (
        <div className="pos-tables-error">
          <p>Table service is temporarily unavailable. Please try again.</p>
          <button type="button" className="btn btn-outline" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {state.status === 'ready' && !state.guestOrdering ? (
        <p className="pos-qr-note is-warning">
          Online ordering is switched off for your restaurant, so scanned codes will only show the menu. Contact IROAS
          support to switch it on.
        </p>
      ) : null}

      {state.status === 'ready' && tables.length > 0 ? (
        <div className="pos-qr-grid">
          {tables.map((t) => (
            <div key={t.code} className="pos-qr-tile">
              <QrCodePreview value={urlFor(t)} size={120} alt={`QR code for ${t.name}`} />
              <strong>{t.name}</strong>
              <small>
                {[t.room, t.seats ? `${t.seats} seats` : ''].filter(Boolean).join(' · ')}
                {t.status === 'occupied' ? ' · occupied' : ''}
              </small>
              <div className="pos-qr-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => download(t)}>
                  Download
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(t)}>
                  Copy link
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default PosTableQrPanel
