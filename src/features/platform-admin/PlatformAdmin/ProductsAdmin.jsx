import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

const TYPE_FILTERS = [
  { id: '', label: 'All types' },
  { id: 'website', label: 'Website' },
  { id: 'digital_business_card', label: 'Business card' },
  { id: 'mobile_app', label: 'Mobile app' },
]

const STATUS_OPTIONS = {
  website: ['requested', 'under_review', 'in_development', 'completed'],
  digital_business_card: ['requested', 'under_review', 'in_development', 'completed'],
  mobile_app: [
    'requested',
    'requirements_submitted',
    'under_review',
    'in_development',
    'testing',
    'ready_for_review',
    'published',
    'completed',
  ],
}

function ProductsAdmin() {
  const toast = useToast()
  const [type, setType] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    setLoading(true)
    api
      .adminProducts({ type })
      .then(({ products }) => setRows(products || []))
      .catch((err) => {
        setRows([])
        toast.error(err.message || 'Unable to load products.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [type])

  const updateStatus = async (row, status) => {
    setBusyId(row.id)
    try {
      await api.adminUpdateProduct(row.id, { status })
      toast.success(`Updated to ${status.replace(/_/g, ' ')}`)
      load()
    } catch (err) {
      toast.error(err.message || 'Unable to update product.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-products"
      variant="admin"
      adminSubtitle="Product requests"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Products</h1>
          <p>Moderate Website, Digital Business Card, and Mobile App requests.</p>
        </div>
      </div>

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>Requests</h2>
            <span>{loading ? 'Loading…' : `${rows.length} shown`}</span>
          </div>
          <div className="tenant-filters">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id || 'all'}
                type="button"
                className={`tenant-filter ${type === f.id ? 'is-active' : ''}`}
                onClick={() => setType(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>BUSINESS</th>
                <th>OWNER</th>
                <th>STATUS</th>
                <th>UPDATE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{String(row.productType || row.type || '').replace(/_/g, ' ')}</strong>
                    <small>{row.referenceId}</small>
                  </td>
                  <td>{row.businessName || '—'}</td>
                  <td>
                    <strong>{row.ownerName || '—'}</strong>
                    <small>{row.ownerEmail}</small>
                  </td>
                  <td>
                    <span className="status trial-status">
                      {String(row.status || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <select
                      disabled={busyId === row.id}
                      value={row.status || ''}
                      onChange={(e) => updateStatus(row, e.target.value)}
                      style={{ height: 36, borderRadius: 999, padding: '0 10px', border: '1px solid var(--border)' }}
                    >
                      {(STATUS_OPTIONS[row.productType] || STATUS_OPTIONS.website).map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                    No product requests.
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

export default ProductsAdmin
