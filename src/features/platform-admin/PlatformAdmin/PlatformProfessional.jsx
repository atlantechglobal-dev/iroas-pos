import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useToast } from '@/shared/ui/feedback/ToastProvider'
import { useAuth } from '@/shared/hooks/useAuth'
import { api } from '@/shared/lib/api'
import { QrCodePreview, downloadQrPng } from '@/shared/ui/QrCodePreview'
import {
  BusinessCardVisual,
  CARD_LAYOUTS,
} from '@/shared/ui/businessCard/BusinessCardVisual'
import { prepareImageDataUrl } from '@/shared/utils/imageFile'
import { publicOrigin } from '@/shared/utils/guestLinks'
import '@/features/dashboard/DigitalBusinessCard/DigitalBusinessCard.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdmin.css'
import '@/features/platform-admin/PlatformAdmin/PlatformAdminExtra.css'

const THEME_COLORS = {
  lime: {
    accent: '#8dc63f',
    dark: '#7ab52f',
    headerText: '#16311a',
    panel: '#f0c12e',
    ink: '#17171a',
    muted: '#5a5a52',
    hot: '#8dc63f',
  },
  charcoal: {
    accent: '#26282a',
    dark: '#141516',
    headerText: '#f2f2ef',
    panel: '#2a2c2e',
    ink: '#f2f2ef',
    muted: '#a7a5a0',
    hot: '#f08a2a',
  },
  olive: {
    accent: '#5f8f5a',
    dark: '#4d7549',
    headerText: '#f4f8f2',
    panel: '#6a945f',
    ink: '#f4f8f2',
    muted: '#d5e2d2',
    hot: '#c4e07a',
  },
}

/** Coerce stored image fields to a usable URL string (fixes bad { dataUrl } saves). */
function normalizeImageSrc(value) {
  if (!value) return ''
  if (typeof value === 'object' && value.dataUrl) return normalizeImageSrc(value.dataUrl)
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  if (!raw || raw === '[object Object]') return ''
  if (
    raw.startsWith('data:') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('/')
  ) {
    return raw
  }
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return normalizeImageSrc(parsed?.dataUrl || '')
    } catch {
      return ''
    }
  }
  return ''
}

function PlatformProfessional() {
  const toast = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState('lime')
  const [layout, setLayout] = useState('split-gold')
  const [orgName, setOrgName] = useState('IROAS')
  const [publicSlug, setPublicSlug] = useState('iroas')
  const [published, setPublished] = useState(true)
  const [card, setCard] = useState({
    name: user?.name || '',
    role: 'Super Admin',
    phone: '',
    email: user?.email || '',
    website: 'iroas.com',
    insta: '',
    address: '',
    city: '',
    country: '',
    tagline: 'Platform operations · Restaurant digital suite',
    heroDataUrl: '',
    circleDataUrl: '',
    logoDataUrl: '',
  })

  const colors = THEME_COLORS[theme] || THEME_COLORS.lime
  const previewUrl = `${publicOrigin()}/c/${publicSlug || 'iroas'}`
  const cardLink = previewUrl.replace(/^https?:\/\//, '')

  useEffect(() => {
    let cancelled = false
    api
      .adminProfessionalCard()
      .then(({ card: data }) => {
        if (cancelled || !data) return
        setTheme(data.theme || 'lime')
        setLayout(data.layout || 'split-gold')
        setOrgName(data.orgName || 'IROAS')
        setPublicSlug(data.publicSlug || 'iroas')
        setPublished(data.published !== false)
        const loaded = data.card || {}
        setCard((prev) => ({
          ...prev,
          ...loaded,
          heroDataUrl: normalizeImageSrc(loaded.heroDataUrl),
          circleDataUrl: normalizeImageSrc(loaded.circleDataUrl),
          logoDataUrl: normalizeImageSrc(loaded.logoDataUrl),
        }))
      })
      .catch((err) => toast.error(err.message || 'Unable to load professional card.'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const patchCard = (key, value) => setCard((prev) => ({ ...prev, [key]: value }))

  const onImage = async (key, file) => {
    if (!file) return
    const result = await prepareImageDataUrl(file, {
      maxBytes: 2.5 * 1024 * 1024,
      maxDimension: key === 'logoDataUrl' ? 512 : 960,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    patchCard(key, result.dataUrl)
    toast.success('Image added.')
  }

  const clearImage = (key) => patchCard(key, '')

  const save = async () => {
    setSaving(true)
    try {
      const cleanedCard = {
        ...card,
        heroDataUrl: normalizeImageSrc(card.heroDataUrl),
        circleDataUrl: normalizeImageSrc(card.circleDataUrl),
        logoDataUrl: normalizeImageSrc(card.logoDataUrl),
      }
      const { card: saved } = await api.adminSaveProfessionalCard({
        theme,
        layout,
        orgName,
        publicSlug,
        published,
        card: cleanedCard,
      })
      setTheme(saved.theme)
      setLayout(saved.layout)
      setOrgName(saved.orgName)
      setPublicSlug(saved.publicSlug)
      setPublished(saved.published !== false)
      setCard((prev) => ({
        ...prev,
        ...(saved.card || {}),
        heroDataUrl: normalizeImageSrc(saved.card?.heroDataUrl),
        circleDataUrl: normalizeImageSrc(saved.card?.circleDataUrl),
        logoDataUrl: normalizeImageSrc(saved.card?.logoDataUrl),
      }))
      toast.success('Super admin card saved')
    } catch (err) {
      toast.error(err.message || 'Unable to save card.')
    } finally {
      setSaving(false)
    }
  }

  const openPublic = () => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  const copyLink = () => {
    navigator.clipboard
      .writeText(previewUrl)
      .then(() => toast.success('Public card link copied'))
      .catch(() => toast.info(previewUrl))
  }

  const downloadQr = async () => {
    try {
      await downloadQrPng(previewUrl, `${publicSlug || 'iroas'}-admin-card-QR.png`, {
        width: 720,
        margin: 4,
      })
      toast.success('QR downloaded')
    } catch {
      toast.error('Unable to download QR')
    }
  }

  return (
    <DashboardLayout
      pageClassName="platform-admin-page business-card-page"
      activeNav="platform-professional"
      variant="admin"
      adminSubtitle="Professional card"
    >
      <div className="page-header">
        <div>
          <div className="page-label">PLATFORM</div>
          <h1>Professional card</h1>
          <p>
            Your super admin business card for IROAS. Edit details, preview live, then share the
            public link.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="pa-view-btn" onClick={openPublic}>
            Open public card
          </button>
          <button type="button" className="pa-view-btn" onClick={copyLink}>
            Copy link
          </button>
          <button type="button" className="pa-approve-btn" onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save card'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="pa-empty">Loading professional card…</p>
      ) : (
        <div className="dbc-workspace">
          <aside className="dbc-preview" aria-label="Super admin card preview">
            <div className="preview-label">SUPER ADMIN CARD</div>
            <BusinessCardVisual
              layout={layout}
              theme={theme}
              colors={colors}
              displayRestaurant={orgName || 'IROAS'}
              card={card}
              interactive={false}
            />

            <div className="preview-qr-strip">
              <div className="qr-box">
                <QrCodePreview
                  value={previewUrl}
                  size={112}
                  alt="QR for super admin card"
                  emptyMessage="QR unavailable"
                />
              </div>
              <div className="qtext">
                <strong>Public card</strong>
                <span>Guests open this link to view your card.</span>
                <span className="link">{cardLink}</span>
                <div className="preview-qr-actions">
                  <button type="button" className="btn-mini" onClick={openPublic}>
                    Open
                  </button>
                  <button type="button" className="btn-mini" onClick={downloadQr}>
                    QR
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <section className="dbc-editor">
            <div className="dbc-section">
              <h2>Layout & theme</h2>
              <div className="dbc-chip-row">
                {CARD_LAYOUTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`dbc-chip${layout === item.id ? ' is-active' : ''}`}
                    onClick={() => setLayout(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="dbc-chip-row">
                {Object.keys(THEME_COLORS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`dbc-chip${theme === key ? ' is-active' : ''}`}
                    onClick={() => setTheme(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="dbc-section">
              <h2>Platform identity</h2>
              <div className="dbc-grid">
                <label>
                  Organisation
                  <input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </label>
                <label>
                  Public link slug
                  <input
                    value={publicSlug}
                    onChange={(e) =>
                      setPublicSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ''),
                      )
                    }
                    placeholder="iroas"
                  />
                </label>
                <label className="dbc-check">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                  />
                  Publish on public link `/c/{publicSlug || 'iroas'}`
                </label>
              </div>
            </div>

            <div className="dbc-section">
              <h2>Card details</h2>
              <div className="dbc-grid">
                {[
                  ['name', 'Full name'],
                  ['role', 'Role / title'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['website', 'Website'],
                  ['insta', 'Instagram'],
                  ['city', 'City'],
                  ['country', 'Country'],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input value={card[key] || ''} onChange={(e) => patchCard(key, e.target.value)} />
                  </label>
                ))}
                <label className="dbc-span">
                  Tagline
                  <input
                    value={card.tagline || ''}
                    onChange={(e) => patchCard('tagline', e.target.value)}
                  />
                </label>
                <label className="dbc-span">
                  Address
                  <input
                    value={card.address || ''}
                    onChange={(e) => patchCard('address', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="dbc-section">
              <h2>Images</h2>
              <div className="dbc-media-grid">
                {[
                  {
                    key: 'heroDataUrl',
                    label: 'Hero photo',
                    hint: 'Wide background for the card header',
                    round: false,
                  },
                  {
                    key: 'circleDataUrl',
                    label: 'Portrait',
                    hint: 'Circular photo on Gold split layouts',
                    round: true,
                  },
                  {
                    key: 'logoDataUrl',
                    label: 'Logo',
                    hint: 'Small mark in the card corner',
                    round: false,
                  },
                ].map((item) => {
                  const src = normalizeImageSrc(card[item.key])
                  return (
                    <div key={item.key} className="dbc-media-card">
                      <div
                        className={`dbc-media-preview${item.round ? ' is-round' : ''}`}
                      >
                        {src ? (
                          <img src={src} alt="" />
                        ) : (
                          <span className="dbc-media-empty">
                            {item.round ? 'Portrait' : 'No image'}
                          </span>
                        )}
                      </div>
                      <div className="dbc-media-meta">
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                        <div className="dbc-media-actions">
                          <label className="dbc-media-upload">
                            {src ? 'Replace' : 'Upload'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                              hidden
                              onChange={(e) => {
                                onImage(item.key, e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                          {src ? (
                            <button
                              type="button"
                              className="dbc-media-clear"
                              onClick={() => clearImage(item.key)}
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  )
}

export default PlatformProfessional
