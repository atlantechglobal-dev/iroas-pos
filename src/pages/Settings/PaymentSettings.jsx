import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { ROUTES } from '../../constants/routes.js'
import { PlatformSubnav } from '../PlatformAdmin/PlatformSubnav.jsx'
import './EmailSettings.css'
import '../PlatformAdmin/PlatformAdminExtra.css'

function PaymentSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    appId: '',
    merchantNo: '',
    storeNo: '',
    privateKey: '',
    gatewayPublicKey: '',
    useSandbox: true,
  })
  const [meta, setMeta] = useState({
    configured: false,
    privateKeySet: false,
    privateKeyMasked: '',
    gatewayPublicKeySet: false,
    gatewayPublicKeyMasked: '',
  })

  const applyMeta = (settings) => {
    setMeta({
      configured: Boolean(settings.configured),
      privateKeySet: Boolean(settings.privateKeySet),
      privateKeyMasked: settings.privateKeyMasked || '',
      gatewayPublicKeySet: Boolean(settings.gatewayPublicKeySet),
      gatewayPublicKeyMasked: settings.gatewayPublicKeyMasked || '',
    })
  }

  const load = async () => {
    setLoading(true)
    try {
      const { settings } = await api.adminPaymentSettings()
      setForm({
        appId: settings.appId || '',
        merchantNo: settings.merchantNo || '',
        storeNo: settings.storeNo || '',
        privateKey: '',
        gatewayPublicKey: '',
        useSandbox: settings.useSandbox !== false,
      })
      applyMeta(settings)
    } catch (err) {
      toast.error(err.message || 'Unable to load payment settings.')
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
      const { settings } = await api.adminSavePaymentSettings({
        appId: form.appId,
        merchantNo: form.merchantNo,
        storeNo: form.storeNo,
        privateKey: form.privateKey,
        gatewayPublicKey: form.gatewayPublicKey,
        useSandbox: form.useSandbox,
      })
      setForm((prev) => ({ ...prev, privateKey: '', gatewayPublicKey: '' }))
      applyMeta(settings)
      toast.success('Payment settings saved.')
    } catch (err) {
      toast.error(err.message || 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout
      pageClassName="email-settings-page"
      activeNav="platform-settings-payment"
      variant="admin"
    >
      <div className="es-page-head">
        <div className="es-page-head-main">
          <Link className="es-back" to={ROUTES.PLATFORM_SETTINGS}>
            ← Platform settings
          </Link>
          <p className="eyebrow">Platform</p>
          <h1>Payment settings</h1>
          <p className="page-desc">
            AddPay (PayCloud) credentials for the onboarding launch payment. Owners are
            redirected to AddPay's own hosted checkout — card and UPI details are never
            collected on IROAS.
          </p>
        </div>
        <div className="es-page-head-actions">
          <span className={`es-status${meta.configured ? ' is-ok' : ''}`}>
            <i />
            {loading ? 'Loading…' : meta.configured ? 'Configured' : 'Not configured'}
          </span>
          <button
            type="submit"
            form="payment-settings-form"
            className="es-btn primary"
            disabled={saving || loading}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      <PlatformSubnav active="platform-settings-payment" />

      {loading ? (
        <p className="es-muted">Loading payment settings…</p>
      ) : (
        <form id="payment-settings-form" className="es-layout is-single" onSubmit={save}>
          <section className="es-panel">
            <header className="es-panel-head">
              <div>
                <h2>AddPay credentials</h2>
                <p>From your AddPay / PayCloud merchant dashboard.</p>
              </div>
            </header>

            <div className="es-panel-body">
              <div className="es-field-row">
                <label className="es-field">
                  <span>App ID</span>
                  <input
                    required
                    placeholder="App ID"
                    value={form.appId}
                    onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
                  />
                </label>
                <label className="es-field">
                  <span>Merchant No</span>
                  <input
                    required
                    placeholder="Merchant number"
                    value={form.merchantNo}
                    onChange={(e) => setForm((f) => ({ ...f, merchantNo: e.target.value }))}
                  />
                </label>
              </div>

              <label className="es-field">
                <span>Store No</span>
                <input
                  required
                  placeholder="Store number"
                  value={form.storeNo}
                  onChange={(e) => setForm((f) => ({ ...f, storeNo: e.target.value }))}
                />
              </label>

              <label className="es-field">
                <span>
                  Private key (yours — signs outgoing requests)
                  {meta.privateKeySet ? (
                    <em className="es-current">Current: {meta.privateKeyMasked}</em>
                  ) : null}
                </span>
                <textarea
                  autoComplete="off"
                  placeholder={
                    meta.privateKeySet
                      ? 'Leave blank to keep the current key'
                      : '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
                  }
                  value={form.privateKey}
                  onChange={(e) => setForm((f) => ({ ...f, privateKey: e.target.value }))}
                />
              </label>

              <label className="es-field">
                <span>
                  Gateway public key (AddPay's — verifies incoming webhooks)
                  {meta.gatewayPublicKeySet ? (
                    <em className="es-current">Current: {meta.gatewayPublicKeyMasked}</em>
                  ) : null}
                </span>
                <textarea
                  autoComplete="off"
                  placeholder={
                    meta.gatewayPublicKeySet
                      ? 'Leave blank to keep the current key'
                      : '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'
                  }
                  value={form.gatewayPublicKey}
                  onChange={(e) => setForm((f) => ({ ...f, gatewayPublicKey: e.target.value }))}
                />
              </label>

              <label className="es-inline-toggle">
                <input
                  type="checkbox"
                  checked={form.useSandbox}
                  onChange={(e) => setForm((f) => ({ ...f, useSandbox: e.target.checked }))}
                />
                Use AddPay sandbox (UAT) — turn off to go live with real charges
              </label>

              <div className="es-note">
                <strong>How this is used</strong>
                <p>
                  Pasting a key here doesn't confirm it's correct — you can only verify it by
                  running a real onboarding payment through the flow once saved. Keys can be
                  pasted with or without the BEGIN/END lines; either works.
                </p>
              </div>
            </div>
          </section>
        </form>
      )}
    </DashboardLayout>
  )
}

export default PaymentSettings
