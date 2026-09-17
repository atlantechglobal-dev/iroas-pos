import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { QrCodePreview, downloadQrPng } from '../../components/QrCodePreview.jsx'
import { prepareImageDataUrl } from '../../utils/imageFile.js'
import {
  cardDisplayHost,
  cardPublicUrl,
  loadCardPreview,
  openBusinessIdPreview,
  restaurantPublicSlug,
  saveCardPreview,
} from '../../utils/guestLinks.js'
import './BusinessId.css'

function normalizeGallery(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (typeof item === 'string') return { id: `g-${index}`, dataUrl: item }
      const dataUrl = item?.dataUrl || item?.url || item?.src || ''
      if (!dataUrl) return null
      return { id: item.id || `g-${index}`, dataUrl, caption: item.caption || '' }
    })
    .filter(Boolean)
}

const EMPTY_FORM = {
  restaurantName: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  city: '',
  country: '',
  tagline: '',
  description: '',
  cuisine: '',
  facebook: '',
  instagram: '',
  traditionTitle: 'Tradition',
  traditionSub: '',
  traditionBody: '',
  varietyTitle: 'Variety',
  varietySub: '',
  varietyBody: '',
}

function BusinessId() {
  const toast = useToast()
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [slug, setSlug] = useState('your-card')
  const [form, setForm] = useState(EMPTY_FORM)
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const [coverDataUrl, setCoverDataUrl] = useState('')
  const [gallery, setGallery] = useState([])
  const [hours, setHours] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (cancelled || !restaurant) return
        const settings = restaurant.settings || {}
        const stories = settings.businessIdStories || {}
        const nextSlug = restaurantPublicSlug(restaurant, 'your-card')
        const saved = loadCardPreview(nextSlug)
        setSlug(nextSlug)
        setForm({
          restaurantName: restaurant.name || '',
          phone: restaurant.phone || saved?.card?.phone || '',
          email: restaurant.email || saved?.card?.email || '',
          website: restaurant.website || saved?.card?.website || '',
          address: restaurant.address || saved?.card?.address || '',
          city: restaurant.city || saved?.card?.city || '',
          country: restaurant.country || saved?.card?.country || '',
          tagline: settings.tagline || saved?.card?.tagline || '',
          description: restaurant.description || '',
          cuisine: restaurant.cuisine || '',
          facebook: settings.facebook || '',
          instagram: settings.instagram || settings.socialInstagram || '',
          traditionTitle: stories.traditionTitle || 'Tradition',
          traditionSub: stories.traditionSub || '',
          traditionBody: stories.traditionBody || '',
          varietyTitle: stories.varietyTitle || 'Variety',
          varietySub: stories.varietySub || '',
          varietyBody: stories.varietyBody || '',
        })
        setLogoDataUrl(
          restaurant.logo_data_url ||
            restaurant.logoDataUrl ||
            saved?.card?.logoDataUrl ||
            '',
        )
        setCoverDataUrl(
          settings.coverDataUrl ||
            settings.coverPhoto ||
            saved?.card?.heroDataUrl ||
            '',
        )
        setGallery(normalizeGallery(settings.gallery))
        if (restaurant.operating_hours) {
          try {
            setHours(
              typeof restaurant.operating_hours === 'string'
                ? JSON.parse(restaurant.operating_hours)
                : restaurant.operating_hours,
            )
          } catch {
            setHours(null)
          }
        }
      })
      .catch((err) => toast.error(err.message || 'Could not load restaurant.'))
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  const publicUrl = useMemo(() => cardPublicUrl(slug), [slug])
  const displayHost = useMemo(() => cardDisplayHost(slug), [slug])
  const initials = String(form.restaurantName || 'ID')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  const patch = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const onImageUpload = (kind) => async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = await prepareImageDataUrl(file, {
      maxBytes: 2.5 * 1024 * 1024,
      maxDimension: kind === 'logo' ? 512 : 1200,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (kind === 'logo') setLogoDataUrl(result.dataUrl)
    if (kind === 'cover') setCoverDataUrl(result.dataUrl)
    if (kind === 'gallery') {
      setGallery((prev) => [
        ...prev,
        { id: `g-${Date.now()}`, dataUrl: result.dataUrl, caption: '' },
      ])
    }
    toast.success('Photo updated.')
  }

  const removeGalleryItem = (id) => {
    setGallery((prev) => prev.filter((g) => g.id !== id))
  }

  const hasPhoto = Boolean(coverDataUrl || logoDataUrl || gallery.length > 0)
  const hasDetails =
    Boolean(String(form.restaurantName || '').trim()) &&
    (Boolean(String(form.phone || '').trim()) || Boolean(String(form.email || '').trim())) &&
    Boolean(String(form.address || '').trim())

  const isIncomplete = () => !hasPhoto || !hasDetails

  const promptFill = () => {
    if (!hasPhoto && !hasDetails) {
      toast.info('Please add a photo and fill in the details first.')
      return
    }
    if (!hasPhoto) {
      toast.info('Please add a photo first (logo, cover, or gallery).')
      return
    }
    toast.info('Please fill in the business details first (name, phone or email, and address).')
  }

  const handleSave = async () => {
    if (!hydrated) return
    if (isIncomplete()) {
      promptFill()
      return
    }
    setSaving(true)
    try {
      await api.updateProfile({
        restaurantName: form.restaurantName,
        phone: form.phone,
        email: form.email,
        website: form.website,
        address: form.address,
        city: form.city,
        country: form.country,
        cuisine: form.cuisine,
        description: form.description,
        hours: hours || undefined,
      })
      await api.updateBrand({ logoDataUrl: logoDataUrl || '' })
      await api.updateSettings({
        tagline: form.tagline,
        facebook: form.facebook,
        instagram: form.instagram,
        coverDataUrl: coverDataUrl || null,
        coverPhoto: coverDataUrl || null,
        gallery,
        businessIdStories: {
          traditionTitle: form.traditionTitle,
          traditionSub: form.traditionSub,
          traditionBody: form.traditionBody,
          varietyTitle: form.varietyTitle,
          varietySub: form.varietySub,
          varietyBody: form.varietyBody,
        },
      })
      saveCardPreview(slug, {
        restaurantName: form.restaurantName,
        card: {
          phone: form.phone,
          email: form.email,
          website: form.website,
          address: form.address,
          city: form.city,
          country: form.country,
          tagline: form.tagline,
          logoDataUrl,
          heroDataUrl: coverDataUrl,
          insta: form.instagram,
          facebook: form.facebook,
        },
      })
      toast.success('Business ID saved. Public card updated.')
    } catch (err) {
      toast.error(err.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const openLive = () => {
    if (isIncomplete()) {
      promptFill()
      return
    }
    openBusinessIdPreview(slug)
  }

  const downloadQr = async () => {
    if (isIncomplete()) {
      promptFill()
      return
    }
    try {
      await downloadQrPng(publicUrl, `${slug}-business-id-QR.png`, { width: 512 })
      toast.success('QR downloaded.')
    } catch {
      toast.error('Unable to download QR.')
    }
  }

  return (
    <DashboardLayout pageClassName="business-id-page" activeNav="business-id">
      <div className="bid-admin">
        <header className="bid-admin-head">
          <div>
            <p className="bid-admin-eyebrow">Overview</p>
            <h1>Business ID</h1>
            <p>
              Edit the long Cosmo-style Business ID guests open at{' '}
              <code>/c/{slug}</code>. Available after your account is approved —
              same access as other dashboard pages.
            </p>
          </div>
          <div className="bid-admin-actions">
            <button type="button" className="bid-btn ghost" onClick={openLive}>
              Open live card
            </button>
            <button
              type="button"
              className="bid-btn primary"
              onClick={handleSave}
              disabled={!hydrated || saving}
            >
              {saving ? 'Saving…' : 'Save Business ID'}
            </button>
          </div>
        </header>

        {hydrated && isIncomplete() ? (
          <p className="bid-admin-banner" role="status">
            Add a photo and fill in name, phone or email, and address before you can <strong>Save</strong> or
            open the <strong>live</strong> card.
          </p>
        ) : null}

        <div className="bid-admin-grid">
          <div className="bid-admin-main">
            <section className="bid-panel">
              <h2>Contact details</h2>
              <p className="bid-panel-sub">Shown on Call, Email, Website, WhatsApp, and Save Contact.</p>
              <div className="bid-fields">
                <label>
                  Business name
                  <input value={form.restaurantName} onChange={patch('restaurantName')} />
                </label>
                <label>
                  Phone
                  <input value={form.phone} onChange={patch('phone')} placeholder="+91 98765 43210" />
                </label>
                <label>
                  Email
                  <input type="email" value={form.email} onChange={patch('email')} />
                </label>
                <label>
                  Website
                  <input value={form.website} onChange={patch('website')} placeholder="www.example.com" />
                </label>
                <label>
                  Instagram
                  <input value={form.instagram} onChange={patch('instagram')} placeholder="@handle" />
                </label>
                <label>
                  Facebook
                  <input value={form.facebook} onChange={patch('facebook')} placeholder="facebook.com/…" />
                </label>
              </div>
            </section>

            <section className="bid-panel">
              <h2>Location</h2>
              <p className="bid-panel-sub">Powers the Map section and Location tile.</p>
              <div className="bid-fields">
                <label className="span-2">
                  Full address
                  <input value={form.address} onChange={patch('address')} placeholder="Street, area" />
                </label>
                <label>
                  City
                  <input value={form.city} onChange={patch('city')} />
                </label>
                <label>
                  Country
                  <input value={form.country} onChange={patch('country')} />
                </label>
              </div>
            </section>

            <section className="bid-panel">
              <h2>Tagline &amp; stories</h2>
              <p className="bid-panel-sub">Header quote and Tradition / Variety story cards.</p>
              <div className="bid-fields">
                <label className="span-2">
                  Tagline
                  <input
                    value={form.tagline}
                    onChange={patch('tagline')}
                    placeholder="Flavourful dumplings, made with love"
                  />
                </label>
                <label className="span-2">
                  Short description
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={patch('description')}
                    placeholder="About your restaurant"
                  />
                </label>
                <label>
                  Cuisine
                  <input value={form.cuisine} onChange={patch('cuisine')} />
                </label>
                <div className="span-2 bid-story-grid">
                  <div>
                    <h3>Tradition</h3>
                    <label>
                      Title
                      <input value={form.traditionTitle} onChange={patch('traditionTitle')} />
                    </label>
                    <label>
                      Subtitle
                      <input value={form.traditionSub} onChange={patch('traditionSub')} />
                    </label>
                    <label>
                      Body
                      <textarea rows={4} value={form.traditionBody} onChange={patch('traditionBody')} />
                    </label>
                  </div>
                  <div>
                    <h3>Variety</h3>
                    <label>
                      Title
                      <input value={form.varietyTitle} onChange={patch('varietyTitle')} />
                    </label>
                    <label>
                      Subtitle
                      <input value={form.varietySub} onChange={patch('varietySub')} />
                    </label>
                    <label>
                      Body
                      <textarea rows={4} value={form.varietyBody} onChange={patch('varietyBody')} />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section className="bid-panel">
              <h2>Photos</h2>
              <p className="bid-panel-sub">
                Cover shows on the card by default; hover reveals the QR scanner. Gallery feeds brochure
                and media sections.
              </p>

              <div className="bid-photo-row">
                <div className="bid-photo-block">
                  <span>Logo</span>
                  <div className="bid-photo-preview round">
                    {logoDataUrl ? <img src={logoDataUrl} alt="" /> : <em>{initials || 'ID'}</em>}
                  </div>
                  <div className="bid-photo-btns">
                    <label className="bid-btn ghost compact">
                      Upload
                      <input type="file" accept="image/*" hidden onChange={onImageUpload('logo')} />
                    </label>
                    {logoDataUrl ? (
                      <button type="button" className="bid-btn ghost compact" onClick={() => setLogoDataUrl('')}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="bid-photo-block wide">
                  <span>Cover / brochure</span>
                  <div className="bid-photo-preview cover">
                    {coverDataUrl ? (
                      <img src={coverDataUrl} alt="" />
                    ) : (
                      <em>Fill image and details</em>
                    )}
                  </div>
                  <div className="bid-photo-btns">
                    <label className="bid-btn ghost compact">
                      Upload
                      <input type="file" accept="image/*" hidden onChange={onImageUpload('cover')} />
                    </label>
                    {coverDataUrl ? (
                      <button
                        type="button"
                        className="bid-btn ghost compact"
                        onClick={() => setCoverDataUrl('')}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="bid-gallery-admin">
                <div className="bid-gallery-head">
                  <span>Media gallery</span>
                  <label className="bid-btn ghost compact">
                    Add photo
                    <input type="file" accept="image/*" hidden onChange={onImageUpload('gallery')} />
                  </label>
                </div>
                <div className="bid-gallery-grid">
                  {gallery.map((g) => (
                    <div key={g.id} className="bid-gallery-item">
                      <img src={g.dataUrl} alt="" />
                      <button
                        type="button"
                        className="bid-btn ghost compact"
                        onClick={() => removeGalleryItem(g.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {gallery.length === 0 ? (
                    <div className="bid-gallery-empty-slots">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="bid-gallery-slot">
                          <em>Fill image and details</em>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <aside className="bid-admin-side">
            <div className="bid-side-card">
              <p className="bid-side-label">Public Business ID</p>
              <strong className="bid-side-link">{displayHost}</strong>
              <div className="bid-side-qr">
                <QrCodePreview value={publicUrl} size={168} alt="Business ID QR" />
              </div>
              <div className="bid-side-actions">
                <button type="button" className="bid-btn ghost" onClick={downloadQr}>
                  Download QR
                </button>
                <button type="button" className="bid-btn primary" onClick={openLive}>
                  Preview card
                </button>
              </div>
              <div className="bid-mini-preview">
                <div
                  className="bid-mini-hero"
                  style={
                    coverDataUrl ? { backgroundImage: `url(${coverDataUrl})` } : undefined
                  }
                />
                <div className="bid-mini-logo">
                  {logoDataUrl ? <img src={logoDataUrl} alt="" /> : <span>{initials}</span>}
                </div>
                <p className="bid-mini-name">{form.restaurantName || 'Your business'}</p>
                <p className="bid-mini-tag">
                  “{form.tagline || 'Good food, warm hospitality.'}”
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default BusinessId
