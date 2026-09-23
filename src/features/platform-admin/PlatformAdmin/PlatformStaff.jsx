import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

function PlatformStaff() {
  const toast = useToast()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })

  const load = () => {
    setLoading(true)
    api
      .adminStaff()
      .then(({ staff: rows }) => setStaff(rows || []))
      .catch((err) => {
        setStaff([])
        toast.error(err.message || 'Unable to load staff.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.adminCreateStaff(form)
      toast.success('Staff account created')
      setForm({ name: '', email: '', password: '', phone: '' })
      load()
    } catch (err) {
      toast.error(err.message || 'Unable to create staff.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-staff"
      variant="admin"
      adminSubtitle="Platform staff"
    >
      <div className="page-header">
        <div>
          <div className="page-label">SYSTEM</div>
          <h1>Platform staff</h1>
          <p>Super admin accounts that can operate the IROAS console.</p>
        </div>
      </div>

      <section className="tenants-card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Invite admin</h2>
        <form
          onSubmit={create}
          className="pa-invite-form"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <input
            required
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{ height: 42, borderRadius: 12, border: '1px solid var(--border)', padding: '0 12px' }}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            style={{ height: 42, borderRadius: 12, border: '1px solid var(--border)', padding: '0 12px' }}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Temporary password (min 8)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            style={{ height: 42, borderRadius: 12, border: '1px solid var(--border)', padding: '0 12px' }}
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            style={{ height: 42, borderRadius: 12, border: '1px solid var(--border)', padding: '0 12px' }}
          />
          <button className="new-tenant" type="submit" disabled={saving} style={{ gridColumn: '1 / -1', width: 'fit-content' }}>
            {saving ? 'Creating…' : 'Create admin'}
          </button>
        </form>
      </section>

      <section className="tenants-card">
        <div className="card-header">
          <div>
            <h2>Admins</h2>
            <span>{loading ? 'Loading…' : `${staff.length} accounts`}</span>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>NAME</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>CREATED</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>{row.email}</td>
                  <td>{row.phone || '—'}</td>
                  <td>
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default PlatformStaff
