import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useRestaurant } from '../../hooks/useRestaurant.js'
import { api } from '../../lib/api'
import { QrCodePreview, downloadQrPng } from '../../components/QrCodePreview.jsx'
import {
  getDefaultDestinations,
  GUEST_SITE_PAGES,
  mergeDestinationsWithDefaults,
  ONE_LINK_THEMES,
  loadOneLinkPreview,
  oneLinkDisplayHost,
  oneLinkPublicUrl,
  restaurantPublicSlug,
  sanitizeDestinations,
  saveOneLinkPreview,
  withGuestDestinationHrefs,
} from '../../utils/guestLinks.js'
import './OneLink.css'

function PhonePreview({
  displayRestaurant,
  oneLink,
  headline,
  subheadline,
  liveDestinations,
  theme,
  brand = {},
  dishPreviews = [],
}) {
  const hasCover = Boolean(brand.coverDataUrl)
  return (
    <div
      className={`phone theme-${theme.key} website-preview`}
      style={{
        '--ol-accent': brand.primaryColor || theme.accent,
        '--ol-accent-dark': theme.accentDark,
        '--ol-screen': theme.screenBg,
        '--ol-text': theme.text,
        '--ol-muted': theme.muted,
        '--ol-btn-bg': theme.buttonBg,
        '--ol-btn-text': theme.buttonText,
      }}
    >
      <div className="phone-screen">
        <div
          className={`preview-hero ${hasCover ? 'has-cover' : ''}`}
          style={hasCover ? { backgroundImage: `url(${brand.coverDataUrl})` } : undefined}
        >
          <div className="preview-hero-veil">
            <div className="preview-hero-brand">
              {brand.logoDataUrl ? (
                <img className="preview-circle-img" src={brand.logoDataUrl} alt="" />
              ) : (
                <div className="preview-circle">{displayRestaurant.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <p className="preview-cuisine">{brand.cuisine || 'Restaurant'}</p>
            <strong className="preview-title">{headline || displayRestaurant}</strong>
            <em className="preview-sub">{subheadline || 'Order, book a table or browse our menu.'}</em>
            <span className="preview-handle">{oneLink}</span>
            <div className="preview-cta-row">
              {liveDestinations
                .filter((d) => ['menu', 'order', 'book'].includes(d.key))
                .slice(0, 3)
                .map((d) => (
                  <span key={d.key} className={`preview-cta ${d.key === 'menu' ? 'primary' : ''}`}>
                    {d.name.replace('Digital ', '').replace(' Online', '')}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {dishPreviews.length > 0 ? (
          <div className="preview-dishes">
            <p className="preview-section-label">Menu</p>
            <div className="preview-dish-row">
              {dishPreviews.slice(0, 3).map((dish) => (
                <div className="preview-dish" key={dish.id || dish.name}>
                  {dish.imageDataUrl ? (
                    <img src={dish.imageDataUrl} alt="" />
                  ) : (
                    <div className="preview-dish-ph" />
                  )}
                  <span>{dish.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="preview-dishes">
            <p className="preview-section-label">The brand</p>
            <p className="preview-story-teaser">
              {brand.description || 'Explore the menu, book a table, or order online.'}
            </p>
          </div>
        )}

        <div className="powered">Powered by IROAS</div>
      </div>
    </div>
  )
}

function OneLink() {
  const toast = useToast()
  const { user } = useAuth()
  const { displayRestaurant, restaurantName } = useRestaurant()

  const [linkSlug, setLinkSlug] = useState(() =>
    restaurantPublicSlug(restaurantName || user?.name, 'your-link'),
  )
  const displayLink = oneLinkDisplayHost(linkSlug)
  const siteUrl = oneLinkPublicUrl(linkSlug)

  const saved = loadOneLinkPreview(linkSlug)

  const [destinations, setDestinations] = useState(() => {
    const raw = withGuestDestinationHrefs(
      linkSlug,
      saved?.destinations || getDefaultDestinations(linkSlug),
    )
    const cleaned = raw.filter((d) => d.key !== 'website')
    return cleaned.length ? cleaned : getDefaultDestinations(linkSlug)
  })
  const [themeKey, setThemeKey] = useState(() => saved?.themeKey || 'lime')
  const [publishLabel, setPublishLabel] = useState('✓  Publish changes')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [headline, setHeadline] = useState(() => saved?.headline || '')
  const [subheadline, setSubheadline] = useState(() => saved?.subheadline || '')
  const [brand, setBrand] = useState(() => saved?.brand || {})
  const [dishPreviews, setDishPreviews] = useState([])
  const [dragKey, setDragKey] = useState(null)
  const [customModal, setCustomModal] = useState(null) // null | { key?, name, href, meta }

  const theme = ONE_LINK_THEMES[themeKey] || ONE_LINK_THEMES.lime
  const pageHeadline = headline || `${displayRestaurant}`
  const pageSub = subheadline || 'Order, book a table or browse our menu.'

  const liveDestinations = useMemo(
    () => destinations.filter((d) => d.live && d.key !== 'website'),
    [destinations],
  )

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        const nextSlug = restaurantPublicSlug(restaurant, 'your-link')
        if (nextSlug) setLinkSlug(nextSlug)

        const settings = restaurant.settings || {}
        setBrand((prev) => ({
          ...prev,
          primaryColor: restaurant.primary_color || prev.primaryColor || '',
          secondaryColor: restaurant.secondary_color || prev.secondaryColor || '',
          accentColor: restaurant.accent_color || prev.accentColor || '',
          logoDataUrl: restaurant.logo_data_url || prev.logoDataUrl || '',
          coverDataUrl: settings.coverDataUrl || settings.coverPhoto || prev.coverDataUrl || '',
          phone: restaurant.phone || '',
          address: restaurant.address || '',
          cuisine: restaurant.cuisine || '',
          description: restaurant.description || '',
          email: restaurant.email || '',
          website: restaurant.website || '',
        }))
        if (settings.oneLinkHeadline) setHeadline(settings.oneLinkHeadline)
        else if (!headline) setHeadline(restaurant.name || '')
        if (settings.oneLinkSubheadline) setSubheadline(settings.oneLinkSubheadline)
        else if (!subheadline && (settings.tagline || restaurant.description)) {
          setSubheadline(settings.tagline || restaurant.description || '')
        }
        if (settings.oneLinkThemeKey && ONE_LINK_THEMES[settings.oneLinkThemeKey]) {
          setThemeKey(settings.oneLinkThemeKey)
        }

        const slugForDest = nextSlug || linkSlug
        let nextDest = mergeDestinationsWithDefaults(slugForDest, settings.oneLinkDestinations)
        if (restaurant.phone) {
          nextDest = nextDest.map((d) =>
            d.key === 'call'
              ? {
                  ...d,
                  meta: restaurant.phone,
                  href: `tel:${String(restaurant.phone).replace(/\s/g, '')}`,
                }
              : d,
          )
        }
        if (restaurant.address) {
          nextDest = nextDest.map((d) =>
            d.key === 'directions'
              ? {
                  ...d,
                  meta: restaurant.address,
                  href: `https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`,
                }
              : d,
          )
        }
        if (settings.instagram) {
          nextDest = nextDest.map((d) =>
            d.key === 'instagram'
              ? {
                  ...d,
                  meta: settings.instagram,
                  href: String(settings.instagram).startsWith('http')
                    ? settings.instagram
                    : `https://instagram.com/${String(settings.instagram).replace(/^@/, '')}`,
                }
              : d,
          )
        }
        if (settings.googleBusiness || settings.googleReviewUrl) {
          const reviewUrl = settings.googleReviewUrl || settings.googleBusiness
          nextDest = nextDest.map((d) =>
            d.key === 'review'
              ? {
                  ...d,
                  href: String(reviewUrl).startsWith('http') ? reviewUrl : `https://${reviewUrl}`,
                  meta: 'Google reviews',
                }
              : d,
          )
        }
        setDestinations(nextDest)
      })
      .catch(() => {})

    Promise.allSettled([api.getPublicSite(linkSlug), api.getPublicMenu(linkSlug)]).then(
      ([siteRes, menuRes]) => {
        if (siteRes.status === 'fulfilled') {
          const site = siteRes.value
          setBrand((prev) => ({
            ...prev,
            primaryColor: site.brand?.primaryColor || prev.primaryColor,
            logoDataUrl: site.brand?.logoDataUrl || prev.logoDataUrl,
            coverDataUrl: site.brand?.coverDataUrl || prev.coverDataUrl,
            cuisine: site.restaurant?.cuisine || prev.cuisine,
            description: site.restaurant?.description || prev.description,
          }))
          if (!headline && site.restaurant?.name) setHeadline(site.restaurant.name)
          if (!subheadline && site.restaurant?.tagline) setSubheadline(site.restaurant.tagline)
        }

        const categories =
          menuRes.status === 'fulfilled'
            ? menuRes.value.categories || menuRes.value.menu || []
            : siteRes.status === 'fulfilled'
              ? siteRes.value.menu || []
              : []
        const dishes = categories
          .flatMap((cat) => cat.items || [])
          .filter((item) => item.imageDataUrl)
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            name: item.name,
            imageDataUrl: item.imageDataUrl,
          }))
        setDishPreviews(dishes)
      },
    )
  }, [])

  const previewPayload = useMemo(
    () => ({
      restaurantName: displayRestaurant,
      headline: pageHeadline,
      subheadline: pageSub,
      themeKey,
      destinations: withGuestDestinationHrefs(
        linkSlug,
        destinations.filter((d) => d.key !== 'website'),
      ),
      brand,
    }),
    [displayRestaurant, pageHeadline, pageSub, themeKey, destinations, brand, linkSlug],
  )

  useEffect(() => {
    saveOneLinkPreview(linkSlug, previewPayload)
  }, [linkSlug, previewPayload])

  const persistAndOpen = (url = siteUrl) => {
    saveOneLinkPreview(linkSlug, previewPayload)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const persistDestinationsToApi = async (list = destinations) => {
    await api.updateSettings({
      oneLinkDestinations: sanitizeDestinations(list),
      oneLinkThemeKey: themeKey,
      oneLinkHeadline: pageHeadline,
      oneLinkSubheadline: pageSub,
    })
  }

  const toggleDestination = (key) => {
    setDestinations((prev) => {
      const next = prev.map((destination) =>
        destination.key === key
          ? { ...destination, live: !destination.live }
          : destination,
      )
      persistDestinationsToApi(next).catch(() =>
        toast.error('Could not sync destination. Try Publish.'),
      )
      return next
    })
  }

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(siteUrl)
      .then(() => toast.success('Website link copied!'))
      .catch(() => toast.error('Unable to copy link.'))
  }

  const handlePublish = async () => {
    saveOneLinkPreview(linkSlug, previewPayload)
    setPublishLabel('Publishing…')
    try {
      await persistDestinationsToApi()
      setPublishLabel('✓ Published')
      toast.success('Website destinations published.')
    } catch (err) {
      toast.error(err.message || 'Unable to publish destinations.')
      setPublishLabel('✓  Publish changes')
      return
    }
    setTimeout(() => setPublishLabel('✓  Publish changes'), 2000)
  }

  const handleDownloadQR = async () => {
    try {
      await downloadQrPng(siteUrl, `${linkSlug}-website-QR.png`, { width: 512 })
      toast.success('QR downloaded.')
    } catch {
      toast.error('Unable to download QR.')
    }
  }

  const handleAddCustomLink = () => {
    setCustomModal({ key: '', name: '', href: 'https://', meta: 'Custom link' })
  }

  const saveCustomModal = () => {
    if (!customModal) return
    const name = String(customModal.name || '').trim() || 'Custom Link'
    let href = String(customModal.href || '').trim()
    if (href && !/^https?:\/\//i.test(href) && !href.startsWith('tel:') && !href.startsWith('mailto:')) {
      href = `https://${href}`
    }
    if (!href || href === 'https://') {
      toast.error('Enter a valid URL for the custom link.')
      return
    }
    setDestinations((prev) => {
      let next
      if (customModal.key) {
        next = prev.map((d) =>
          d.key === customModal.key
            ? { ...d, name, href, meta: customModal.meta || href }
            : d,
        )
      } else {
        next = [
          ...prev,
          {
            key: `custom-${Date.now()}`,
            icon: '/images/domain.png',
            name,
            meta: customModal.meta || 'Custom link',
            href,
            clicks: '0 clicks',
            live: true,
          },
        ]
      }
      persistDestinationsToApi(next).catch(() => {})
      return next
    })
    setCustomModal(null)
    toast.success(customModal.key ? 'Custom link updated.' : 'Custom link added.')
  }

  const removeCustomLink = (key) => {
    if (GUEST_SITE_PAGES[key] || ['review', 'instagram', 'directions', 'call'].includes(key)) {
      return
    }
    setDestinations((prev) => {
      const next = prev.filter((d) => d.key !== key)
      persistDestinationsToApi(next).catch(() => {})
      return next
    })
  }

  const onDragStart = (key) => setDragKey(key)
  const onDragOver = (event) => event.preventDefault()
  const onDrop = (targetKey) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null)
      return
    }
    setDestinations((prev) => {
      const from = prev.findIndex((d) => d.key === dragKey)
      const to = prev.findIndex((d) => d.key === targetKey)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      persistDestinationsToApi(next).catch(() => {})
      return next
    })
    setDragKey(null)
  }

  const openPreviewModal = () => setPreviewOpen(true)

  return (
    <DashboardLayout pageClassName="one-link-page" activeNav="one-link">
      <section className="one-link-page-inner">
        <div className="page-title">
          <div className="heading-text">
            <div className="growth-label">GROWTH</div>
            <h1>One Link</h1>
            <p>
              One shareable website link for your restaurant — menu, ordering,
              bookings and socials.
              <br />
              Put it in your bio, on receipts and on table cards.
            </p>
          </div>

          <div className="title-buttons">
            <button type="button" className="download-qr" onClick={handleDownloadQR}>
              <img src="/images/down.png" alt="" />
              Download QR
            </button>
            <button type="button" className="download-qr" onClick={() => persistAndOpen()}>
              Preview
            </button>
            <button type="button" className="publish-button" onClick={handlePublish}>
              {publishLabel}
            </button>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="left-column">
            <div className="card link-card">
              <div className="card-title">
                <img src="/images/domain.png" alt="" />
                <strong>Your website link</strong>
              </div>

              <div className="link-row">
                <div className="link-field" title={siteUrl}>
                  {displayLink}
                </div>

                <button type="button" className="small-button" onClick={handleCopyLink}>
                  <img src="/images/copy.svg" alt="" />
                  <span>Copy</span>
                </button>

                <button type="button" className="small-button" onClick={() => persistAndOpen()}>
                  <img src="/images/eyee.svg" alt="" />
                  <span>Preview</span>
                </button>
              </div>

              <div className="available">
                QR and link open your restaurant website at <code>/s/{linkSlug}</code>. Toggle
                destinations below to show Menu, Order, Book and more on that site.
              </div>

              <div className="one-link-qr-row">
                <QrCodePreview value={siteUrl} size={112} alt="Website QR" />
                <div>
                  <strong>Scan preview</strong>
                  <p>
                    One link only — guests land on your website. Live destinations control what
                    they can open from there.
                  </p>
                  <div className="one-link-qr-actions">
                    <button type="button" className="open-link-btn" onClick={() => persistAndOpen()}>
                      Open website
                    </button>
                  </div>
                </div>
              </div>

              <div className="stats">
                <div className="stat-box">
                  <span>Total views</span>
                  <strong>18,204</strong>
                </div>
                <div className="stat-box">
                  <span>Link clicks (30d)</span>
                  <strong>9,842</strong>
                </div>
                <div className="stat-box">
                  <span>Click-through</span>
                  <strong>54%</strong>
                </div>
              </div>
            </div>

            <div className="card destinations-card">
              <div className="destinations-header">
                <div>
                  <h2>Destinations</h2>
                  <p>
                    Toggle to show or hide on your website. Drag to reorder sections and footer
                    links.
                  </p>
                </div>
                <button type="button" className="add-link" onClick={handleAddCustomLink}>
                  + Add custom link
                </button>
              </div>

              <div className="destination-list">
                {destinations.map((destination) => {
                  const isCustom =
                    !GUEST_SITE_PAGES[destination.key] &&
                    !['review', 'instagram', 'directions', 'call'].includes(destination.key)
                  const isLive = Boolean(destination.live)
                  const meta = destination.meta || destination.href || ''
                  const clicks =
                    typeof destination.clicks === 'number'
                      ? destination.clicks.toLocaleString()
                      : destination.clicks
                  return (
                    <div
                      className={`destination${dragKey === destination.key ? ' dragging' : ''}${
                        isLive ? '' : ' is-hidden'
                      }`}
                      key={destination.key}
                      draggable
                      onDragStart={() => onDragStart(destination.key)}
                      onDragOver={onDragOver}
                      onDrop={() => onDrop(destination.key)}
                      onDragEnd={() => setDragKey(null)}
                    >
                      <button
                        type="button"
                        className="drag"
                        title="Drag to reorder"
                        aria-label={`Reorder ${destination.name}`}
                        tabIndex={-1}
                      >
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </button>
                      <div className="destination-icon" aria-hidden="true">
                        <img src={destination.icon} alt="" />
                      </div>
                      <div className="destination-content">
                        <div className="destination-name">
                          <span className="destination-title">{destination.name}</span>
                          <span className={isLive ? 'live' : 'hidden'}>
                            {isLive ? 'Live' : 'Hidden'}
                          </span>
                        </div>
                        <small title={meta}>{meta}</small>
                      </div>
                      <span className="click-number">{clicks} clicks</span>
                      <div className="destination-actions">
                        {isCustom ? (
                          <>
                            <button
                              type="button"
                              className="dest-text-btn"
                              onClick={() =>
                                setCustomModal({
                                  key: destination.key,
                                  name: destination.name,
                                  href: destination.href,
                                  meta: destination.meta,
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="dest-text-btn danger"
                              onClick={() => removeCustomLink(destination.key)}
                            >
                              Remove
                            </button>
                          </>
                        ) : null}
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={isLive}
                          onChange={() => toggleDestination(destination.key)}
                          aria-label={`${isLive ? 'Hide' : 'Show'} ${destination.name} on website`}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card appearance-card">
              <h2>Appearance & SEO</h2>

              <div className="input-grid">
                <div className="input-group">
                  <label htmlFor="ol-headline">Page headline</label>
                  <input
                    id="ol-headline"
                    type="text"
                    value={headline}
                    placeholder={displayRestaurant}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="ol-sub">Sub headline</label>
                  <input
                    id="ol-sub"
                    type="text"
                    value={subheadline}
                    placeholder="Modern dining, served slowly"
                    onChange={(e) => setSubheadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Preview theme</label>
                <div className="theme-buttons">
                  {Object.values(ONE_LINK_THEMES).map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className={`theme ${themeKey === preset.key ? 'active' : ''}`}
                      onClick={() => setThemeKey(preset.key)}
                      style={
                        themeKey === preset.key
                          ? {
                              background: preset.accent,
                              color: preset.key === 'ivory' ? '#2c2418' : '#fff',
                              borderColor: preset.accentDark,
                            }
                          : undefined
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="theme-hint">Theme colors tint the live preview.</p>
              </div>
            </div>
          </div>

          <aside className="one-link-preview-panel card" aria-label="Live preview">
            <div className="preview-panel-head">
              <h2>Live preview</h2>
              <button type="button" className="small-button" onClick={() => persistAndOpen()}>
                Open
              </button>
            </div>
            <PhonePreview
              displayRestaurant={displayRestaurant}
              oneLink={displayLink}
              headline={pageHeadline}
              subheadline={pageSub}
              liveDestinations={liveDestinations}
              theme={theme}
              brand={brand}
              dishPreviews={dishPreviews}
            />
            <button type="button" className="expand-preview-btn" onClick={openPreviewModal}>
              Expand panel
            </button>
          </aside>
        </div>
      </section>

      {previewOpen ? (
        <div className="one-link-modal" role="dialog" aria-modal="true" aria-label="Website preview">
          <div className="one-link-modal-backdrop" onClick={() => setPreviewOpen(false)} />
          <div className="one-link-modal-card">
            <div className="one-link-modal-head">
              <div>
                <p className="growth-label">PREVIEW</p>
                <h3>{pageHeadline}</h3>
                <span>{siteUrl}</span>
              </div>
              <button type="button" className="modal-close" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>
            <div className="one-link-modal-body">
              <PhonePreview
                displayRestaurant={displayRestaurant}
                oneLink={displayLink}
                headline={pageHeadline}
                subheadline={pageSub}
                liveDestinations={liveDestinations}
                theme={theme}
                brand={brand}
                dishPreviews={dishPreviews}
              />
              <div className="modal-qr">
                <QrCodePreview value={siteUrl} size={160} alt="Website QR" />
                <p>Open your restaurant website in a new tab.</p>
                <div className="modal-actions">
                  <button type="button" className="download-qr" onClick={handleDownloadQR}>
                    Download QR
                  </button>
                  <button type="button" className="publish-button" onClick={() => persistAndOpen()}>
                    Open website
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {customModal ? (
        <div className="one-link-modal" role="dialog" aria-modal="true" aria-label="Custom link">
          <div className="one-link-modal-backdrop" onClick={() => setCustomModal(null)} />
          <div className="one-link-modal-card custom-link-modal">
            <div className="one-link-modal-head">
              <div>
                <p className="growth-label">DESTINATION</p>
                <h3>{customModal.key ? 'Edit custom link' : 'Add custom link'}</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setCustomModal(null)}>
                Close
              </button>
            </div>
            <div className="custom-link-fields">
              <label>
                Label
                <input
                  value={customModal.name}
                  onChange={(e) => setCustomModal((m) => ({ ...m, name: e.target.value }))}
                  placeholder="WhatsApp / Catering / Reservations…"
                />
              </label>
              <label>
                URL
                <input
                  value={customModal.href}
                  onChange={(e) => setCustomModal((m) => ({ ...m, href: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <label>
                Subtitle
                <input
                  value={customModal.meta}
                  onChange={(e) => setCustomModal((m) => ({ ...m, meta: e.target.value }))}
                  placeholder="Shown under the label"
                />
              </label>
              <button type="button" className="publish-button" onClick={saveCustomModal}>
                {customModal.key ? 'Save link' : 'Add link'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default OneLink
