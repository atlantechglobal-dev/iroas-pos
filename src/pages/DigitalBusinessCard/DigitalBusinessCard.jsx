import { useState, useEffect } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../lib/api'
import { QrCodePreview, downloadQrPng } from '../../components/QrCodePreview.jsx'
import {
  BusinessCardVisual,
  CARD_LAYOUTS,
} from '../../components/businessCard/BusinessCardVisual.jsx'
import { prepareImageDataUrl } from '../../utils/imageFile.js'
import {
  cardDisplayHost,
  cardPublicUrl,
  restaurantPublicSlug,
  saveCardPreview,
  loadCardPreview,
} from '../../utils/guestLinks.js'
import './DigitalBusinessCard.css'

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

const EMPTY_CARD = {
  name: '',
  role: '',
  phone: '',
  email: '',
  website: '',
  insta: '',
  address: '',
  tagline: '',
  heroDataUrl: '',
  circleDataUrl: '',
  logoDataUrl: '',
}

function DigitalBusinessCard() {
  const toast = useToast()
  const { user } = useAuth()

  const [theme, setTheme] = useState('lime')
  const [layout, setLayout] = useState('split-gold')
  const [restaurantName, setRestaurantName] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [card, setCard] = useState({
    ...EMPTY_CARD,
    name: user?.name || '',
    email: user?.email || '',
  })

  const [cardSlug, setCardSlug] = useState(() =>
    restaurantPublicSlug(user?.name, 'your-card'),
  )

  useEffect(() => {
    let cancelled = false
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (cancelled) return
        if (restaurant.name) setRestaurantName(restaurant.name)

        const slug = restaurantPublicSlug(restaurant, 'your-card')
        setCardSlug(slug)
        const saved = loadCardPreview(slug)

        setTheme(saved?.theme || 'lime')
        setLayout(saved?.layout || 'split-gold')

        setCard((prev) => ({
          ...prev,
          ...(saved?.card || {}),
          name: saved?.card?.name || prev.name || user?.name || '',
          email: saved?.card?.email || prev.email || user?.email || '',
          role:
            saved?.card?.role ||
            `Owner · ${restaurant.name || 'Your restaurant'}`,
          phone: saved?.card?.phone || restaurant.phone || prev.phone,
          website: saved?.card?.website || restaurant.website || prev.website,
          address: saved?.card?.address || restaurant.address || prev.address,
          logoDataUrl:
            saved?.card?.logoDataUrl ||
            restaurant.logoDataUrl ||
            restaurant.logo_data_url ||
            prev.logoDataUrl ||
            '',
          tagline: saved?.card?.tagline || prev.tagline || '',
          heroDataUrl: saved?.card?.heroDataUrl || prev.heroDataUrl || '',
          circleDataUrl: saved?.card?.circleDataUrl || prev.circleDataUrl || '',
          insta: saved?.card?.insta || prev.insta || '',
        }))
      })
      .catch(() => {
        if (cancelled) return
        const slug = restaurantPublicSlug(user?.name, 'your-card')
        setCardSlug(slug)
        const saved = loadCardPreview(slug)
        if (saved?.theme) setTheme(saved.theme)
        if (saved?.layout) setLayout(saved.layout)
        if (saved?.card) setCard((prev) => ({ ...prev, ...saved.card }))
        if (saved?.restaurantName) setRestaurantName(saved.restaurantName)
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [user?.name, user?.email])

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const cardLink = cardDisplayHost(cardSlug)
  const previewUrl = cardPublicUrl(cardSlug)
  const colors = THEME_COLORS[theme]

  const persistCard = () => {
    saveCardPreview(cardSlug, {
      restaurantName: displayRestaurant,
      theme,
      layout,
      card,
    })
  }

  const updateField = (field) => (event) => {
    setCard((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const onImageUpload = (field) => async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = await prepareImageDataUrl(file, {
      maxBytes: 2.5 * 1024 * 1024,
      maxDimension: field === 'heroDataUrl' || field === 'circleDataUrl' ? 960 : 512,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    setCard((prev) => ({ ...prev, [field]: result.dataUrl }))
    toast.success('Image added.')
  }

  const clearImage = (field) => {
    setCard((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSave = () => {
    if (!hydrated) return
    persistCard()
    toast.success('Card changes saved.')
  }

  const persistAndOpen = () => {
    persistCard()
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDownload = async () => {
    try {
      await downloadQrPng(previewUrl, `${cardSlug}-card-QR.png`, { width: 512 })
      toast.success('QR downloaded.')
    } catch {
      toast.error('Unable to download QR. Try again.')
    }
  }

  const handleShare = () => {
    persistCard()
    navigator.clipboard
      .writeText(previewUrl)
      .then(() => toast.success('Preview link copied'))
      .catch(() => toast.info(previewUrl))
  }

  return (
    <DashboardLayout
      pageClassName="business-card-page"
      activeNav="digital-business-card"
    >
      <div className="dbc-page">
        <div className="page-head">
          <div>
            <div className="eyebrow">GROWTH</div>
            <h1>Digital Business Card</h1>
            <p>
              Restaurant-style landscape cards with your photos, contact details and QR —
              ready to share or preview for guests.
            </p>
          </div>

          <div className="page-actions">
            <button type="button" className="btn btn-ghost" onClick={persistAndOpen}>
              Preview
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleDownload}>
              Download QR
            </button>
            <button type="button" className="btn btn-primary" onClick={handleShare}>
              Share card
            </button>
          </div>
        </div>

        <div className="dbc-workspace">
          <aside className="dbc-preview" aria-label="Live business card preview">
            <div className="preview-label">LIVE PREVIEW</div>
            <BusinessCardVisual
              layout={layout}
              theme={theme}
              colors={colors}
              displayRestaurant={displayRestaurant}
              card={card}
              interactive={false}
            />

            <div className="preview-qr-strip">
              <div className="qr-box">
                <QrCodePreview
                  value={previewUrl}
                  size={100}
                  alt={`QR code for ${cardLink}`}
                  emptyMessage="QR unavailable"
                />
              </div>
              <div className="qtext">
                <strong>Scan to open</strong>
                <span>Guest card opens at your live link.</span>
                <span className="link">{cardLink}</span>
                <div className="preview-qr-actions">
                  <button type="button" className="btn-mini" onClick={persistAndOpen}>
                    Open link
                  </button>
                  <button type="button" className="btn-mini" onClick={handleDownload}>
                    Download QR
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <section className="dbc-form">
            <h2>Card details</h2>

            <div className="layout-block">
              <label>Layout</label>
              <div className="layout-options" role="listbox" aria-label="Card layout">
                {CARD_LAYOUTS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={layout === opt.id}
                    className={`layout-opt ${layout === opt.id ? 'selected' : ''} layout-thumb-${opt.id}`}
                    onClick={() => setLayout(opt.id)}
                  >
                    <span className="layout-thumb" aria-hidden="true" />
                    <span className="layout-copy">
                      <strong>{opt.label}</strong>
                      <small>{opt.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="f-name">Name</label>
                <input id="f-name" type="text" value={card.name} onChange={updateField('name')} />
              </div>

              <div className="field">
                <label htmlFor="f-role">Role / restaurant</label>
                <input id="f-role" type="text" value={card.role} onChange={updateField('role')} />
              </div>

              <div className="field full">
                <label htmlFor="f-tagline">Tagline</label>
                <input
                  id="f-tagline"
                  type="text"
                  value={card.tagline}
                  onChange={updateField('tagline')}
                  placeholder="Fresh plates · Warm welcome"
                />
              </div>

              <div className="field">
                <label htmlFor="f-phone">Phone</label>
                <input id="f-phone" type="text" value={card.phone} onChange={updateField('phone')} />
              </div>

              <div className="field">
                <label htmlFor="f-email">Email</label>
                <input id="f-email" type="text" value={card.email} onChange={updateField('email')} />
              </div>

              <div className="field">
                <label htmlFor="f-website">Website</label>
                <input
                  id="f-website"
                  type="text"
                  value={card.website}
                  onChange={updateField('website')}
                />
              </div>

              <div className="field">
                <label htmlFor="f-insta">Instagram</label>
                <input id="f-insta" type="text" value={card.insta} onChange={updateField('insta')} />
              </div>

              <div className="field full">
                <label htmlFor="f-address">Address</label>
                <input
                  id="f-address"
                  type="text"
                  value={card.address}
                  onChange={updateField('address')}
                />
              </div>
            </div>

            <div className="media-block">
              <label>Images</label>
              <div className="media-grid">
                <div className="media-field">
                  <span className="media-label">Hero photo</span>
                  <div className="media-row">
                    {card.heroDataUrl ? (
                      <img className="media-thumb" src={card.heroDataUrl} alt="" />
                    ) : (
                      <div className="media-thumb placeholder" />
                    )}
                    <div className="media-actions">
                      <label className="btn-mini file-btn">
                        Upload
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" hidden onChange={onImageUpload('heroDataUrl')} />
                      </label>
                      {card.heroDataUrl ? (
                        <button type="button" className="btn-mini" onClick={() => clearImage('heroDataUrl')}>
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="media-field">
                  <span className="media-label">Logo</span>
                  <div className="media-row">
                    {card.logoDataUrl ? (
                      <img className="media-thumb" src={card.logoDataUrl} alt="" />
                    ) : (
                      <div className="media-thumb placeholder" />
                    )}
                    <div className="media-actions">
                      <label className="btn-mini file-btn">
                        Upload
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" hidden onChange={onImageUpload('logoDataUrl')} />
                      </label>
                      {card.logoDataUrl ? (
                        <button type="button" className="btn-mini" onClick={() => clearImage('logoDataUrl')}>
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="media-field">
                  <span className="media-label">Circle inset</span>
                  <div className="media-row">
                    {card.circleDataUrl ? (
                      <img className="media-thumb round" src={card.circleDataUrl} alt="" />
                    ) : (
                      <div className="media-thumb placeholder round" />
                    )}
                    <div className="media-actions">
                      <label className="btn-mini file-btn">
                        Upload
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" hidden onChange={onImageUpload('circleDataUrl')} />
                      </label>
                      {card.circleDataUrl ? (
                        <button type="button" className="btn-mini" onClick={() => clearImage('circleDataUrl')}>
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="media-hint">Used on Gold split (and Noir if set).</p>
                </div>
              </div>
            </div>

            <div className="theme-block">
              <label>Accent theme</label>
              <div className="theme-options">
                {Object.entries(THEME_COLORS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    className={`theme-opt ${theme === key ? 'selected' : ''}`}
                    data-theme={key}
                    onClick={() => setTheme(key)}
                    style={
                      theme === key
                        ? {
                            borderColor: preset.accent,
                            color: preset.dark,
                            boxShadow: `0 0 0 1px ${preset.accent} inset`,
                          }
                        : undefined
                    }
                  >
                    <span className="swatch" style={{ background: preset.accent }} />
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
              <p className="theme-hint">Accents tint the selected layout (panel, corners, icons).</p>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Save changes
              </button>
            </div>

            <div className="info-note">
              <span className="ico" aria-hidden="true">
                *
              </span>
              <span>
                Guest preview opens at <code>/c/{cardSlug}</code>. Marketing label stays{' '}
                <code>{cardLink}</code>. Click <strong>Save changes</strong> before sharing so guests
                see the latest card.
              </span>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default DigitalBusinessCard
