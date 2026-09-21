import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { PlatformSubnav } from './PlatformSubnav.jsx'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'under_review', label: 'Under review' },
  { id: 'needs_info', label: 'Needs info' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

const NEXT_STATUSES = ['under_review', 'needs_info', 'approved', 'rejected', 'completed']

function IdentityReview() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')

  const load = () => {
    setLoading(true)
    api
      .adminIdentities({ search: debounced, status })
      .then(({ identities }) => setRows(identities || []))
      .catch((err) => {
        setRows([])
        toast.error(err.message || 'Unable to load identities.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [debounced, status])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    api
      .adminIdentity(selectedId)
      .then(setDetail)
      .catch((err) => toast.error(err.message || 'Unable to load identity.'))
  }, [selectedId])

  const setStatusFor = async (next) => {
    if (!selectedId) return
    setBusy(next)
    try {
      await api.adminIdentityStatus(selectedId, { status: next, note: note.trim() || undefined })
      toast.success(`Status → ${next.replace(/_/g, ' ')}`)
      setNote('')
      load()
      const fresh = await api.adminIdentity(selectedId)
      setDetail(fresh)
    } catch (err) {
      toast.error(err.message || 'Unable to update status.')
    } finally {
      setBusy('')
    }
  }

  const addNote = async () => {
    if (!selectedId || !note.trim()) return
    setBusy('note')
    try {
      await api.adminIdentityNote(selectedId, note.trim())
      toast.success('Note saved')
      setNote('')
      const fresh = await api.adminIdentity(selectedId)
      setDetail(fresh)
    } catch (err) {
      toast.error(err.message || 'Unable to save note.')
    } finally {
      setBusy('')
    }
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-identities"
      variant="admin"
      adminSubtitle="Identity review"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Identity review</h1>
          <p>Moderate Digital Identity submissions across all owners.</p>
        </div>
      </div>

      <PlatformSubnav active="platform-identities" />

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>Queue</h2>
            <span>{loading ? 'Loading…' : `${rows.length} shown`}</span>
          </div>
          <div className="tenant-toolbar">
            <div className="tenant-filters">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id || 'all'}
                  type="button"
                  className={`tenant-filter ${status === f.id ? 'is-active' : ''}`}
                  onClick={() => setStatus(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>REFERENCE</th>
                <th>BUSINESS</th>
                <th>OWNER</th>
                <th>STATUS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="tenant-row" onClick={() => setSelectedId(row.id)}>
                  <td>
                    <strong>{row.referenceId || row.id}</strong>
                  </td>
                  <td>{row.businessName || '—'}</td>
                  <td>
                    <strong>{row.ownerName || '—'}</strong>
                    <small>{row.ownerEmail}</small>
                  </td>
                  <td>
                    <span className="status trial-status">{String(row.status || '').replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <button type="button" className="impersonate" onClick={() => setSelectedId(row.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                    No identities match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detail?.identity ? (
        <section className="tenants-card" style={{ padding: 20 }}>
          <div className="card-header" style={{ border: 'none', padding: 0, marginBottom: 12 }}>
            <div>
              <h2>{detail.identity.businessName || 'Identity'}</h2>
              <span>
                {detail.identity.referenceId} · {detail.identity.status}
              </span>
            </div>
            <button type="button" className="impersonate" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
          <textarea
            rows={3}
            placeholder="Note for owner / status change…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: '100%', marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}
          />
          <div className="tenant-actions">
            <button type="button" className="impersonate" disabled={busy === 'note'} onClick={addNote}>
              Save note
            </button>
            {NEXT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className="impersonate"
                disabled={Boolean(busy)}
                onClick={() => setStatusFor(s)}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </DashboardLayout>
  )
}

export default IdentityReview
