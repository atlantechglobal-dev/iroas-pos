import { useEffect, useRef, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import '@/features/dashboard/Settings/EmailSettings.css'

const MESSAGE_ITEMS = [
  {
    featureKey: 'bookingConfirmation',
    title: 'Booking confirmation',
    desc: 'Sent to the guest when a reservation is confirmed.',
  },
  {
    featureKey: 'orderConfirmation',
    title: 'Order confirmation',
    desc: 'Sent to the guest when their order is placed.',
  },
]

const EMPTY_TEMPLATES = {
  bookingConfirmation: { templateName: '', languageCode: 'en' },
  orderConfirmation: { templateName: '', languageCode: 'en' },
}

function WhatsAppSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testTemplate, setTestTemplate] = useState('')
  const [form, setForm] = useState({
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    features: { bookingConfirmation: false, orderConfirmation: false },
    templates: { ...EMPTY_TEMPLATES },
  })
  const [meta, setMeta] = useState({
    configured: false,
    accessTokenSet: false,
    accessTokenMasked: '',
  })
  const savedSnapshot = useRef('')

  const snapshot = (nextForm) =>
    JSON.stringify({
      phoneNumberId: String(nextForm.phoneNumberId || '').trim(),
      accessToken: String(nextForm.accessToken || '').trim(),
      businessAccountId: String(nextForm.businessAccountId || '').trim(),
      features: nextForm.features,
      templates: nextForm.templates,
    })

  const applySettings = (settings) => {
    const nextForm = {
      phoneNumberId: settings.phoneNumberId || '',
      accessToken: '',
      businessAccountId: settings.businessAccountId || '',
      features: {
        bookingConfirmation: Boolean(settings.features?.bookingConfirmation),
        orderConfirmation: Boolean(settings.features?.orderConfirmation),
      },
      templates: {
        bookingConfirmation: {
          templateName: settings.templates?.bookingConfirmation?.templateName || '',
          languageCode: settings.templates?.bookingConfirmation?.languageCode || 'en',
        },
        orderConfirmation: {
          templateName: settings.templates?.orderConfirmation?.templateName || '',
          languageCode: settings.templates?.orderConfirmation?.languageCode || 'en',
        },
      },
    }
    setForm(nextForm)
    setMeta({
      configured: Boolean(settings.configured),
      accessTokenSet: Boolean(settings.accessTokenSet),
      accessTokenMasked: settings.accessTokenMasked || '',
    })
    savedSnapshot.current = snapshot(nextForm)
  }

  const load = async () => {
    setLoading(true)
    try {
      const { settings } = await api.adminWhatsappSettings()
      applySettings(settings)
    } catch (err) {
      toast.error(err.message || 'Unable to load WhatsApp settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (event) => {
    event.preventDefault()
    if (snapshot(form) === savedSnapshot.current) {
      toast.info('No changes to save.')
      return
    }
    setSaving(true)
    try {
      const { settings } = await api.adminSaveWhatsappSettings(form)
      applySettings(settings)
      toast.success('WhatsApp settings saved.')
    } catch (err) {
      toast.error(err.message || 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    if (!testTo.trim() || !testTemplate.trim()) {
      toast.error('Enter a recipient phone number and an approved template name.')
      return
    }
    setTesting(true)
    try {
      await api.adminTestWhatsapp({ to: testTo.trim(), templateName: testTemplate.trim() })
      toast.success(`Test WhatsApp message sent to ${testTo.trim()}`)
    } catch (err) {
      toast.error(err.message || 'Test WhatsApp message failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <DashboardLayout
      pageClassName="email-settings-page"
      activeNav="platform-settings-whatsapp"
      variant="admin"
    >
      <div className="es-page">
        <div className="es-page-head">
          <div className="es-page-head-main">
            <p className="eyebrow">Platform</p>
            <h1>WhatsApp settings</h1>
            <p className="page-desc">
              Meta WhatsApp Cloud API credentials and which approved templates send booking and
              order confirmations. Templates must already be approved in Meta Business Manager —
              this page cannot edit their text, only pick the name and turn each message on or off.
            </p>
          </div>
          <div className="es-page-head-actions">
            <span className={`es-status${meta.configured ? ' is-ok' : ''}`}>
              <i />
              {loading ? 'Loading…' : meta.configured ? 'Configured' : 'Not configured'}
            </span>
            <button
              type="submit"
              form="whatsapp-settings-form"
              className="es-btn primary"
              disabled={saving || loading}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="es-muted">Loading WhatsApp settings…</p>
        ) : (
          <form id="whatsapp-settings-form" className="es-layout is-stack" onSubmit={save}>
            <section className="es-panel">
              <header className="es-panel-head">
                <div>
                  <h2>Meta Cloud API credentials</h2>
                  <p>From your Meta app's WhatsApp → API setup page.</p>
                </div>
              </header>

              <div className="es-panel-body">
                <label className="es-field">
                  <span>Phone number ID</span>
                  <input
                    required
                    placeholder="e.g. 109876543210123"
                    value={form.phoneNumberId}
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumberId: e.target.value }))}
                  />
                </label>

                <label className="es-field">
                  <span>
                    Access token
                    {meta.accessTokenSet ? <em className="es-current">Current: {meta.accessTokenMasked}</em> : null}
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={meta.accessTokenSet ? 'Leave blank to keep the current token' : 'EAAG…'}
                    value={form.accessToken}
                    onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                  />
                </label>

                <label className="es-field">
                  <span>Business account ID (optional)</span>
                  <input
                    placeholder="e.g. 123456789012345"
                    value={form.businessAccountId}
                    onChange={(e) => setForm((f) => ({ ...f, businessAccountId: e.target.value }))}
                  />
                </label>
              </div>
            </section>

            <section className="es-panel">
              <header className="es-panel-head">
                <div>
                  <h2>Automated messages</h2>
                  <p>Turn each message on, then enter the exact name of its approved Meta template.</p>
                </div>
              </header>

              <div className="es-panel-body es-features">
                {MESSAGE_ITEMS.map((item) => {
                  const enabled = Boolean(form.features[item.featureKey])
                  const tpl = form.templates[item.featureKey]
                  return (
                    <div key={item.featureKey} className={`es-message${!enabled ? ' is-off' : ''}`}>
                      <div className="es-message-row">
                        <label className="es-toggle es-toggle-inline">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                features: { ...f.features, [item.featureKey]: e.target.checked },
                              }))
                            }
                          />
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.desc}</small>
                          </span>
                        </label>
                      </div>
                      <div className="es-field-row">
                        <label className="es-field">
                          <span>Template name</span>
                          <input
                            placeholder="e.g. booking_confirmation"
                            value={tpl.templateName}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                templates: {
                                  ...f.templates,
                                  [item.featureKey]: { ...tpl, templateName: e.target.value },
                                },
                              }))
                            }
                          />
                        </label>
                        <label className="es-field">
                          <span>Language code</span>
                          <input
                            placeholder="en"
                            value={tpl.languageCode}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                templates: {
                                  ...f.templates,
                                  [item.featureKey]: { ...tpl, languageCode: e.target.value },
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="es-panel">
              <header className="es-panel-head">
                <div>
                  <h2>Send a test message</h2>
                  <p>Uses a saved, approved template name directly — not tied to the toggles above.</p>
                </div>
              </header>
              <div className="es-panel-body es-field-row">
                <label className="es-field">
                  <span>Recipient phone number</span>
                  <input
                    placeholder="27821234567"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                  />
                </label>
                <label className="es-field">
                  <span>Template name</span>
                  <input
                    placeholder="hello_world"
                    value={testTemplate}
                    onChange={(e) => setTestTemplate(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="es-btn ghost"
                  disabled={testing || !meta.configured}
                  onClick={sendTest}
                >
                  {testing ? 'Sending…' : 'Send test'}
                </button>
              </div>
            </section>
          </form>
        )}
      </div>
    </DashboardLayout>
  )
}

export default WhatsAppSettings
