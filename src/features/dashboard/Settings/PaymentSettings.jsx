import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { ROUTES } from '@/shared/constants/routes'
import '@/features/dashboard/Settings/EmailSettings.css'
import '@/features/dashboard/Settings/PaymentSettings.css'

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
    useSandbox: true,
  })

  const applyMeta = (settings) => {
    setMeta({
      configured: Boolean(settings.configured),
      privateKeySet: Boolean(settings.privateKeySet),
      privateKeyMasked: settings.privateKeyMasked || '',
      gatewayPublicKeySet: Boolean(settings.gatewayPublicKeySet),
      gatewayPublicKeyMasked: settings.gatewayPublicKeyMasked || '',
      useSandbox: settings.useSandbox !== false,
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
      pageClassName="email-settings-page payment-settings-page"
      activeNav="platform-settings-payment"
      variant="admin"
    >
      <div className="es-page">
      <div className="es-page-head">
        <div className="es-page-head-main">
          <Link className="es-back" to={ROUTES.PLATFORM_SETTINGS}>
            ← Platform settings
          </Link>
          <p className="eyebrow">Platform</p>
          <h1>Payment settings</h1>
          <p className="page-desc">
            Connect AddPay for launch checkout. Owners pay on AddPay’s hosted page — card and bank
            details never touch IROAS.
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

      {loading ? (
        <p className="es-muted">Loading payment settings…</p>
      ) : (
        <form id="payment-settings-form" className="ps-layout" onSubmit={save}>
          <section className="ps-hero">
            <div>
              <p className="ps-hero-kicker">Launch payments</p>
              <h2>AddPay gateway</h2>
              <p>
                Credentials from your PayCloud merchant dashboard. Sandbox for testing; turn it off
                when you are ready for live charges.
              </p>
            </div>
            <div className="ps-hero-meta">
              <div>
                <span>Mode</span>
                <strong>{form.useSandbox ? 'Sandbox (UAT)' : 'Live production'}</strong>
              </div>
              <div>
                <span>Webhook</span>
                <strong>/api/public/payments/addpay/webhook</strong>
              </div>
            </div>
          </section>

          <div className="ps-grid">
            <section className="es-panel">
              <header className="es-panel-head">
                <div>
                  <h2>Merchant credentials</h2>
                  <p>App ID, merchant, and store identifiers.</p>
                </div>
              </header>
              <div className="es-panel-body">
                <div className="es-field-row">
                  <label className="es-field">
                    <span>App ID</span>
                    <input
                      required
                      placeholder="Your AddPay App ID"
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

                <label className={`ps-env-toggle${form.useSandbox ? ' is-sandbox' : ' is-live'}`}>
                  <span className="ps-env-copy">
                    <strong>{form.useSandbox ? 'Sandbox mode' : 'Live mode'}</strong>
                    <small>
                      {form.useSandbox
                        ? 'Uses open-uat.paycloud.africa — safe for test payments.'
                        : 'Uses api.paycloud.africa — real charges will be collected.'}
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.useSandbox}
                    onChange={(e) => setForm((f) => ({ ...f, useSandbox: e.target.checked }))}
                  />
                </label>
              </div>
            </section>

            <section className="es-panel">
              <header className="es-panel-head">
                <div>
                  <h2>Security keys</h2>
                  <p>RSA keys for signing checkouts and verifying webhooks.</p>
                </div>
              </header>
              <div className="es-panel-body">
                <label className="es-field">
                  <span>
                    Private key
                    {meta.privateKeySet ? (
                      <em className="es-current">Saved · {meta.privateKeyMasked}</em>
                    ) : (
                      <em className="es-current">Required</em>
                    )}
                  </span>
                  <textarea
                    autoComplete="off"
                    rows={5}
                    placeholder={
                      meta.privateKeySet
                        ? 'Leave blank to keep the current private key'
                        : '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
                    }
                    value={form.privateKey}
                    onChange={(e) => setForm((f) => ({ ...f, privateKey: e.target.value }))}
                  />
                </label>

                <label className="es-field">
                  <span>
                    Gateway public key
                    {meta.gatewayPublicKeySet ? (
                      <em className="es-current">Saved · {meta.gatewayPublicKeyMasked}</em>
                    ) : (
                      <em className="es-current">Required</em>
                    )}
                  </span>
                  <textarea
                    autoComplete="off"
                    rows={5}
                    placeholder={
                      meta.gatewayPublicKeySet
                        ? 'Leave blank to keep the current gateway public key'
                        : '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'
                    }
                    value={form.gatewayPublicKey}
                    onChange={(e) => setForm((f) => ({ ...f, gatewayPublicKey: e.target.value }))}
                  />
                </label>
              </div>
            </section>
          </div>

          <section className="ps-footnote">
            <div>
              <strong>Verify with a real checkout</strong>
              <p>
                Saving credentials does not validate them. Run one onboarding payment after save to
                confirm signing and webhooks. Keys accept PEM with or without BEGIN/END lines.
              </p>
            </div>
            <ul>
              <li>Return URL → /onboarding/payment?paid=return</li>
              <li>Notify URL → public AddPay webhook</li>
              <li>Amount comes from Plans (ZAR)</li>
            </ul>
          </section>
        </form>
      )}
      </div>
    </DashboardLayout>
  )
}

export default PaymentSettings
