import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { api } from '@/shared/lib/api'
import { formatPlanPrice } from '@/shared/constants/plans'
import { slugify } from '@/shared/utils/slugify'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

const EMPTY_FORM = {
  id: '',
  name: '',
  tagline: '',
  priceZar: 999,
  billing: 'one-time launch',
  popular: false,
  features: '',
  sortOrder: 0,
}

function Plans() {
  const toast = useToast()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null) // 'create' | 'edit' | null
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

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

  const closeForm = () => {
    setMode(null)
    setEditingId(null)
    setForm(null)
  }

  const startCreate = () => {
    const nextSort = plans.reduce((m, p) => Math.max(m, Number(p.sortOrder) || 0), 0) + 1
    setMode('create')
    setEditingId(null)
    setForm({ ...EMPTY_FORM, sortOrder: nextSort })
  }

  const startEdit = (plan) => {
    setMode('edit')
    setEditingId(plan.id)
    setForm({
      id: plan.id,
      name: plan.name,
      tagline: plan.tagline || '',
      priceZar: plan.priceZar,
      billing: plan.billing || 'one-time launch',
      popular: Boolean(plan.popular),
      features: (plan.features || []).join('\n'),
      sortOrder: plan.sortOrder || 0,
    })
  }

  const payloadFromForm = () => ({
    name: String(form.name || '').trim(),
    tagline: String(form.tagline || '').trim(),
    priceZar: Number(form.priceZar) || 0,
    billing: String(form.billing || 'one-time launch').trim(),
    popular: Boolean(form.popular),
    features: String(form.features || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    sortOrder: Number(form.sortOrder) || 0,
  })

  const save = async (event) => {
    event?.preventDefault?.()
    if (!form || !mode) return
    const name = String(form.name || '').trim()
    if (!name) {
      toast.error('Plan name is required.')
      return
    }
    if (!(Number(form.priceZar) >= 0)) {
      toast.error('Enter a valid price in ZAR.')
      return
    }

    setSaving(true)
    try {
      const body = payloadFromForm()
      let rows
      if (mode === 'create') {
        const id = slugify(form.id || name)
        if (!id) {
          toast.error('Plan id is required (letters and numbers).')
          setSaving(false)
          return
        }
        ;({ plans: rows } = await api.adminCreatePlan({ ...body, id }))
        toast.success('Plan created — amounts apply to onboarding checkout.')
      } else {
        ;({ plans: rows } = await api.adminSavePlan(editingId, body))
        toast.success('Plan saved — onboarding payment uses this amount.')
      }
      setPlans(rows || [])
      closeForm()
    } catch (err) {
      toast.error(err.message || 'Unable to save plan.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (plan) => {
    if (
      !window.confirm(
        `Delete “${plan.name}”? Restaurants already on this plan will block deletion.`,
      )
    ) {
      return
    }
    setDeletingId(plan.id)
    try {
      const { plans: rows } = await api.adminDeletePlan(plan.id)
      setPlans(rows || [])
      if (editingId === plan.id) closeForm()
      toast.success(`Deleted “${plan.name}”.`)
    } catch (err) {
      toast.error(err.message || 'Unable to delete plan.')
    } finally {
      setDeletingId(null)
    }
  }

  const previewId =
    mode === 'create' ? slugify(form?.id || form?.name || '') || 'plan-id' : editingId

  return (
    <DashboardLayout
      pageClassName="platform-admin-page plans-manage-page"
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
        <div className="platform-admin-actions">
          <button type="button" className="new-tenant" onClick={startCreate}>
            + Add plan
          </button>
        </div>
      </div>

      {loading ? <p className="pa-empty">Loading plans…</p> : null}

      {!loading && !plans.length ? (
        <div className="pa-plans-empty">
          <h2>No plans yet</h2>
          <p>Create a launch package so restaurants can pay the correct amount at checkout.</p>
          <button type="button" className="new-tenant" onClick={startCreate}>
            + Add plan
          </button>
        </div>
      ) : null}

      <div className="pa-plans-grid">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`pa-plan-card${plan.popular ? ' is-popular' : ''}${
              editingId === plan.id ? ' is-editing' : ''
            }`}
          >
            {plan.popular ? <span className="pa-plan-badge">Popular</span> : null}

            <div className="pa-plan-card-top">
              <p className="pa-plan-id">{plan.id}</p>
              <h2>{plan.name}</h2>
              <p className="pa-plan-tag">{plan.tagline || '—'}</p>
            </div>

            <div className="pa-plan-price">
              <strong>{formatPlanPrice(plan.priceZar)}</strong>
              <span>{plan.billing || 'one-time launch'} · ZAR</span>
            </div>

            <div className="pa-plan-divider" />

            <ul className="pa-plan-features">
              {(plan.features || []).length ? (
                (plan.features || []).map((feature) => <li key={feature}>{feature}</li>)
              ) : (
                <li className="is-muted">No features listed</li>
              )}
            </ul>

            <div className="pa-plan-actions">
              <button type="button" className="pa-plan-btn edit" onClick={() => startEdit(plan)}>
                Edit
              </button>
              <button
                type="button"
                className="pa-plan-btn danger"
                disabled={deletingId === plan.id}
                onClick={() => remove(plan)}
              >
                {deletingId === plan.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {form && mode ? (
        <div className="pa-plan-overlay" role="presentation" onClick={closeForm}>
          <section
            className="pa-plan-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pa-plan-drawer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pa-plan-drawer-head">
              <div>
                <p className="pa-plan-drawer-eyebrow">
                  {mode === 'create' ? 'New launch package' : 'Edit launch package'}
                </p>
                <h2 id="pa-plan-drawer-title">
                  {mode === 'create' ? 'Add plan' : `Edit · ${editingId}`}
                </h2>
              </div>
              <button type="button" className="pa-plan-drawer-close" onClick={closeForm} aria-label="Close">
                ×
              </button>
            </header>

            <form className="pa-plan-form" onSubmit={save}>
              <div className="pa-plan-form-grid">
                {mode === 'create' ? (
                  <label className="pa-field">
                    <span>Plan id</span>
                    <input
                      value={form.id}
                      placeholder="auto from name"
                      onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                    />
                    <em>Used in checkout · {previewId}</em>
                  </label>
                ) : (
                  <label className="pa-field">
                    <span>Plan id</span>
                    <input value={editingId} disabled />
                    <em>Id cannot change after create</em>
                  </label>
                )}

                <label className="pa-field">
                  <span>Display name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Starter"
                  />
                </label>

                <label className="pa-field">
                  <span>Price (ZAR)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.priceZar}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priceZar: Number(e.target.value) }))
                    }
                  />
                  <em>Charged at onboarding payment</em>
                </label>

                <label className="pa-field">
                  <span>Billing label</span>
                  <input
                    value={form.billing}
                    onChange={(e) => setForm((f) => ({ ...f, billing: e.target.value }))}
                    placeholder="one-time launch"
                  />
                </label>

                <label className="pa-field pa-field-span">
                  <span>Tagline</span>
                  <input
                    value={form.tagline}
                    onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                    placeholder="Launch your digital storefront"
                  />
                </label>

                <label className="pa-field pa-field-span">
                  <span>Features (one per line)</span>
                  <textarea
                    rows={7}
                    value={form.features}
                    onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
                    placeholder={'Guest website & menu\nBusiness ID QR card\n…'}
                  />
                </label>

                <label className="pa-field">
                  <span>Sort order</span>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))
                    }
                  />
                </label>

                <label className="pa-check">
                  <input
                    type="checkbox"
                    checked={form.popular}
                    onChange={(e) => setForm((f) => ({ ...f, popular: e.target.checked }))}
                  />
                  <span>
                    <strong>Popular badge</strong>
                    <small>Highlights this card · only one plan can be popular</small>
                  </span>
                </label>
              </div>

              <div className="pa-plan-form-preview">
                <span>Checkout amount</span>
                <strong>{formatPlanPrice(form.priceZar)}</strong>
              </div>

              <footer className="pa-plan-form-actions">
                <button type="button" className="pa-plan-btn ghost" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="pa-plan-btn primary" disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : mode === 'create'
                      ? 'Create plan'
                      : 'Save plan'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default Plans
