import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import './EmailSettings.css'

const FEATURES = [
  {
    key: 'welcomeMail',
    title: 'Welcome mail',
    desc: 'Sent to the owner after launch payment — User ID, professional email, and links.',
  },
  {
    key: 'adminVerifyMail',
    title: 'Admin verify / approve notices',
    desc: 'Informs admins when a business needs review, and confirms when you approve.',
  },
  {
    key: 'approvalDetailsMail',
    title: 'Full details to user after approval',
    desc: 'After approve: login link, professional email, website / card / menu links, and QR images.',
  },
]

function providerLabel(meta) {
  if (!meta.configured) return 'Not configured'
  if (meta.provider === 'zeptomail') return 'ZeptoMail'
  if (meta.provider === 'smtp') return 'SMTP (Gmail)'
  if (meta.provider === 'ethereal') return 'Dev catcher (Ethereal)'
  return 'Configured'
}

function EmailSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [form, setForm] = useState({
    apiToken: '',
    fromEmail: '',
    fromName: 'IROAS',
    features: {
      welcomeMail: true,
      adminVerifyMail: true,
      approvalDetailsMail: true,
    },
  })
  const [meta, setMeta] = useState({
    configured: false,
    tokenSet: false,
    apiTokenMasked: '',
    provider: 'none',
    smtpConfigured: false,
    devCatcher: false,
  })

  const applyMeta = (settings) => {
    setMeta({
      configured: Boolean(settings.configured),
      tokenSet: Boolean(settings.tokenSet),
      apiTokenMasked: settings.apiTokenMasked || '',
      provider: settings.provider || 'none',
      smtpConfigured: Boolean(settings.smtpConfigured),
      devCatcher: Boolean(settings.devCatcher),
    })
  }

  const load = async () => {
    setLoading(true)
    try {
      const { settings } = await api.adminEmailSettings()
      setForm({
        apiToken: '',
        fromEmail: settings.fromEmail || '',
        fromName: settings.fromName || 'IROAS',
        features: {
          welcomeMail: settings.features?.welcomeMail !== false,
          adminVerifyMail: settings.features?.adminVerifyMail !== false,
          approvalDetailsMail: settings.features?.approvalDetailsMail !== false,
        },
      })
      applyMeta(settings)
    } catch (err) {
      toast.error(err.message || 'Unable to load email settings.')
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
      const { settings } = await api.adminSaveEmailSettings({
        apiToken: form.apiToken,
        fromEmail: form.fromEmail,
        fromName: form.fromName,
        features: form.features,
      })
      setForm((prev) => ({ ...prev, apiToken: '' }))
      applyMeta(settings)
      toast.success('Email settings saved.')
    } catch (err) {
      toast.error(err.message || 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      const result = await api.adminTestEmail()
      if (result.previewUrl) {
        toast.success(`Test sent (dev preview). Check API log or open the Ethereal link.`)
        window.open(result.previewUrl, '_blank', 'noopener,noreferrer')
      } else {
        toast.success(`Test email sent via ${result.provider || 'email'} to ${result.to}`)
      }
    } catch (err) {
      toast.error(err.message || 'Test email failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <DashboardLayout pageClassName="email-settings-page" activeNav="platform-admin" variant="admin">
      <div className="es-page-head">
        <div className="es-page-head-main">
          <Link className="es-back" to={ROUTES.PLATFORM_ADMIN}>
            ← Platform Admin
          </Link>
          <p className="eyebrow">Platform</p>
          <h1>Email settings</h1>
          <p className="page-desc">
            Welcome, admin review, and post-approval emails. Prefer ZeptoMail (HTTPS); Gmail SMTP is
            the fallback. In local development, Ethereal captures mail when neither is set.
          </p>
        </div>
        <div className="es-page-head-actions">
          <span className={`es-status${meta.configured ? ' is-ok' : ''}`}>
            <i />
            {loading ? 'Loading…' : providerLabel(meta)}
          </span>
          <button
            type="button"
            className="es-btn ghost"
            disabled={testing || loading || !meta.configured}
            onClick={sendTest}
          >
            {testing ? 'Sending…' : 'Send test email'}
          </button>
          <button
            type="submit"
            form="email-settings-form"
            className="es-btn primary"
            disabled={saving || loading}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="es-muted">Loading email settings…</p>
      ) : (
        <form id="email-settings-form" className="es-layout" onSubmit={save}>
          <section className="es-panel">
            <header className="es-panel-head">
              <div>
                <h2>Delivery</h2>
                <p>ZeptoMail token (optional), sender identity, and current transport status.</p>
              </div>
            </header>

            <div className="es-panel-body">
              <label className="es-field">
                <span>
                  ZeptoMail API token
                  {meta.tokenSet ? (
                    <em className="es-current">Current: {meta.apiTokenMasked}</em>
                  ) : null}
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={
                    meta.tokenSet ? 'Leave blank to keep the current token' : 'Zoho-enczapikey …'
                  }
                  value={form.apiToken}
                  onChange={(e) => setForm((f) => ({ ...f, apiToken: e.target.value }))}
                />
              </label>

              <div className="es-field-row">
                <label className="es-field">
                  <span>From email</span>
                  <input
                    type="email"
                    required
                    placeholder="noreply@yourdomain.com"
                    value={form.fromEmail}
                    onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
                  />
                </label>
                <label className="es-field">
                  <span>From name</span>
                  <input
                    required
                    placeholder="IROAS"
                    value={form.fromName}
                    onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
                  />
                </label>
              </div>

              <div className="es-note">
                <strong>Active transport: {providerLabel(meta)}</strong>
                <p>
                  Order: ZeptoMail → Gmail SMTP (`SMTP_USER` / App Password in `server/.env`) →
                  Ethereal preview in development. SMTP env:{' '}
                  {meta.smtpConfigured ? 'credentials present' : 'not set'}.
                  {meta.devCatcher
                    ? ' Dev catcher is on — open the preview link after Send test.'
                    : ''}
                </p>
              </div>
            </div>
          </section>

          <section className="es-panel">
            <header className="es-panel-head">
              <div>
                <h2>Automated messages</h2>
                <p>Choose which platform emails go out during onboarding and approval.</p>
              </div>
            </header>

            <div className="es-panel-body es-features">
              {FEATURES.map((feat) => (
                <label key={feat.key} className="es-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(form.features[feat.key])}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        features: { ...f.features, [feat.key]: e.target.checked },
                      }))
                    }
                  />
                  <span>
                    <strong>{feat.title}</strong>
                    <small>{feat.desc}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </form>
      )}
    </DashboardLayout>
  )
}

export default EmailSettings
