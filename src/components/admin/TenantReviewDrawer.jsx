import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../lib/api'
import { QrCodePreview } from '../QrCodePreview.jsx'
import { restaurantHostname } from '../../utils/restaurantUrl.js'
import { guestSiteUrl, restaurantPublicSlug } from '../../utils/guestLinks.js'
import { useToast } from '../feedback/ToastProvider.jsx'
import './TenantReviewDrawer.css'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'domain', label: 'Domain' },
  { id: 'brand', label: 'Brand' },
  { id: 'preview', label: 'Preview' },
  { id: 'activity', label: 'Activity' },
]

const STATUS_COPY = {
  pending_approval: 'Awaiting approval',
  onboarding: 'Onboarding',
  live: 'Approved & live',
  rejected: 'Rejected',
}

function parseHours(raw) {
  if (!raw) return []
  try {
    const hours = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(hours) ? hours : []
  } catch {
    return []
  }
}

function formatWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function Field({ label, value, name, editing, onChange, multiline }) {
  if (!editing) {
    return (
      <div className="tenant-review-field">
        <span>{label}</span>
        <strong>{value || '—'}</strong>
      </div>
    )
  }
  if (multiline) {
    return (
      <label className="tenant-review-field">
        <span>{label}</span>
        <textarea name={name} value={value || ''} onChange={onChange} rows={4} />
      </label>
    )
  }
  return (
    <label className="tenant-review-field">
      <span>{label}</span>
      <input name={name} value={value || ''} onChange={onChange} />
    </label>
  )
}

export function TenantReviewDrawer({
  tenantId,
  variant = 'drawer',
  onClose,
  onChanged,
}) {
  const toast = useToast()
  const isPage = variant === 'page'
  const [tab, setTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState(null)
  const [events, setEvents] = useState([])
  const [form, setForm] = useState({})
  const [editing, setEditing] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState('')
  const [busy, setBusy] = useState('')

  const load = async (id) => {
    const data = await api.adminTenant(id)
    setTenant(data.tenant)
    setEvents(data.events || [])
    setForm({
      name: data.tenant.name || '',
      cuisine: data.tenant.cuisine || '',
      description: data.tenant.description || '',
      phone: data.tenant.phone || '',
      website: data.tenant.website || '',
      email: data.tenant.email || '',
      city: data.tenant.city || '',
      country: data.tenant.country || '',
      timezone: data.tenant.timezone || '',
      address: data.tenant.address || '',
      subdomain: data.tenant.subdomain || '',
      customDomain: data.tenant.customDomain || '',
      domainSuffix: data.tenant.domainSuffix || 'iroas.com',
      primaryColor: data.tenant.primaryColor || '#F97316',
      secondaryColor: data.tenant.secondaryColor || '#F0F72A',
      accentColor: data.tenant.accentColor || '#BDB8A4',
      font: data.tenant.font || '',
      theme: data.tenant.theme || '',
      plan: data.tenant.plan || 'starter',
    })
  }

  useEffect(() => {
    if (!tenantId || isPage) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [tenantId, isPage])

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    setEditing(false)
    setRejectOpen(false)
    setDeleteOpen(false)
    setChecks({ profile: false, domain: false, brand: false, preview: false })
    load(tenantId)
      .catch((err) => toast.error(err.message || 'Unable to load application.'))
      .finally(() => setLoading(false))
  }, [tenantId])

  const hostname = useMemo(
    () =>
      tenant
        ? restaurantHostname({
            custom_domain: form.customDomain,
            subdomain: form.subdomain,
            domain_suffix: form.domainSuffix,
          })
        : '',
    [tenant, form],
  )
  const previewUrl = tenant
    ? guestSiteUrl(
        restaurantPublicSlug(
          { subdomain: form.subdomain, name: form.name },
          'your-restaurant',
        ),
        'website',
      )
    : ''

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const isAccountApproval = Boolean(tenant?.awaitingAccountApproval)
  const canApprove =
    tenant?.status === 'pending_approval' && isAccountApproval

  const reviewerLabel = useMemo(() => {
    if (!tenant?.reviewedBy) return ''
    const name = tenant.reviewedBy.name || tenant.reviewedBy.email || 'Admin'
    const email =
      tenant.reviewedBy.email && tenant.reviewedBy.name ? ` (${tenant.reviewedBy.email})` : ''
    return `${name}${email}`
  }, [tenant])

  const approveEvent = useMemo(
    () => events.find((event) => event.action === 'approve'),
    [events],
  )

  const approvedByLabel =
    reviewerLabel ||
    (approveEvent
      ? `${approveEvent.actor_name || approveEvent.actor_email || 'Admin'}${
          approveEvent.actor_email && approveEvent.actor_name
            ? ` (${approveEvent.actor_email})`
            : ''
        }`
      : '')

  const approvedAtLabel = formatWhen(tenant?.reviewedAt || approveEvent?.created_at)

  const handleSave = async () => {
    setBusy('save')
    try {
      const data = await api.adminUpdateTenant(tenantId, form)
      setTenant(data.tenant)
      setEvents(data.events || [])
      setEditing(false)
      toast.success('Application updated')
      onChanged?.()
    } catch (err) {
      toast.error(err.message || 'Unable to save.')
    } finally {
      setBusy('')
    }
  }

  const handleApprove = async () => {
    setBusy('approve')
    try {
      await api.adminApproveTenant(tenantId, {})
      toast.success(`${form.name || 'Account'} approved — owner will get an email`)
      if (isPage) {
        await load(tenantId)
        onChanged?.()
      } else {
        onChanged?.()
        onClose()
      }
    } catch (err) {
      toast.error(err.message || 'Unable to approve.')
    } finally {
      setBusy('')
    }
  }

  const handleReject = async () => {
    setBusy('reject')
    try {
      await api.adminRejectTenant(tenantId, rejectReason.trim())
      toast.success('Application rejected')
      if (isPage) {
        setRejectOpen(false)
        await load(tenantId)
        onChanged?.()
      } else {
        onChanged?.()
        onClose()
      }
    } catch (err) {
      toast.error(err.message || 'Unable to reject.')
    } finally {
      setBusy('')
    }
  }

  const handleDelete = async () => {
    setBusy('delete')
    try {
      await api.adminDeleteTenant(tenantId, deleteName.trim())
      toast.success('Tenant deleted')
      onChanged?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Unable to delete.')
    } finally {
      setBusy('')
    }
  }

  const panel = (
        <>
        {loading || !tenant ? (
          <p className="tenant-review-loading">Loading application…</p>
        ) : (
          <>
            <header className="tenant-review-head">
              <div>
                <div className="tenant-review-head-row">
                  <p className="tenant-review-kicker">
                    {isPage ? 'Approve profile' : 'Application review'}
                  </p>
                  <span className={`tenant-review-status is-${tenant.status}`}>
                    {STATUS_COPY[tenant.status] || tenant.status}
                  </span>
                </div>
                <h2 id="tenant-review-title">{form.name || 'Untitled business'}</h2>
                <p>
                  {tenant.owner?.name} · {tenant.owner?.email}
                  {tenant.submittedAt ? ` · Submitted ${formatWhen(tenant.submittedAt)}` : ''}
                  {tenant.status === 'live' && approvedByLabel
                    ? ` · Approved by ${tenant.reviewedBy?.name || tenant.reviewedBy?.email || approveEvent?.actor_name || 'Admin'}`
                    : ''}
                </p>
              </div>
              {!isPage ? (
                <button type="button" className="tenant-review-close" onClick={onClose}>
                  Close
                </button>
              ) : null}
            </header>

            {tenant.status === 'pending_approval' && isAccountApproval ? (
              <div className="tenant-review-approve-banner">
                <div>
                  <strong>New signup awaiting approval</strong>
                  <span>
                    Approve to email the owner and unlock setup. No checklist needed.
                  </span>
                </div>
                <div className="tenant-review-approve-banner-actions">
                  <button type="button" onClick={() => setRejectOpen(true)}>
                    Reject
                  </button>
                  <button
                    type="button"
                    className="is-primary"
                    disabled={!canApprove || busy === 'approve'}
                    onClick={handleApprove}
                    title="Approve account and email the owner"
                  >
                    {busy === 'approve' ? 'Approving…' : 'Approve account'}
                  </button>
                </div>
              </div>
            ) : null}

            {tenant.status === 'pending_approval' && !isAccountApproval ? (
              <div className="tenant-review-approve-banner">
                <div>
                  <strong>No admin approval needed</strong>
                  <span>
                    Only Create Account signups are approved here. This store goes live after the
                    owner completes payment.
                  </span>
                </div>
              </div>
            ) : null}

            {tenant.status === 'live' ? (
              <div className="tenant-review-approve-banner is-approved">
                <div>
                  <strong>Approved &amp; live</strong>
                  <span>
                    {approvedByLabel
                      ? `Approved by ${approvedByLabel}`
                      : 'Published for customers'}
                    {approvedAtLabel ? ` · ${approvedAtLabel}` : ''}
                  </span>
                </div>
              </div>
            ) : null}

            {tenant.status === 'rejected' ? (
              <div className="tenant-review-approve-banner is-rejected">
                <div>
                  <strong>Rejected</strong>
                  <span>
                    {approvedByLabel ? `By ${approvedByLabel}` : 'Sent back to the owner'}
                    {approvedAtLabel ? ` · ${approvedAtLabel}` : ''}
                    {tenant.rejectionReason ? ` — ${tenant.rejectionReason}` : ''}
                  </span>
                </div>
              </div>
            ) : null}

            <nav className="tenant-review-tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={tab === item.id ? 'is-active' : ''}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="tenant-review-body">
              {tab === 'profile' && (
                <div className="tenant-review-grid">
                  {(tenant.status === 'live' || tenant.status === 'rejected') && (
                    <>
                      <div className="tenant-review-field">
                        <span>{tenant.status === 'live' ? 'Approved by' : 'Reviewed by'}</span>
                        <strong>{approvedByLabel || '—'}</strong>
                      </div>
                      <div className="tenant-review-field">
                        <span>{tenant.status === 'live' ? 'Approved at' : 'Reviewed at'}</span>
                        <strong>{approvedAtLabel || '—'}</strong>
                      </div>
                    </>
                  )}
                  <Field label="Business name" name="name" value={form.name} editing={editing} onChange={onChange} />
                  <Field label="Cuisine / specialty" name="cuisine" value={form.cuisine} editing={editing} onChange={onChange} />
                  <label className="tenant-review-field">
                    <span>Plan</span>
                    {editing ? (
                      <select name="plan" value={form.plan || 'starter'} onChange={onChange}>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="Starter">Starter (legacy)</option>
                        <option value="Pro">Pro (legacy)</option>
                      </select>
                    ) : (
                      <strong>{form.plan || '—'}</strong>
                    )}
                  </label>
                  <Field label="City" name="city" value={form.city} editing={editing} onChange={onChange} />
                  <Field label="Country" name="country" value={form.country} editing={editing} onChange={onChange} />
                  <Field label="Phone" name="phone" value={form.phone} editing={editing} onChange={onChange} />
                  <Field label="Email" name="email" value={form.email} editing={editing} onChange={onChange} />
                  <Field label="Website" name="website" value={form.website} editing={editing} onChange={onChange} />
                  <Field label="Timezone" name="timezone" value={form.timezone} editing={editing} onChange={onChange} />
                  <Field
                    label="Address"
                    name="address"
                    value={form.address}
                    editing={editing}
                    onChange={onChange}
                    multiline
                  />
                  <Field
                    label="Description"
                    name="description"
                    value={form.description}
                    editing={editing}
                    onChange={onChange}
                    multiline
                  />
                  <div className="tenant-review-field tenant-review-span">
                    <span>Operating hours</span>
                    {parseHours(tenant.operatingHours).length ? (
                      <ul className="tenant-review-hours">
                        {parseHours(tenant.operatingHours).map((row) => (
                          <li key={row.day}>
                            <em>{row.day}</em>
                            <span>{row.closed ? 'Closed' : `${row.open || '—'} – ${row.close || '—'}`}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <strong>Not set</strong>
                    )}
                  </div>
                </div>
              )}

              {tab === 'domain' && (
                <div className="tenant-review-grid">
                  <Field label="Subdomain" name="subdomain" value={form.subdomain} editing={editing} onChange={onChange} />
                  <Field
                    label="Custom domain"
                    name="customDomain"
                    value={form.customDomain}
                    editing={editing}
                    onChange={onChange}
                  />
                  <Field
                    label="Suffix"
                    name="domainSuffix"
                    value={form.domainSuffix}
                    editing={editing}
                    onChange={onChange}
                  />
                  <div className="tenant-review-field tenant-review-span">
                    <span>Public hostname</span>
                    <strong>{hostname || 'Not set'}</strong>
                  </div>
                </div>
              )}

              {tab === 'brand' && (
                <div className="tenant-review-brand">
                  <div className="tenant-review-brand-top">
                    {tenant.logoDataUrl ? (
                      <img src={tenant.logoDataUrl} alt="" className="tenant-review-logo" />
                    ) : (
                      <div className="tenant-review-logo is-empty">No logo</div>
                    )}
                    <div>
                      <p className="tenant-review-brand-name">{form.name || 'Business'}</p>
                      <p className="tenant-review-brand-meta">{form.theme || 'No theme'} · {form.font || 'Default font'}</p>
                    </div>
                  </div>
                  <div className="tenant-review-swatches">
                    {[
                      ['primaryColor', 'Primary'],
                      ['secondaryColor', 'Secondary'],
                      ['accentColor', 'Accent'],
                    ].map(([name, label]) => (
                      <label key={name} className="tenant-review-swatch">
                        <input
                          name={name}
                          type="color"
                          value={form[name]}
                          disabled={!editing}
                          onChange={onChange}
                        />
                        <span>{label}</span>
                        <strong>{form[name]}</strong>
                      </label>
                    ))}
                  </div>
                  {editing ? (
                    <div className="tenant-review-grid">
                      <Field label="Theme" name="theme" value={form.theme} editing onChange={onChange} />
                      <Field label="Font" name="font" value={form.font} editing onChange={onChange} />
                    </div>
                  ) : null}
                </div>
              )}

              {tab === 'preview' && (
                <div className="tenant-review-preview">
                  <div
                    className="tenant-review-phone"
                    style={{ background: form.secondaryColor, color: form.accentColor }}
                  >
                    <div className="tenant-review-mark" style={{ background: form.primaryColor }}>
                      {(form.name || 'B').charAt(0).toUpperCase()}
                    </div>
                    <h3>{form.name || 'Business'}</h3>
                    <p>{[form.cuisine, form.city].filter(Boolean).join(' · ') || 'Preview'}</p>
                    <QrCodePreview value={previewUrl} size={140} alt="QR preview" />
                    <small>{hostname || 'No domain yet'}</small>
                  </div>
                  {previewUrl ? (
                    <a className="tenant-review-preview-link" href={previewUrl} target="_blank" rel="noreferrer">
                      Open guest preview
                    </a>
                  ) : null}
                </div>
              )}

              {tab === 'activity' && (
                <ul className="tenant-review-activity">
                  {events.length === 0 && <li>No review activity yet.</li>}
                  {events.map((event) => (
                    <li key={event.id}>
                      <strong>{event.action}</strong>
                      <span>
                        {event.actor_name || 'Admin'} · {formatWhen(event.created_at)}
                      </span>
                      {event.note ? <p>{event.note}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {rejectOpen && (
              <div className="tenant-review-modal" role="dialog" aria-label="Reject application">
                <div className="tenant-review-modal-card">
                  <h3>Reject application</h3>
                  <p>The owner will see this reason and can update their profile, then resubmit.</p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain what the owner should fix…"
                    rows={4}
                  />
                  <div className="tenant-review-dialog-actions">
                    <button type="button" onClick={() => setRejectOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="is-danger" disabled={busy === 'reject'} onClick={handleReject}>
                      Send back
                    </button>
                  </div>
                </div>
              </div>
            )}

            {deleteOpen && (
              <div className="tenant-review-modal" role="dialog" aria-label="Delete tenant">
                <div className="tenant-review-modal-card">
                  <h3>Delete tenant</h3>
                  <p>
                    Type <strong>{tenant.name}</strong> to confirm. This closes the account.
                  </p>
                  <input value={deleteName} onChange={(e) => setDeleteName(e.target.value)} />
                  <div className="tenant-review-dialog-actions">
                    <button type="button" onClick={() => setDeleteOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="is-danger" disabled={busy === 'delete'} onClick={handleDelete}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            <footer className="tenant-review-footer">
              <div className="tenant-review-footer-left">
                {editing ? (
                  <button type="button" className="is-save" onClick={handleSave} disabled={busy === 'save'}>
                    {busy === 'save' ? 'Saving…' : 'Save changes'}
                  </button>
                ) : (
                  <button type="button" onClick={() => setEditing(true)}>
                    Edit details
                  </button>
                )}
                {tenant.status !== 'live' && (
                  <button type="button" className="is-danger-text" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </button>
                )}
              </div>
              {tenant.status === 'pending_approval' && isAccountApproval ? (
                <div className="tenant-review-footer-right">
                  <button type="button" onClick={() => setRejectOpen(true)}>
                    Reject
                  </button>
                  <button
                    type="button"
                    className="is-primary"
                    disabled={!canApprove || busy === 'approve'}
                    onClick={handleApprove}
                    title="Approve account and email the owner"
                  >
                    {busy === 'approve' ? 'Approving…' : 'Approve account'}
                  </button>
                </div>
              ) : null}
            </footer>
          </>
        )}
        </>
  )

  if (isPage) {
    return (
      <section className="tenant-review-page" aria-labelledby="tenant-review-title">
        {panel}
      </section>
    )
  }

  return createPortal(
    <div className="tenant-review-overlay">
      <button className="tenant-review-backdrop" type="button" aria-label="Close" onClick={onClose} />
      <aside className="tenant-review-drawer" role="dialog" aria-labelledby="tenant-review-title">
        {panel}
      </aside>
    </div>,
    document.body,
  )
}
