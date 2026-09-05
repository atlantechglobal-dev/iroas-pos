import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { api } from '../../lib/api'
import { prepareImageDataUrl } from '../../utils/imageFile.js'
import { QrCodePreview, downloadQrPng } from '../../components/QrCodePreview.jsx'
import {
  guestSiteUrl,
  loadOneLinkPreview,
  restaurantPublicSlug,
  saveOneLinkPreview,
} from '../../utils/guestLinks.js'
import './Brand.css'

const DISPLAY_FONTS = [
  { name: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", sans-serif', vibe: 'Modern · Clean' },
  { name: 'Playfair Display', stack: '"Playfair Display", serif', vibe: 'Luxury · Editorial' },
  { name: 'Space Grotesk', stack: '"Space Grotesk", sans-serif', vibe: 'Tech · Bold' },
  { name: 'DM Serif Display', stack: '"DM Serif Display", serif', vibe: 'Classic · Refined' },
  { name: 'Cormorant Garamond', stack: '"Cormorant Garamond", serif', vibe: 'Fine dining' },
  { name: 'Outfit', stack: '"Outfit", sans-serif', vibe: 'Friendly · Soft' },
  { name: 'Libre Baskerville', stack: '"Libre Baskerville", serif', vibe: 'Traditional' },
  { name: 'Sora', stack: '"Sora", sans-serif', vibe: 'Contemporary' },
  { name: 'Fraunces', stack: '"Fraunces", serif', vibe: 'Warm · Character' },
  { name: 'Syne', stack: '"Syne", sans-serif', vibe: 'Expressive' },
]

const BODY_FONTS = [
  { name: 'Inter', stack: 'Inter, sans-serif', vibe: 'UI default' },
  { name: 'DM Sans', stack: '"DM Sans", sans-serif', vibe: 'Readable' },
  { name: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", sans-serif', vibe: 'Matched modern' },
  { name: 'Source Sans 3', stack: '"Source Sans 3", sans-serif', vibe: 'Neutral' },
  { name: 'Nunito Sans', stack: '"Nunito Sans", sans-serif', vibe: 'Rounded soft' },
  { name: 'Lora', stack: 'Lora, serif', vibe: 'Editorial body' },
  { name: 'Manrope', stack: 'Manrope, sans-serif', vibe: 'Geometric' },
  { name: 'IBM Plex Sans', stack: '"IBM Plex Sans", sans-serif', vibe: 'Professional' },
  { name: 'Karla', stack: 'Karla, sans-serif', vibe: 'Compact' },
  { name: 'System UI', stack: 'system-ui, sans-serif', vibe: 'Native' },
]

const PALETTE_PRESETS = [
  {
    key: 'citrus',
    label: 'Citrus',
    colors: {
      primary: '#F97316',
      secondary: '#FDBA74',
      ink: '#111827',
      surface: '#FAFAFA',
      success: '#22C55E',
      warning: '#F59E0B',
    },
  },
  {
    key: 'lime',
    label: 'IROAS Lime',
    colors: {
      primary: '#8BC53F',
      secondary: '#F0F72A',
      ink: '#17171A',
      surface: '#F7F6F2',
      success: '#22C55E',
      warning: '#F59E0B',
    },
  },
  {
    key: 'noir',
    label: 'Noir',
    colors: {
      primary: '#111827',
      secondary: '#6B7280',
      ink: '#F9FAFB',
      surface: '#1F2937',
      success: '#34D399',
      warning: '#FBBF24',
    },
  },
  {
    key: 'ocean',
    label: 'Ocean',
    colors: {
      primary: '#0EA5E9',
      secondary: '#7DD3FC',
      ink: '#0C4A6E',
      surface: '#F0F9FF',
      success: '#10B981',
      warning: '#F59E0B',
    },
  },
  {
    key: 'wine',
    label: 'Wine',
    colors: {
      primary: '#9F1239',
      secondary: '#FDA4AF',
      ink: '#1C1917',
      surface: '#FFF1F2',
      success: '#15803D',
      warning: '#D97706',
    },
  },
  {
    key: 'olive',
    label: 'Olive',
    colors: {
      primary: '#5F8F5A',
      secondary: '#C4A574',
      ink: '#1C1917',
      surface: '#FAF7F2',
      success: '#3F6212',
      warning: '#B45309',
    },
  },
  {
    key: 'violet',
    label: 'Violet',
    colors: {
      primary: '#7C3AED',
      secondary: '#C4B5FD',
      ink: '#1E1B4B',
      surface: '#F5F3FF',
      success: '#059669',
      warning: '#D97706',
    },
  },
  {
    key: 'espresso',
    label: 'Espresso',
    colors: {
      primary: '#78350F',
      secondary: '#FBBF24',
      ink: '#1C1917',
      surface: '#FFFBEB',
      success: '#4D7C0F',
      warning: '#EA580C',
    },
  },
]

const DEFAULT_PALETTE = PALETTE_PRESETS[0].colors

const COLOR_FIELDS = [
  { key: 'primary', label: 'Primary', hint: 'Buttons & accents' },
  { key: 'secondary', label: 'Secondary', hint: 'Highlights' },
  { key: 'ink', label: 'Ink', hint: 'Headings & text' },
  { key: 'surface', label: 'Surface', hint: 'Backgrounds' },
  { key: 'success', label: 'Success', hint: 'Confirmations' },
  { key: 'warning', label: 'Warning', hint: 'Alerts' },
]

function ensureGoogleFonts() {
  const id = 'iroas-brand-fonts'
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;600;700&family=DM+Serif+Display&family=Fraunces:wght@600;700&family=IBM+Plex+Sans:wght@400;600;700&family=Inter:wght@400;600;700&family=Karla:wght@400;600;700&family=Libre+Baskerville:wght@400;700&family=Lora:wght@400;600;700&family=Manrope:wght@400;600;700&family=Nunito+Sans:wght@400;600;700&family=Outfit:wght@500;700&family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@500;700;800&family=Sora:wght@500;700&family=Source+Sans+3:wght@400;600;700&family=Space+Grotesk:wght@500;700&family=Syne:wght@600;700&display=swap'
  document.head.appendChild(link)
}

function fontStack(list, name) {
  return list.find((f) => f.name === name)?.stack || name
}

function Brand() {
  const toast = useToast()

  const [restaurantName, setRestaurantName] = useState('Your restaurant')
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const [coverDataUrl, setCoverDataUrl] = useState('')
  const [gallery, setGallery] = useState([])
  const [palette, setPalette] = useState(DEFAULT_PALETTE)
  const [displayFont, setDisplayFont] = useState('Plus Jakarta Sans')
  const [bodyFont, setBodyFont] = useState('Inter')
  const [activePreset, setActivePreset] = useState('citrus')
  const [saving, setSaving] = useState(false)
  const [slug, setSlug] = useState('your-restaurant')
  const [cuisine, setCuisine] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    ensureGoogleFonts()
  }, [])

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        const name = restaurant.name || 'Your restaurant'
        setRestaurantName(name)
        setSlug(restaurantPublicSlug(restaurant, 'your-restaurant'))
        setCuisine(restaurant.cuisine || '')
        setDescription(restaurant.description || '')
        if (restaurant.logo_data_url) setLogoDataUrl(restaurant.logo_data_url)
        if (restaurant.primary_color || restaurant.secondary_color || restaurant.accent_color) {
          setPalette((prev) => ({
            ...prev,
            primary: restaurant.primary_color || prev.primary,
            secondary: restaurant.secondary_color || prev.secondary,
            ink: restaurant.accent_color || prev.ink,
          }))
        }
        if (restaurant.font) setDisplayFont(restaurant.font)

        const settings = restaurant.settings || {}
        if (settings.coverDataUrl || settings.coverPhoto) {
          setCoverDataUrl(settings.coverDataUrl || settings.coverPhoto)
        }
        if (Array.isArray(settings.gallery)) setGallery(settings.gallery)
        if (settings.bodyFont) setBodyFont(settings.bodyFont)
        if (settings.brandPalette) {
          setPalette((prev) => ({ ...prev, ...settings.brandPalette }))
        }
        if (settings.brandPreset) setActivePreset(settings.brandPreset)
      })
      .catch(() => {})
  }, [])

  const menuPreviewUrl = useMemo(() => guestSiteUrl(slug, 'menu'), [slug])
  const sitePreviewUrl = useMemo(() => guestSiteUrl(slug, 'website'), [slug])
  const displayStack = fontStack(DISPLAY_FONTS, displayFont)
  const bodyStack = fontStack(BODY_FONTS, bodyFont)

  const brandPayload = useMemo(
    () => ({
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      accentColor: palette.ink,
      surfaceColor: palette.surface,
      successColor: palette.success,
      warningColor: palette.warning,
      logoDataUrl,
      coverDataUrl,
      displayFont,
      bodyFont,
      cuisine,
      description,
      phone: '',
      address: '',
    }),
    [palette, logoDataUrl, coverDataUrl, displayFont, bodyFont, cuisine, description],
  )

  // Keep guest website preview in sync as branding changes
  useEffect(() => {
    const existing = loadOneLinkPreview(slug) || {}
    saveOneLinkPreview(slug, {
      ...existing,
      restaurantName,
      headline: restaurantName,
      subheadline: description || existing.subheadline || 'Order, book a table or browse our menu.',
      brand: {
        ...(existing.brand || {}),
        ...brandPayload,
      },
    })
  }, [slug, restaurantName, description, brandPayload])

  const onLogoChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const result = await prepareImageDataUrl(file)
    if (result.error) {
      toast.error(result.error)
      event.target.value = ''
      return
    }
    setLogoDataUrl(result.dataUrl)
    toast.success('Logo updated — preview refreshed.')
  }

  const onCoverChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const result = await prepareImageDataUrl(file)
    if (result.error) {
      toast.error(result.error)
      event.target.value = ''
      return
    }
    setCoverDataUrl(result.dataUrl)
    toast.success('Cover photo updated — preview refreshed.')
  }

  const onGalleryAdd = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = await prepareImageDataUrl(file, { maxDimension: 960 })
    if (result.error) {
      toast.error(result.error)
      return
    }
    setGallery((prev) => [
      ...prev,
      { id: `g-${Date.now()}`, dataUrl: result.dataUrl, caption: '' },
    ])
    toast.success('Gallery photo added.')
  }

  const removeGalleryItem = (id) => {
    setGallery((prev) => prev.filter((g) => g.id !== id))
  }

  const updateColor = (key) => (event) => {
    let next = event.target.value.trim()
    if (!next.startsWith('#')) next = `#${next}`
    setActivePreset('custom')
    setPalette((prev) => ({ ...prev, [key]: next.slice(0, 7) }))
  }

  const applyPreset = (preset) => {
    setActivePreset(preset.key)
    setPalette({ ...preset.colors })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateBrand({
        primaryColor: palette.primary,
        secondaryColor: palette.secondary,
        accentColor: palette.ink,
        font: displayFont,
        theme: activePreset || 'modern',
        logoDataUrl: logoDataUrl || null,
      })
      await api.updateSettings({
        coverPhoto: coverDataUrl || null,
        coverDataUrl: coverDataUrl || null,
        gallery,
        bodyFont,
        brandPalette: palette,
        brandPreset: activePreset,
        displayFont,
      })
      toast.success('Branding saved across website, QR menu and One Link.')
    } catch (err) {
      toast.error(err.message || 'Unable to save branding.')
    } finally {
      setSaving(false)
    }
  }

  const openPreview = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleDownloadAssets = async () => {
    try {
      await downloadQrPng(sitePreviewUrl, `${slug}-site-QR.png`, { width: 512 })
      toast.success('QR asset downloaded.')
    } catch {
      toast.error('Unable to download brand assets.')
    }
  }

  const handleDownloadPdf = async () => {
    try {
      await downloadQrPng(sitePreviewUrl, `${slug}-table-tent-QR.png`, { width: 720 })
      toast.success('QR downloaded — print as a table tent from your device.')
    } catch {
      toast.error('Unable to download QR.')
    }
  }

  return (
    <DashboardLayout pageClassName="branding-studio-page" activeNav="branding">
      <div className="branding-studio">
        <div className="branding-main">
          <header className="branding-head">
            <div>
              <p className="branding-eyebrow">IDENTITY</p>
              <h1>Branding</h1>
              <p className="branding-desc">
                Logo, cover, colors and type drive your guest website and QR menu. Change anything —
                the preview updates instantly.
              </p>
            </div>
            <div className="branding-head-actions">
              <button type="button" className="btn-ghost" onClick={() => openPreview(sitePreviewUrl)}>
                Open website
              </button>
              <button type="button" className="btn-ghost" onClick={handleDownloadAssets}>
                ⬇ Brand assets
              </button>
              <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </header>

          <section className="branding-section">
            <h2>Visual identity</h2>
            <div className="identity-grid">
              <div className="identity-card">
                <div className="logo-stage" style={{ background: `${palette.primary}18` }}>
                  <div
                    className={`logo-circle ${logoDataUrl ? 'has-image' : ''}`}
                    style={{ background: logoDataUrl ? '#fff' : palette.primary, color: '#fff' }}
                  >
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt={`${restaurantName} logo`} />
                    ) : (
                      <span>{restaurantName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>
                <label className="replace-btn">
                  ↑ Replace logo
                  <input type="file" accept="image/*" onChange={onLogoChange} hidden />
                </label>
              </div>

              <div className="identity-card">
                <div
                  className="cover-stage"
                  style={
                    coverDataUrl
                      ? { backgroundImage: `url(${coverDataUrl})` }
                      : {
                          background: `linear-gradient(135deg, ${palette.secondary}, ${palette.primary}66)`,
                        }
                  }
                >
                  {!coverDataUrl ? <span className="cover-placeholder">Cover photo</span> : null}
                </div>
                <label className="replace-btn cover-btn">
                  🖼 Replace cover
                  <input type="file" accept="image/*" onChange={onCoverChange} hidden />
                </label>
              </div>
            </div>
          </section>

          <section className="branding-section">
            <div className="section-title-row">
              <h2>Gallery</h2>
              <p>Photos shown on your guest website home page.</p>
            </div>
            <div className="gallery-admin-grid">
              {gallery.map((g) => (
                <div className="gallery-admin-item" key={g.id}>
                  <img src={g.dataUrl} alt="" />
                  <button type="button" className="gallery-remove" onClick={() => removeGalleryItem(g.id)}>
                    Remove
                  </button>
                </div>
              ))}
              <label className="gallery-add">
                + Add photo
                <input type="file" accept="image/*" hidden onChange={onGalleryAdd} />
              </label>
            </div>
          </section>

          <section className="branding-section">
            <div className="section-title-row">
              <h2>Color palette</h2>
              <p>Presets + custom swatches for every customer touchpoint.</p>
            </div>

            <div className="preset-row">
              {PALETTE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`preset-chip ${activePreset === preset.key ? 'active' : ''}`}
                  onClick={() => applyPreset(preset)}
                >
                  <span className="preset-dots" aria-hidden="true">
                    <i style={{ background: preset.colors.primary }} />
                    <i style={{ background: preset.colors.secondary }} />
                    <i style={{ background: preset.colors.ink }} />
                  </span>
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="palette-grid">
              {COLOR_FIELDS.map((field) => (
                <label key={field.key} className="swatch-card">
                  <span className="swatch" style={{ background: palette[field.key] }} />
                  <span className="swatch-meta">
                    <strong>{field.label}</strong>
                    <em>{field.hint}</em>
                    <input
                      type="text"
                      value={palette[field.key]}
                      onChange={updateColor(field.key)}
                      spellCheck={false}
                    />
                  </span>
                  <input
                    type="color"
                    className="swatch-picker"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(palette[field.key])
                        ? palette[field.key]
                        : '#000000'
                    }
                    onChange={(e) => {
                      setActivePreset('custom')
                      setPalette((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }}
                    aria-label={`${field.label} color picker`}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="branding-section">
            <div className="section-title-row">
              <h2>Typography</h2>
              <p>More display & body pairings for your guest site.</p>
            </div>
            <div className="type-grid">
              <div className="type-card">
                <span className="type-label">DISPLAY</span>
                <select
                  value={displayFont}
                  onChange={(e) => setDisplayFont(e.target.value)}
                  style={{ fontFamily: displayStack }}
                >
                  {DISPLAY_FONTS.map((font) => (
                    <option key={font.name} value={font.name} style={{ fontFamily: font.stack }}>
                      {font.name}
                    </option>
                  ))}
                </select>
                <p>Headings & menus · {DISPLAY_FONTS.find((f) => f.name === displayFont)?.vibe}</p>
                <div className="type-sample" style={{ fontFamily: displayStack, color: palette.ink }}>
                  {restaurantName}
                </div>
              </div>
              <div className="type-card">
                <span className="type-label">BODY</span>
                <select
                  value={bodyFont}
                  onChange={(e) => setBodyFont(e.target.value)}
                  style={{ fontFamily: bodyStack }}
                >
                  {BODY_FONTS.map((font) => (
                    <option key={font.name} value={font.name} style={{ fontFamily: font.stack }}>
                      {font.name}
                    </option>
                  ))}
                </select>
                <p>UI, receipts & copy · {BODY_FONTS.find((f) => f.name === bodyFont)?.vibe}</p>
                <div className="type-sample body" style={{ fontFamily: bodyStack, color: palette.ink }}>
                  Scan to view the menu and order online.
                </div>
              </div>
            </div>
          </section>

          <section className="branding-section site-mock-section">
            <div className="section-title-row">
              <h2>Website preview</h2>
              <p>Logo, cover, palette and fonts as guests will see them.</p>
            </div>
            <div
              className="site-mock"
              style={{
                '--mock-primary': palette.primary,
                '--mock-secondary': palette.secondary,
                '--mock-ink': palette.ink,
                '--mock-surface': palette.surface,
                background: palette.surface,
                color: palette.ink,
              }}
            >
              <div
                className="site-mock-cover"
                style={
                  coverDataUrl
                    ? { backgroundImage: `url(${coverDataUrl})` }
                    : {
                        background: `linear-gradient(120deg, ${palette.primary}, ${palette.secondary})`,
                      }
                }
              >
                <div className="site-mock-brand">
                  {logoDataUrl ? (
                    <img src={logoDataUrl} alt="" />
                  ) : (
                    <span style={{ background: palette.primary }}>
                      {restaurantName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <strong style={{ fontFamily: displayStack }}>{restaurantName}</strong>
                </div>
              </div>
              <div className="site-mock-body" style={{ fontFamily: bodyStack }}>
                <p className="site-mock-eyebrow" style={{ color: palette.primary }}>
                  {cuisine || 'Restaurant'}
                </p>
                <h3 style={{ fontFamily: displayStack }}>{restaurantName}</h3>
                <p>
                  {description ||
                    'Your cover, logo and colors appear on the guest website opened from QR / One Link.'}
                </p>
                <div className="site-mock-actions">
                  <button type="button" style={{ background: palette.primary, color: '#fff' }}>
                    View menu
                  </button>
                  <button
                    type="button"
                    style={{ borderColor: palette.primary, color: palette.primary }}
                  >
                    Book a table
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="branding-preview" aria-label="QR menu preview">
          <div className="preview-head">
            <h2>QR menu preview</h2>
            <p>Branded for table tents & takeaway.</p>
          </div>

          <div
            className="qr-preview-card"
            style={{
              background: palette.surface,
              fontFamily: displayStack,
            }}
          >
            {logoDataUrl ? (
              <img className="qr-logo" src={logoDataUrl} alt="" />
            ) : null}
            <div className="qr-frame">
              <QrCodePreview
                value={sitePreviewUrl}
                size={180}
                alt="Menu QR code"
                emptyMessage="Set restaurant name to generate QR"
              />
            </div>
            <strong style={{ color: palette.ink, fontFamily: displayStack }}>{restaurantName}</strong>
            <span style={{ fontFamily: bodyStack }}>Scan to view the menu</span>
            <button
              type="button"
              className="download-pdf"
              style={{ background: palette.primary }}
              onClick={handleDownloadPdf}
            >
              ⬇ Download PDF
            </button>
          </div>

          <button type="button" className="open-menu-link" onClick={() => openPreview(menuPreviewUrl)}>
            Open live menu preview →
          </button>
          <button type="button" className="open-menu-link secondary" onClick={() => openPreview(sitePreviewUrl)}>
            Open full website →
          </button>
        </aside>
      </div>
    </DashboardLayout>
  )
}

export default Brand
