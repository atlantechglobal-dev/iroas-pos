import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../lib/api'
import { prepareImageDataUrl } from '../../utils/imageFile.js'
import { ROUTES } from '../../constants/routes.js'
import {
  BUSINESS_CATEGORIES,
  emptyIdentityForm,
  getCategoryFieldConfig,
  identityToForm,
  isIdentityEditable,
} from '../../constants/digitalIdentity.js'
import './DigitalIdentity.css'

function DigitalIdentityForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState(emptyIdentityForm)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getIdentity()
      .then((data) => {
        if (data.identity) {
          setForm(identityToForm(data.identity))
          setStatus(data.identity.status)
        } else if (user) {
          setForm((prev) => ({
            ...prev,
            contactPerson: user.name || '',
            email: user.email || '',
          }))
        }
      })
      .catch((err) => toast.error(err.message || 'Unable to load form.'))
      .finally(() => setLoading(false))
  }, [user])

  const editable = isIdentityEditable(status)

  const setField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setSocial = (key) => (e) => {
    setForm((prev) => ({ ...prev, social: { ...prev.social, [key]: e.target.value } }))
  }

  const setPresence = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({
      ...prev,
      onlinePresence: { ...prev.onlinePresence, [key]: value },
    }))
  }

  const setVertical = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      verticalFields: { ...prev.verticalFields, [key]: e.target.value },
    }))
  }

  const onLogo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await prepareImageDataUrl(file)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setForm((prev) => ({ ...prev, logoDataUrl: result.dataUrl }))
  }

  const handleSave = async () => {
    if (!editable) return
    setSaving(true)
    try {
      const { identity } = await api.saveIdentity(form)
      setStatus(identity.status)
      toast.success('Draft saved.')
    } catch (err) {
      toast.error(err.message || 'Unable to save draft.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!editable) return
    setSubmitting(true)
    try {
      const data = await api.submitIdentity(form)
      sessionStorage.setItem('di_submit_message', data.message)
      toast.success('Submitted for review.')
      navigate(ROUTES.DIGITAL_IDENTITY)
    } catch (err) {
      toast.error(err.message || 'Unable to submit.')
    } finally {
      setSubmitting(false)
    }
  }

  const category = form.category
  const categoryFields = getCategoryFieldConfig(category)

  if (loading) {
    return (
      <DashboardLayout pageClassName="digital-identity-page" activeNav="digital-identity">
        <p className="di-muted">Loading form…</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout pageClassName="digital-identity-page" activeNav="digital-identity">
      <div className="page-head">
        <div>
          <p className="eyebrow">DIGITAL IDENTITY</p>
          <h1>Identity form</h1>
          <p className="page-desc">
            Collect business, contact, branding and online presence details for any SME. Restaurant-only
            fields appear only when relevant.
          </p>
        </div>
        <div className="di-form-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate(ROUTES.DIGITAL_IDENTITY)}>
            Back
          </button>
          {editable ? (
            <>
              <button type="button" className="btn btn-outline" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </>
          ) : (
            <span className="di-badge warn">Locked while {status?.replace(/_/g, ' ')}</span>
          )}
        </div>
      </div>

      <fieldset disabled={!editable} className="di-form">
        <section className="card">
          <h2>Business information</h2>
          <div className="di-grid">
            <label>
              Business / company name *
              <input value={form.businessName} onChange={setField('businessName')} />
            </label>
            <label>
              Business category *
              <select value={form.category} onChange={setField('category')}>
                <option value="">Select category</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {showOther ? (
              <label>
                Specify category *
                <input value={form.categoryOther} onChange={setField('categoryOther')} />
              </label>
            ) : null}
            <label>
              Business type
              <input
                value={form.businessType}
                onChange={setField('businessType')}
                placeholder="e.g. Sole prop, Pvt Ltd"
              />
            </label>
            <label>
              Year established
              <input value={form.yearEstablished} onChange={setField('yearEstablished')} />
            </label>
            <label>
              Contact person *
              <input value={form.contactPerson} onChange={setField('contactPerson')} />
            </label>
            <label className="full">
              Description
              <textarea rows={3} value={form.description} onChange={setField('description')} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Contact information</h2>
          <div className="di-grid">
            <label>
              Phone *
              <input value={form.phone} onChange={setField('phone')} />
            </label>
            <label>
              Email *
              <input type="email" value={form.email} onChange={setField('email')} />
            </label>
            <label>
              Website
              <input value={form.website} onChange={setField('website')} />
            </label>
            <label className="full">
              Address
              <input value={form.address} onChange={setField('address')} />
            </label>
            <label>
              City
              <input value={form.city} onChange={setField('city')} />
            </label>
            <label>
              State
              <input value={form.state} onChange={setField('state')} />
            </label>
            <label>
              Country
              <input value={form.country} onChange={setField('country')} />
            </label>
            <label>
              Postal code
              <input value={form.postalCode} onChange={setField('postalCode')} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Branding</h2>
          <div className="di-grid">
            <label>
              Brand name
              <input value={form.brandName} onChange={setField('brandName')} />
            </label>
            <label>
              Primary brand information
              <input value={form.primaryBrandInfo} onChange={setField('primaryBrandInfo')} />
            </label>
            <label className="full">
              Business logo
              <input type="file" accept="image/*" onChange={onLogo} />
            </label>
            {form.logoDataUrl ? (
              <div className="di-logo-preview">
                <img src={form.logoDataUrl} alt="Logo preview" />
              </div>
            ) : null}
            <label>
              Instagram
              <input value={form.social.instagram} onChange={setSocial('instagram')} />
            </label>
            <label>
              Facebook
              <input value={form.social.facebook} onChange={setSocial('facebook')} />
            </label>
            <label>
              LinkedIn
              <input value={form.social.linkedin} onChange={setSocial('linkedin')} />
            </label>
            <label>
              X / Twitter
              <input value={form.social.twitter} onChange={setSocial('twitter')} />
            </label>
          </div>
        </section>

        {category ? (
          <section className="card">
            <h2>Business details</h2>
            <div className="di-grid">
              {categoryFields.map((field) => (
                <label key={field.key} className={field.type === 'textarea' ? 'full' : undefined}>
                  {field.label}
                  {field.required ? ' *' : ''}
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={form.verticalFields[field.key] || ''}
                      onChange={setVertical(field.key)}
                      placeholder={field.placeholder || ''}
                    />
                  ) : (
                    <input
                      value={form.verticalFields[field.key] || ''}
                      onChange={setVertical(field.key)}
                      placeholder={field.placeholder || ''}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <h2>Online presence & products</h2>
          <p className="di-muted">
            Tell us which digital products you may want after approval. We will reuse this identity.
          </p>
          <div className="di-check-row">
            <label>
              <input
                type="checkbox"
                checked={!!form.onlinePresence.wantsWebsite}
                onChange={setPresence('wantsWebsite')}
              />
              Simple Website
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!form.onlinePresence.wantsBusinessCard}
                onChange={setPresence('wantsBusinessCard')}
              />
              Digital Business Card
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!form.onlinePresence.wantsMobileApp}
                onChange={setPresence('wantsMobileApp')}
              />
              Mobile Application
            </label>
          </div>
          <label className="full">
            Notes for online presence
            <textarea rows={3} value={form.onlinePresence.notes || ''} onChange={setPresence('notes')} />
          </label>
        </section>
      </fieldset>
    </DashboardLayout>
  )
}

export default DigitalIdentityForm
