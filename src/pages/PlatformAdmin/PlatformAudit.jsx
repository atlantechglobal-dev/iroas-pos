import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { PlatformSubnav } from './PlatformSubnav.jsx'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, {
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
      pageClassName="platform-admin-page"
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

      <PlatformSubnav active="platform-audit" />

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>Entries</h2>
            <span>{loading ? 'Loading…' : `${entries.length} shown`}</span>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
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
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>
                    <strong>{row.action}</strong>
                    <small>
                      {[row.entityType, row.entityId].filter(Boolean).join(' · ') || '—'}
                    </small>
                  </td>
                  <td>
                    <strong>{row.actorName || '—'}</strong>
                    <small>{row.actorEmail}</small>
                  </td>
                  <td>{row.detail || '—'}</td>
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
