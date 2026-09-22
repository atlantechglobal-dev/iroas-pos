import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import './EmailSettings.css'

function GoogleAuthSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    clientId: '',
    enabled: true,
  })
  const [meta, setMeta] = useState({ configured: false })

  const load = async () => {
    setLoading(true)
    try {
      const { settings } = await api.adminGoogleAuthSettings()
      setForm({
        clientId: settings.clientId || '',
        enabled: settings.enabled !== false,
      })
      setMeta({ configured: Boolean(settings.configured) })
    } catch (err) {
      toast.error(err.message || 'Unable to load Google sign-in settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const { settings } = await api.adminSaveGoogleAuthSettings({
        clientId: form.clientId.trim(),
        enabled: form.enabled,
      })
      setForm({
        clientId: settings.clientId || '',
        enabled: settings.enabled !== false,
      })
      setMeta({ configured: Boolean(settings.configured) })
      toast.success('Google sign-in settings saved.')
    } catch (err) {
      toast.error(err.message || 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout
      pageClassName="email-settings-page"
      activeNav="platform-settings-google"
      variant="admin"
    >
      <div className="es-page">
        <div className="es-page-head">
          <div className="es-page-head-main">
            <Link className="es-back" to={ROUTES.PLATFORM_SETTINGS}>
              ← Platform settings
            </Link>
            <p className="eyebrow">Platform</p>
            <h1>Google sign-in</h1>
            <p className="page-desc">
              Paste your Google OAuth Web Client ID so restaurant owners can sign in with Google on
              the login page. You can change this key anytime without redeploying.
            </p>
          </div>
          <div className="es-page-head-actions">
            <span className={`es-status${meta.configured ? ' is-ok' : ''}`}>
              <i />
              {loading ? 'Loading…' : meta.configured ? 'Enabled' : 'Not configured'}
            </span>
            <button
              type="submit"
              form="google-auth-settings-form"
              className="es-btn primary"
              disabled={saving || loading}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="es-muted">Loading Google sign-in settings…</p>
        ) : (
          <form
            id="google-auth-settings-form"
            className="es-layout is-stack"
            onSubmit={save}
          >
            <section className="es-panel">
              <header className="es-panel-head">
                <div>
                  <h2>OAuth client</h2>
                  <p>
                    From Google Cloud Console → APIs &amp; Services → Credentials → OAuth 2.0 Client
                    ID (Web application). Add your app origin (e.g. http://localhost:5173) under
                    Authorized JavaScript origins.
                  </p>
                </div>
              </header>

              <div className="es-panel-body">
                <label className="es-field">
                  <span>Google Client ID</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="123456789-abcdef.apps.googleusercontent.com"
                    value={form.clientId}
                    onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                  />
                </label>

                <label className="es-check">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                  <span>
                    <strong>Enable Google sign-in</strong>
                    <small>When off, the Login Google button stays disabled.</small>
                  </span>
                </label>

                <div className="es-note">
                  <strong>How it works</strong>
                  <p>
                    The login page loads Google Identity Services with this Client ID. Google returns
                    an ID token; the API verifies it and signs the user into IROAS (creates an owner
                    account on first use).
                  </p>
                </div>
              </div>
            </section>
          </form>
        )}
      </div>
    </DashboardLayout>
  )
}

export default GoogleAuthSettings
