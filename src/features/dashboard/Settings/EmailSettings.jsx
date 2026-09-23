import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/dashboard/Settings/EmailSettings.css'

const MESSAGE_ITEMS = [
  {
    featureKey: 'signupThankYouMail',
    templateKey: 'signupThankYouMail',
    title: 'Signup thank you (under review)',
    desc: 'Sent to the owner right after Create Account — thank you, account is under review.',
  },
  {
    featureKey: 'signupAdminNotifyMail',
    templateKey: 'signupAdminNotifyMail',
    title: 'Admin: new signup waiting',
    desc: 'Email to admins when a new Create Account signup needs Account approve.',
  },
  {
    featureKey: 'accountApprovedMail',
    templateKey: 'accountApprovedMail',
    title: 'Account approved — start onboarding',
    desc: 'Welcome email after Account approve — sign in and complete onboarding.',
  },
  {
    featureKey: 'welcomeMail',
    templateKey: 'welcomeMail',
    title: 'Welcome mail (after payment)',
    desc: 'Sent to the owner after launch payment — User ID, professional email, and links.',
  },
  {
    featureKey: 'adminVerifyMail',
    templateKey: 'adminVerifyMail',
    title: 'Admin review notice (after payment)',
    desc: 'Informs admins when a business completes payment.',
  },
  {
    featureKey: 'adminVerifyMail',
    templateKey: 'adminApprovedMail',
    title: 'Admin approved notice',
    desc: 'Confirms to admins when a business is approved. Shares the review notice on/off switch.',
    sharedToggle: true,
  },
  {
    featureKey: 'approvalDetailsMail',
    templateKey: 'approvalDetailsMail',
    title: 'Full details after go-live',
    desc: 'Optional legacy template: login link, website / card / menu links, and QR images.',
  },
]

const EMPTY_TEMPLATES = {
  signupThankYouMail: { subject: '', body: '' },
  signupAdminNotifyMail: { subject: '', body: '' },
  accountApprovedMail: { subject: '', body: '' },
  welcomeMail: { subject: '', body: '' },
  adminVerifyMail: { subject: '', body: '' },
  adminApprovedMail: { subject: '', body: '' },
  approvalDetailsMail: { subject: '', body: '' },
}

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
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState({ subject: '', body: '' })
  const [placeholders, setPlaceholders] = useState([])
  const [form, setForm] = useState({
    apiToken: '',
    fromEmail: '',
    fromName: 'IROAS',
    features: {
      signupThankYouMail: true,
      signupAdminNotifyMail: true,
      accountApprovedMail: true,
      welcomeMail: true,
      adminVerifyMail: true,
      approvalDetailsMail: true,
    },
    templates: { ...EMPTY_TEMPLATES },
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

  const applySettings = (settings) => {
    setForm({
      apiToken: '',
      fromEmail: settings.fromEmail || '',
      fromName: settings.fromName || 'IROAS',
      features: {
        signupThankYouMail: settings.features?.signupThankYouMail !== false,
        signupAdminNotifyMail: settings.features?.signupAdminNotifyMail !== false,
        accountApprovedMail: settings.features?.accountApprovedMail !== false,
        welcomeMail: settings.features?.welcomeMail !== false,
        adminVerifyMail: settings.features?.adminVerifyMail !== false,
        approvalDetailsMail: settings.features?.approvalDetailsMail !== false,
      },
      templates: {
        signupThankYouMail: {
          subject: settings.templates?.signupThankYouMail?.subject || '',
          body: settings.templates?.signupThankYouMail?.body || '',
        },
        signupAdminNotifyMail: {
          subject: settings.templates?.signupAdminNotifyMail?.subject || '',
          body: settings.templates?.signupAdminNotifyMail?.body || '',
        },
        accountApprovedMail: {
          subject: settings.templates?.accountApprovedMail?.subject || '',
          body: settings.templates?.accountApprovedMail?.body || '',
        },
        welcomeMail: {
          subject: settings.templates?.welcomeMail?.subject || '',
          body: settings.templates?.welcomeMail?.body || '',
        },
        adminVerifyMail: {
          subject: settings.templates?.adminVerifyMail?.subject || '',
          body: settings.templates?.adminVerifyMail?.body || '',
        },
        adminApprovedMail: {
          subject: settings.templates?.adminApprovedMail?.subject || '',
          body: settings.templates?.adminApprovedMail?.body || '',
        },
        approvalDetailsMail: {
          subject: settings.templates?.approvalDetailsMail?.subject || '',
          body: settings.templates?.approvalDetailsMail?.body || '',
        },
      },
    })
    setPlaceholders(Array.isArray(settings.placeholders) ? settings.placeholders : [])
    applyMeta(settings)
  }

  const load = async () => {
    setLoading(true)
    try {
      const { settings } = await api.adminEmailSettings()
      applySettings(settings)
      setEditingKey(null)
    } catch (err) {
      toast.error(err.message || 'Unable to load email settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!editingKey) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setEditingKey(null)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [editingKey])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const templates = { ...form.templates }
      if (editingKey && draft.subject.trim() && draft.body.trim()) {
        templates[editingKey] = {
          subject: draft.subject.trim(),
          body: draft.body.trim(),
        }
      }
      const { settings } = await api.adminSaveEmailSettings({
        apiToken: form.apiToken,
        fromEmail: form.fromEmail,
        fromName: form.fromName,
        features: form.features,
        templates,
      })
      applySettings(settings)
      setEditingKey(null)
      toast.success('Email settings saved. Outgoing mail will use these templates.')
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
        toast.success('Test sent (dev preview). Check API log or open the Ethereal link.')
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

  const openEditor = (templateKey) => {
    const tpl = form.templates[templateKey] || { subject: '', body: '' }
    setDraft({ subject: tpl.subject || '', body: tpl.body || '' })
    setEditingKey(templateKey)
  }

  const closeEditor = () => {
    setEditingKey(null)
    setDraft({ subject: '', body: '' })
  }

  const applyDraftToForm = () => {
    if (!editingKey) return
    if (!String(draft.subject || '').trim() || !String(draft.body || '').trim()) {
      toast.error('Subject and body are required.')
      return
    }
    setForm((f) => ({
      ...f,
      templates: {
        ...f.templates,
        [editingKey]: {
          subject: draft.subject.trim(),
          body: draft.body.trim(),
        },
      },
    }))
    setEditingKey(null)
    toast.success('Template updated — click Save settings to apply to outgoing mail.')
  }

  const insertPlaceholder = (name) => {
    const token = `{{${name}}}`
    setDraft((d) => ({ ...d, body: `${d.body || ''}${d.body?.endsWith('\n') || !d.body ? '' : '\n'}${token}` }))
  }

  const editingItem = MESSAGE_ITEMS.find((item) => item.templateKey === editingKey)

  return (
    <DashboardLayout
      pageClassName="email-settings-page"
      activeNav="platform-settings-email"
      variant="admin"
    >
      <div className="es-page">
      <div className="es-page-head">
        <div className="es-page-head-main">
          <Link className="es-back" to={ROUTES.PLATFORM_SETTINGS}>
            ← Platform settings
          </Link>
          <p className="eyebrow">Platform</p>
          <h1>Email settings</h1>
          <p className="page-desc">
            Signup thank-you, Account approve welcome, payment, and admin notices. Edit templates
            below. Prefer ZeptoMail (HTTPS); Gmail SMTP is the fallback. In local development,
            Ethereal captures mail when neither is set.
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
        <form id="email-settings-form" className="es-layout is-stack" onSubmit={save}>
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
                <p>
                  Turn emails on or off, then edit the template. Placeholders like{' '}
                  {'{{businessName}}'} fill in at send time. Save settings to apply.
                </p>
              </div>
            </header>

            <div className="es-panel-body es-features">
              {MESSAGE_ITEMS.map((item) => {
                const enabled = Boolean(form.features[item.featureKey])
                const tpl = form.templates[item.templateKey]
                const subjectPreview = tpl?.subject || 'No subject yet'
                return (
                  <div
                    key={item.templateKey}
                    className={`es-message${editingKey === item.templateKey ? ' is-editing' : ''}${
                      !enabled ? ' is-off' : ''
                    }`}
                  >
                    <div className="es-message-row">
                      <label className="es-toggle es-toggle-inline">
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={item.sharedToggle}
                          title={
                            item.sharedToggle
                              ? 'Controlled by Admin review notice'
                              : undefined
                          }
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              features: {
                                ...f.features,
                                [item.featureKey]: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.desc}</small>
                          <em className="es-subject-preview">{subjectPreview}</em>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="es-btn ghost es-btn-sm"
                        onClick={() => openEditor(item.templateKey)}
                      >
                        Edit template
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </form>
      )}
      </div>

      {editingKey && editingItem ? (
        <div className="es-drawer-overlay" role="presentation" onClick={closeEditor}>
          <aside
            className="es-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="es-drawer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="es-drawer-head">
              <div>
                <p className="es-drawer-eyebrow">Email template</p>
                <h2 id="es-drawer-title">{editingItem.title}</h2>
                <p className="es-drawer-desc">{editingItem.desc}</p>
              </div>
              <button
                type="button"
                className="es-drawer-close"
                onClick={closeEditor}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="es-drawer-body">
              <label className="es-field">
                <span>Subject</span>
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  placeholder="Email subject"
                  autoFocus
                />
              </label>

              <label className="es-field">
                <span>Body</span>
                <textarea
                  rows={12}
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  placeholder="Email body — use {{ownerName}}, {{businessName}}, etc."
                />
              </label>

              {placeholders.length ? (
                <div className="es-placeholders">
                  <span>Insert placeholder</span>
                  <div className="es-placeholder-list">
                    {placeholders.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="es-chip"
                        onClick={() => insertPlaceholder(name)}
                      >
                        {`{{${name}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="es-drawer-actions">
              <button type="button" className="es-btn ghost" onClick={closeEditor}>
                Cancel
              </button>
              <button type="button" className="es-btn primary" onClick={applyDraftToForm}>
                Apply template
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default EmailSettings
