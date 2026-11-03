import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

function parseAuditTime(iso) {
  const raw = String(iso || '').trim()
  if (!raw) return null
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)
  const normalized = hasZone ? raw : `${raw.replace(' ', 'T')}Z`
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatWhen(iso) {
  const d = parseAuditTime(iso)
  if (!d) return iso ? String(iso) : ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PlatformAudit() {
  const toast = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .adminAudit(150)
      .then(({ entries: rows }) => setEntries(rows || []))
      .catch((err) => {
        setEntries([])
        toast.error(err.message || 'Unable to load audit log.')
      })
      .finally(() => setLoading(false))
  }, [toast])

  return (
    <DashboardLayout
      pageClassName="platform-admin-page platform-audit-page"
      activeNav="platform-audit"
      variant="admin"
      adminSubtitle="Audit log"
    >
      <div className="page-header">
        <div>
          <div className="page-label">SYSTEM</div>
          <h1>Audit log</h1>
          <p>Persisted operator actions — approvals, settings, plans, and staff changes.</p>
        </div>
      </div>

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>Entries</h2>
            <span>{loading ? 'Loading…' : `${entries.length} shown`}</span>
          </div>
        </div>
        <div className="table-wrapper audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>WHEN</th>
                <th>ACTION</th>
                <th>ACTOR</th>
                <th>DETAIL</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id}>
                  <td data-label="When">{formatWhen(row.createdAt)}</td>
                  <td data-label="Action">
                    <strong>{row.action}</strong>
                    <small>
                      {[row.entityType, row.entityId].filter(Boolean).join(' · ') || '—'}
                    </small>
                  </td>
                  <td data-label="Actor">
                    <strong>{row.actorName || '—'}</strong>
                    <small>{row.actorEmail}</small>
                  </td>
                  <td data-label="Detail">{row.detail || '—'}</td>
                </tr>
              ))}
              {!loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 24 }}>
                    No audit entries yet. Actions will appear here as operators work.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default PlatformAudit
