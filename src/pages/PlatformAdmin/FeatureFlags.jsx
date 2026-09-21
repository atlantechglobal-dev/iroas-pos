import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { PlatformSubnav } from './PlatformSubnav.jsx'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

function FeatureFlags() {
  const toast = useToast()
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .adminFeatureFlags()
      .then(({ flags: rows }) => setFlags(rows || []))
      .catch((err) => toast.error(err.message || 'Unable to load flags.'))
      .finally(() => setLoading(false))
  }, [toast])

  const toggle = (key) => {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)),
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const { flags: rows } = await api.adminSaveFeatureFlags(flags)
      setFlags(rows || flags)
      toast.success('Feature flags saved')
    } catch (err) {
      toast.error(err.message || 'Unable to save flags.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-settings-flags"
      variant="admin"
      adminSubtitle="Feature flags"
    >
      <div className="page-header">
        <div>
          <div className="page-label">SETTINGS</div>
          <h1>Feature flags</h1>
          <p>Toggle gradual rollout features across the platform.</p>
        </div>
        <button className="new-tenant" type="button" disabled={saving || loading} onClick={save}>
          {saving ? 'Saving…' : 'Save flags'}
        </button>
      </div>

      <PlatformSubnav active="platform-settings-flags" />

      <section className="feature-card">
        <div className="feature-header">
          <h2>Flags</h2>
          <span>{loading ? 'Loading…' : `${flags.length} configured`}</span>
        </div>
        {flags.map((flag) => (
          <div className="feature-row" key={flag.key}>
            <div className="flag-icon">⚑</div>
            <div className="feature-info">
              <strong>{flag.key}</strong>
              <small>{flag.description}</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(flag.enabled)}
                onChange={() => toggle(flag.key)}
              />
              <span></span>
            </label>
          </div>
        ))}
        {!loading && flags.length === 0 ? (
          <p className="pa-empty" style={{ padding: 20 }}>
            No flags seeded yet.
          </p>
        ) : null}
      </section>
    </DashboardLayout>
  )
}

export default FeatureFlags
