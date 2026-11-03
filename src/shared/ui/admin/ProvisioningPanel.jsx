import { useEffect, useState } from 'react'
import { api } from '@/shared/lib/api'
import { useAuth } from '@/shared/hooks/useAuth'
import { useToast } from '@/shared/ui/feedback/ToastProvider'

const STATE_LABEL = {
  not_requested: 'Not requested',
  requested: 'Requested: waiting for the operator',
  linked: 'Linked and verified',
  disabled: 'Link disabled',
}

/** POS (URY) provisioning status for one tenant, shown in the tenant review drawer. */
export function ProvisioningPanel({ tenantId, tenantStatus }) {
  const toast = useToast()
  const { isSuperAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [siteName, setSiteName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .adminProvisioning(tenantId)
      .then((res) => {
        if (!cancelled) setData(res.provisioning)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load POS setup.')
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const request = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await api.adminRequestProvisioning(tenantId, { siteName })
      setData(res.provisioning)
      toast.success('POS site requested')
    } catch (err) {
      toast.error(err.message || 'Unable to request POS site.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      const res = await api.adminCancelProvisioning(tenantId)
      setData(res.provisioning)
      toast.success('Request cancelled')
    } catch (err) {
      toast.error(err.message || 'Unable to cancel.')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="tenant-review-note">{error}</p>
  if (!data) return <p className="tenant-review-note">Loading POS setup…</p>

  return (
    <div className="tenant-review-grid">
      <div className="tenant-review-field tenant-review-span">
        <span>Status</span>
        <strong>{STATE_LABEL[data.state] || data.state}</strong>
      </div>

      <ol className="tenant-review-span" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
        {data.steps.map((step) => (
          <li key={step.key} style={{ opacity: step.done ? 1 : 0.55 }}>
            {step.done ? '✓' : '○'} {step.label}
          </li>
        ))}
      </ol>

      {data.integration ? (
        <div className="tenant-review-field tenant-review-span">
          <span>Connected site</span>
          <strong>{data.integration.siteName || 'default site'}</strong>
          <small>
            {data.integration.uryRestaurant} · {data.integration.branch} · features:{' '}
            {data.integration.features.length ? data.integration.features.join(', ') : 'none yet'}
          </small>
        </div>
      ) : null}

      {data.state === 'not_requested' && isSuperAdmin ? (
        <form onSubmit={request} className="tenant-review-field tenant-review-span">
          <span>Request a POS site</span>
          {tenantStatus !== 'live' ? (
            <small>Approve the tenant first.</small>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="acme.pos.example.com"
                aria-label="Site name"
              />
              <button type="submit" className="btn" disabled={busy}>
                Request
              </button>
            </div>
          )}
        </form>
      ) : null}

      {data.state === 'requested' ? (
        <div className="tenant-review-field tenant-review-span">
          <span>Requested site</span>
          <strong>{data.request?.siteName}</strong>
          {isSuperAdmin ? (
            <button type="button" className="btn" disabled={busy} onClick={cancel}>
              Cancel request
            </button>
          ) : null}
        </div>
      ) : null}

      {data.state !== 'linked' ? (
        <div className="tenant-review-field tenant-review-span">
          <span>Operator steps (dry run, nothing is executed from here)</span>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{data.operatorPlan.join('\n')}</pre>
        </div>
      ) : null}
    </div>
  )
}
