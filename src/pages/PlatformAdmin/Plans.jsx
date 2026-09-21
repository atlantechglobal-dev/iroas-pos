import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { formatPlanPrice } from '../../constants/plans.js'
import { PlatformSubnav } from './PlatformSubnav.jsx'
import './PlatformAdmin.css'
import './PlatformAdminExtra.css'

function Plans() {
  const toast = useToast()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .adminPlans()
      .then(({ plans: rows }) => setPlans(rows || []))
      .catch((err) => {
        setPlans([])
        toast.error(err.message || 'Unable to load plans.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const startEdit = (plan) => {
    setEditing(plan.id)
    setForm({
      name: plan.name,
      tagline: plan.tagline || '',
      priceZar: plan.priceZar,
      billing: plan.billing || 'one-time launch',
      popular: Boolean(plan.popular),
      features: (plan.features || []).join('\n'),
      sortOrder: plan.sortOrder || 0,
    })
  }

  const save = async () => {
    if (!editing || !form) return
    setSaving(true)
    try {
      const { plans: rows } = await api.adminSavePlan(editing, {
        ...form,
        features: String(form.features || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      })
      setPlans(rows || [])
      setEditing(null)
      setForm(null)
      toast.success('Plan saved')
    } catch (err) {
      toast.error(err.message || 'Unable to save plan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page"
      activeNav="platform-plans"
      variant="admin"
      adminSubtitle="Subscription plans"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Plans</h1>
          <p>
            Launch packages available to restaurants. Amounts drive onboarding payment (ZAR).
          </p>
        </div>
      </div>

      <PlatformSubnav active="platform-plans" />

      {loading ? <p className="pa-empty">Loading plans…</p> : null}

      <div className="pa-plans-grid">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`pa-plan-card${plan.popular ? ' is-popular' : ''}`}
          >
            {plan.popular ? <span className="pa-plan-badge">Popular</span> : null}
            <h2>{plan.name}</h2>
            <p className="pa-plan-tag">{plan.tagline}</p>
            <div className="pa-plan-price">
              <strong>{formatPlanPrice(plan.priceZar)}</strong>
              <span>{plan.billing} · ZAR</span>
            </div>
            <ul className="pa-plan-features">
              {(plan.features || []).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button type="button" className="impersonate" onClick={() => startEdit(plan)}>
              Edit
            </button>
          </article>
        ))}
      </div>

      {form && editing ? (
        <section className="tenants-card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Edit · {editing}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{ display: 'block', width: '100%', height: 40, marginTop: 4 }}
              />
            </label>
            <label>
              Price (ZAR)
              <input
                type="number"
                value={form.priceZar}
                onChange={(e) => setForm((f) => ({ ...f, priceZar: Number(e.target.value) }))}
                style={{ display: 'block', width: '100%', height: 40, marginTop: 4 }}
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Tagline
              <input
                value={form.tagline}
                onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                style={{ display: 'block', width: '100%', height: 40, marginTop: 4 }}
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Features (one per line)
              <textarea
                rows={5}
                value={form.features}
                onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.popular}
                onChange={(e) => setForm((f) => ({ ...f, popular: e.target.checked }))}
              />
              Popular badge
            </label>
          </div>
          <div className="tenant-actions" style={{ marginTop: 14 }}>
            <button type="button" className="new-tenant" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            <button
              type="button"
              className="impersonate"
              onClick={() => {
                setEditing(null)
                setForm(null)
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </DashboardLayout>
  )
}

export default Plans
