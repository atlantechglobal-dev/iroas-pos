import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { prepareImageDataUrl } from '../../utils/imageFile.js'
import { COUNTRY_OPTIONS, TIMEZONE_OPTIONS } from '../../constants/locales.js'
import './RestaurantProfile.css'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const defaultHours = [
  { day: 'Mon', open: '', close: '', closed: true },
  { day: 'Tue', open: '11:00', close: '23:30', closed: false },
  { day: 'Wed', open: '11:00', close: '23:30', closed: false },
  { day: 'Thu', open: '11:00', close: '23:30', closed: false },
  { day: 'Fri', open: '11:00', close: '23:30', closed: false },
  { day: 'Sat', open: '11:00', close: '23:30', closed: false },
  { day: 'Sun', open: '11:00', close: '23:30', closed: false },
]

const TABS = [
  { key: 'basic', label: 'Basic info' },
  { key: 'hours', label: 'Hours & timezone' },
  { key: 'tax', label: 'Tax & legal' },
  { key: 'social', label: 'Social links' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'brand', label: 'Brand media' },
  { key: 'team', label: 'Team access' },
  { key: 'billing', label: 'Billing' },
  { key: 'notifications', label: 'Notifications' },
]

function TabSvg({ name }) {
  switch (name) {
    case 'basic':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    case 'hours':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'tax':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    case 'social':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'delivery':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'brand':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    case 'team':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'billing':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      )
    case 'notifications':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    default:
      return null
  }
}

function RestaurantProfile() {
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('basic')
  const [saving, setSaving] = useState(false)
  const [editingContact, setEditingContact] = useState(false)
  const [displayName, setDisplayName] = useState('Saffron & Fig')
  const [displayStatus, setDisplayStatus] = useState('Downtown · Open')

  const [name, setName] = useState('Saffron & Fig')
  const [legalEntity, setLegalEntity] = useState('Saffron Hospitality Pvt Ltd')
  const [cuisine, setCuisine] = useState('Modern Indian - Mediterranean')
  const [priceRange, setPriceRange] = useState('₹₹₹ · 800–1500 / head')
  const [tagline, setTagline] = useState('A coastal kitchen, with fire and saffron')
  const [yearEstablished, setYearEstablished] = useState('2019')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('14 Bandstand Promenade, Muml')
  const [phone, setPhone] = useState('+91 98200 12345')
  const [email, setEmail] = useState('hello@saffronandfig.in')
  const [website, setWebsite] = useState('saffronandfig.in')
  const [hours, setHours] = useState(defaultHours)
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [lastOrderCutoff, setLastOrderCutoff] = useState('22:45')
  const [pauseOrders, setPauseOrders] = useState(false)
  const [honorHolidays, setHonorHolidays] = useState(true)
  const [city, setCity] = useState('Mumbai')
  const [country, setCountry] = useState('India')
  const [gstin, setGstin] = useState('27ABCDE1234F1Z5')
  const [pan, setPan] = useState('ABCDE1234F')
  const [fssai, setFssai] = useState('11522016000123')
  const [cgst, setCgst] = useState('2.5%')
  const [sgst, setSgst] = useState('2.5%')
  const [serviceCharge, setServiceCharge] = useState('0%')
  const [currency, setCurrency] = useState('INR (₹)')
  const [rounding, setRounding] = useState('Nearest ₹1')
  const [invoicePrefix, setInvoicePrefix] = useState('SF-2026-')
  const [instagram, setInstagram] = useState('@saffronandfig')
  const [facebook, setFacebook] = useState('facebook.com/saffronandfig')
  const [twitter, setTwitter] = useState('@saffronandfig')
  const [youtube, setYoutube] = useState('youtube.com/@saffronandfig')
  const [googleBusiness, setGoogleBusiness] = useState('g.page/saffronandfig')
  const [tripadvisor, setTripadvisor] = useState('tripadvisor.com/saffronandfig')
  const [deliveryRadius, setDeliveryRadius] = useState('')
  const [deliveryMinOrder, setDeliveryMinOrder] = useState('')
  const [deliveryBaseFee, setDeliveryBaseFee] = useState('')
  const [deliveryPerKmFee, setDeliveryPerKmFee] = useState('')
  const [deliveryFreeAbove, setDeliveryFreeAbove] = useState('')
  const [deliveryPrepTime, setDeliveryPrepTime] = useState('')
  const [channelInHouse, setChannelInHouse] = useState(true)
  const [channelZomato, setChannelZomato] = useState(true)
  const [channelSwiggy, setChannelSwiggy] = useState(true)
  const [channelDunzo, setChannelDunzo] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState(null)
  const [coverPhoto, setCoverPhoto] = useState(null)
  const [ogImage, setOgImage] = useState(null)
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [smsNotifs, setSmsNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [whatsappNotifs, setWhatsappNotifs] = useState(false)
  const [newOrderAlert, setNewOrderAlert] = useState(true)
  const [cancelOrderAlert, setCancelOrderAlert] = useState(true)
  const [lowStockAlert, setLowStockAlert] = useState(true)
  const [eodReportAlert, setEodReportAlert] = useState(true)
  const [profileSetup, setProfileSetup] = useState({})

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) {
          setName(restaurant.name)
          setDisplayName(restaurant.name)
        }
        if (restaurant.cuisine) setCuisine(restaurant.cuisine)
        if (restaurant.description) setDescription(restaurant.description)
        if (restaurant.phone) setPhone(restaurant.phone)
        if (restaurant.website) setWebsite(restaurant.website)
        if (restaurant.email) setEmail(restaurant.email)
        if (restaurant.city) setCity(restaurant.city)
        if (restaurant.country) setCountry(restaurant.country)
        if (restaurant.timezone) {
          setTimezone(String(restaurant.timezone).split(' ')[0])
        }
        if (restaurant.address) setAddress(restaurant.address)
        if (restaurant.logo_data_url) setLogoDataUrl(restaurant.logo_data_url)

        let parsedHours = null
        if (restaurant.operating_hours) {
          try {
            parsedHours = JSON.parse(restaurant.operating_hours)
            setHours(parsedHours)
          } catch {
            // keep defaults
          }
        }

        const settings = restaurant.settings || {}
        if (settings.legalEntity) setLegalEntity(settings.legalEntity)
        if (settings.priceRange) setPriceRange(settings.priceRange)
        if (settings.tagline) setTagline(settings.tagline)
        if (settings.yearEstablished) setYearEstablished(settings.yearEstablished)
        if (settings.gstin) setGstin(settings.gstin)
        if (settings.pan) setPan(settings.pan)
        if (settings.fssai) setFssai(settings.fssai)
        if (settings.cgst) setCgst(settings.cgst)
        if (settings.sgst) setSgst(settings.sgst)
        if (settings.serviceCharge !== undefined) setServiceCharge(settings.serviceCharge)
        if (settings.currency) setCurrency(settings.currency)
        if (settings.rounding) setRounding(settings.rounding)
        if (settings.invoicePrefix) setInvoicePrefix(settings.invoicePrefix)
        if (settings.instagram) setInstagram(settings.instagram)
        if (settings.facebook) setFacebook(settings.facebook)
        if (settings.twitter) setTwitter(settings.twitter)
        if (settings.youtube) setYoutube(settings.youtube)
        if (settings.googleBusiness) setGoogleBusiness(settings.googleBusiness)
        if (settings.tripadvisor) setTripadvisor(settings.tripadvisor)
        if (settings.lastOrderCutoff) setLastOrderCutoff(settings.lastOrderCutoff)
        if (settings.pauseOrders !== undefined) setPauseOrders(settings.pauseOrders)
        if (settings.honorHolidays !== undefined) setHonorHolidays(settings.honorHolidays)
        if (settings.deliveryRadius) setDeliveryRadius(settings.deliveryRadius)
        if (settings.deliveryMinOrder) setDeliveryMinOrder(settings.deliveryMinOrder)
        if (settings.deliveryBaseFee) setDeliveryBaseFee(settings.deliveryBaseFee)
        if (settings.deliveryPerKmFee) setDeliveryPerKmFee(settings.deliveryPerKmFee)
        if (settings.deliveryFreeAbove) setDeliveryFreeAbove(settings.deliveryFreeAbove)
        if (settings.deliveryPrepTime) setDeliveryPrepTime(settings.deliveryPrepTime)
        if (settings.channelInHouse !== undefined) setChannelInHouse(settings.channelInHouse)
        if (settings.channelZomato !== undefined) setChannelZomato(settings.channelZomato)
        if (settings.channelSwiggy !== undefined) setChannelSwiggy(settings.channelSwiggy)
        if (settings.channelDunzo !== undefined) setChannelDunzo(settings.channelDunzo)
        if (settings.coverPhoto) setCoverPhoto(settings.coverPhoto)
        if (settings.ogImage) setOgImage(settings.ogImage)
        if (settings.emailNotifs !== undefined) setEmailNotifs(settings.emailNotifs)
        if (settings.smsNotifs !== undefined) setSmsNotifs(settings.smsNotifs)
        if (settings.pushNotifs !== undefined) setPushNotifs(settings.pushNotifs)
        if (settings.whatsappNotifs !== undefined) setWhatsappNotifs(settings.whatsappNotifs)
        if (settings.newOrderAlert !== undefined) setNewOrderAlert(settings.newOrderAlert)
        if (settings.cancelOrderAlert !== undefined) setCancelOrderAlert(settings.cancelOrderAlert)
        if (settings.lowStockAlert !== undefined) setLowStockAlert(settings.lowStockAlert)
        if (settings.eodReportAlert !== undefined) setEodReportAlert(settings.eodReportAlert)

        const savedSetup =
          settings.profileSetup && typeof settings.profileSetup === 'object'
            ? { ...settings.profileSetup }
            : {}
        const seeded = { ...savedSetup }
        if (seeded.basic == null && restaurant.name && restaurant.address) seeded.basic = true
        if (seeded.hours == null && Array.isArray(parsedHours) && parsedHours.length) seeded.hours = true
        if (seeded.tax == null && (settings.gstin || settings.pan || settings.fssai)) seeded.tax = true
        if (seeded.social == null && (settings.instagram || settings.facebook || settings.twitter)) {
          seeded.social = true
        }
        if (seeded.delivery == null && settings.deliveryRadius) seeded.delivery = true
        if (seeded.brand == null && (restaurant.logo_data_url || settings.coverPhoto)) seeded.brand = true
        if (seeded.notifications == null && settings.emailNotifs !== undefined) seeded.notifications = true
        setProfileSetup(seeded)
      })
      .catch(() => {})
  }, [])

  const updateHour = (index, field, value) => {
    setHours((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const setupSections = TABS.map((tab) => ({
    key: tab.key,
    label: tab.key === 'delivery' ? 'Delivery radius' : tab.label,
    done: Boolean(profileSetup[tab.key]),
  }))

  const completedCount = setupSections.filter((section) => section.done).length
  const progressPct = Math.round((completedCount / setupSections.length) * 100)

  const readFileAsDataUrl = async (file, setter) => {
    const result = await prepareImageDataUrl(file)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setter(result.dataUrl)
  }

  const buildSettingsPayload = (nextSetup) => ({
    legalEntity,
    priceRange,
    tagline,
    yearEstablished,
    gstin,
    pan,
    fssai,
    cgst,
    sgst,
    serviceCharge,
    currency,
    rounding,
    invoicePrefix,
    instagram,
    facebook,
    twitter,
    youtube,
    googleBusiness,
    tripadvisor,
    lastOrderCutoff,
    pauseOrders,
    honorHolidays,
    deliveryRadius,
    deliveryMinOrder,
    deliveryBaseFee,
    deliveryPerKmFee,
    deliveryFreeAbove,
    deliveryPrepTime,
    channelInHouse,
    channelZomato,
    channelSwiggy,
    channelDunzo,
    coverPhoto,
    ogImage,
    emailNotifs,
    smsNotifs,
    pushNotifs,
    whatsappNotifs,
    newOrderAlert,
    cancelOrderAlert,
    lowStockAlert,
    eodReportAlert,
    profileSetup: nextSetup,
  })

  const saveProfile = async ({ markTab, goNext } = {}) => {
    setSaving(true)
    try {
      const nextSetup = markTab
        ? { ...profileSetup, [markTab]: true }
        : { ...profileSetup, [activeTab]: true }

      await api.updateProfile({
        restaurantName: name,
        cuisine,
        description,
        phone,
        website,
        email,
        city,
        country,
        timezone,
        address,
        hours,
      })
      await api.updateSettings(buildSettingsPayload(nextSetup))
      if (logoDataUrl) {
        await api.updateBrand({ logoDataUrl })
      }

      setProfileSetup(nextSetup)
      setDisplayName(name)

      if (goNext && markTab) {
        const idx = TABS.findIndex((t) => t.key === markTab)
        const next = TABS[idx + 1]
        if (next) {
          setActiveTab(next.key)
          toast.success(`${TABS[idx].label} saved — continue to ${next.label}.`)
        } else {
          toast.success('Restaurant profile complete — 100%.')
        }
      } else {
        toast.success('Restaurant profile saved.')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => saveProfile({ markTab: activeTab, goNext: false })

  const handleSaveAndContinue = () => saveProfile({ markTab: activeTab, goNext: true })

  const tabActions = (
    <div className="tab-actions">
      <button
        type="button"
        className="btn-save-continue"
        disabled={saving}
        onClick={handleSaveAndContinue}
      >
        {saving
          ? 'Saving…'
          : activeTab === TABS[TABS.length - 1].key
            ? 'Save and finish'
            : 'Save and continue'}
      </button>
    </div>
  )

  return (
    <DashboardLayout pageClassName="restaurant-profile-page" activeNav="restaurant-profile">
<div className="page-head">
              <div>
                <p className="eyebrow">SETUP</p>
                <h1>Restaurant profile</h1>
                <p className="page-desc">
                  Your restaurant's identity, hours, tax and contact info—shared across POS, online ordering and bookings.
                </p>
              </div>

              <button className="btn-save" type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>

            {/* SETUP PROGRESS */}
            <div className="progress-card">
              <div className="progress-head">
                <div>
                  <strong>Setup progress</strong>
                  <span>{completedCount} of {setupSections.length} sections complete</span>
                </div>
                <div className="progress-pct">{progressPct}%</div>
              </div>

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="progress-pills">
                {setupSections.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    className={`progress-pill ${section.done ? 'done' : ''}`}
                    onClick={() => setActiveTab(section.key)}
                  >
                    <span className="pill-dot">{section.done && '✓'}</span>
                    {section.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SUB-NAVIGATION TAB BAR */}
            <div className="tab-bar">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <TabSvg name={tab.key} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB 1: BASIC INFO */}
            {activeTab === 'basic' && (
              <>
              <div className="panel-grid">
                <section className="panel">
                  <h2>Identity</h2>
                  <p className="panel-sub">Visible to customers across POS, web and bookings</p>

                  <div className="field-grid">
                    <div className="field">
                      <label>RESTAURANT NAME</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Saffron & Fig" />
                    </div>
                    <div className="field">
                      <label>LEGAL ENTITY</label>
                      <input type="text" value={legalEntity} onChange={(e) => setLegalEntity(e.target.value)} placeholder="Saffron Hospitality Pvt Ltd" />
                    </div>
                    <div className="field">
                      <label>CUISINE</label>
                      <input type="text" value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Modern Indian - Mediterranean" />
                    </div>
                    <div className="field">
                      <label>PRICE RANGE</label>
                      <input type="text" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder="₹₹₹ · 800–1500 / head" />
                    </div>
                    <div className="field">
                      <label>TAGLINE</label>
                      <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A coastal kitchen, with fire and saffron" />
                    </div>
                    <div className="field">
                      <label>YEAR ESTABLISHED</label>
                      <input type="text" value={yearEstablished} onChange={(e) => setYearEstablished(e.target.value)} placeholder="2019" />
                    </div>
                    <div className="field">
                      <label>CITY</label>
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
                    </div>
                    <div className="field">
                      <label>COUNTRY</label>
                      <select value={country} onChange={(e) => setCountry(e.target.value)}>
                        <option value="">Select country</option>
                        {COUNTRY_OPTIONS.map((option) => (
                          <option key={option.code} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field full">
                      <label>ABOUT</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="" />
                    </div>
                  </div>
                </section>

                <aside className="panel">
                  <h2>Contact</h2>

                  <div className="contact-list">
                    {editingContact ? (
                      <>
                        <div className="field">
                          <label>ADDRESS</label>
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Street, area, city"
                          />
                        </div>
                        <div className="field">
                          <label>PHONE</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 …"
                          />
                        </div>
                        <div className="field">
                          <label>EMAIL</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="hello@restaurant.com"
                          />
                        </div>
                        <div className="field">
                          <label>WEBSITE</label>
                          <input
                            type="text"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="yourrestaurant.com"
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-edit-contact done"
                          disabled={saving}
                          onClick={async () => {
                            setSaving(true)
                            try {
                              await api.updateProfile({
                                restaurantName: name,
                                cuisine,
                                description,
                                phone,
                                website,
                                email,
                                city,
                                country,
                                timezone,
                                address,
                                hours,
                              })
                              setEditingContact(false)
                              toast.success('Contact saved.')
                            } catch (err) {
                              toast.error(err.message || 'Unable to save contact.')
                            } finally {
                              setSaving(false)
                            }
                          }}
                        >
                          {saving ? 'Saving…' : 'Save contact'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="contact-item">
                          <div className="contact-ico-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 1a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                              <circle cx="12" cy="9" r="3" />
                            </svg>
                          </div>
                          <div className="contact-details">
                            <label>ADDRESS</label>
                            <span>{address || '—'}</span>
                          </div>
                        </div>

                        <div className="contact-item">
                          <div className="contact-ico-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                          </div>
                          <div className="contact-details">
                            <label>PHONE</label>
                            <span>{phone || '—'}</span>
                          </div>
                        </div>

                        <div className="contact-item">
                          <div className="contact-ico-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                          </div>
                          <div className="contact-details">
                            <label>EMAIL</label>
                            <span>{email || '—'}</span>
                          </div>
                        </div>

                        <div className="contact-item">
                          <div className="contact-ico-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                          </div>
                          <div className="contact-details">
                            <label>WEBSITE</label>
                            <span>{website || '—'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-edit-contact"
                          onClick={() => setEditingContact(true)}
                        >
                          Edit contact
                        </button>
                      </>
                    )}
                  </div>
                </aside>
              </div>
              {tabActions}
              </>
            )}

            {/* TAB 2: HOURS & TIMEZONE */}
            {activeTab === 'hours' && (
              <>
              <div className="panel-grid">
                <section className="panel">
                  <h2>Operating hours</h2>
                  <p className="panel-sub">Service hours per day, with optional split shifts</p>

                  <div className="hours-table">
                    {hours.map((row, index) => (
                      <div className="hours-day-block" key={row.day}>
                        <div className="hours-day-name">{row.day}</div>
                        <div className="hours-inputs">
                          <input
                            type="text"
                            placeholder="Open"
                            value={row.open}
                            disabled={row.closed}
                            onChange={(e) => updateHour(index, 'open', e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Close"
                            value={row.close}
                            disabled={row.closed}
                            onChange={(e) => updateHour(index, 'close', e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className={`status-tag ${row.closed ? 'closed' : 'open'}`}
                          onClick={() => updateHour(index, 'closed', !row.closed)}
                        >
                          {row.closed ? 'Closed' : 'Open'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="panel">
                  <h2>Timezone & holidays</h2>

                  <div className="field" style={{ marginBottom: '16px' }}>
                    <label>TIME ZONE</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      <option value="">Select time zone</option>
                      {TIMEZONE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ marginBottom: '16px' }}>
                    <label>LAST ORDER CUTOFF</label>
                    <input
                      type="text"
                      value={lastOrderCutoff}
                      onChange={(e) => setLastOrderCutoff(e.target.value)}
                    />
                    <small className="hint">Online orders close 45 mins before closing</small>
                  </div>

                  <div className="toggle-row">
                    <div>
                      <strong>Pause new orders</strong>
                      <small>Stops accepting until manually resumed</small>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={pauseOrders}
                        onChange={(e) => setPauseOrders(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="toggle-row">
                    <div>
                      <strong>Honor public holidays</strong>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={honorHolidays}
                        onChange={(e) => setHonorHolidays(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </aside>
              </div>
              {tabActions}
              </>
            )}

            {/* TAB 3: TAX & LEGAL */}
            {activeTab === 'tax' && (
              <section className="panel panel-full">
                <h2>Tax & legal</h2>
                <p className="panel-sub">Used on receipts, invoices, and reconciliation</p>

                <div className="field-grid three">
                  <div className="field">
                    <label>GSTIN</label>
                    <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27ABCDE1234F1Z5" />
                  </div>
                  <div className="field">
                    <label>PAN</label>
                    <input type="text" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" />
                  </div>
                  <div className="field">
                    <label>FSSAI LICENSE</label>
                    <input type="text" value={fssai} onChange={(e) => setFssai(e.target.value)} placeholder="11522016000123" />
                  </div>
                  <div className="field">
                    <label>CGST</label>
                    <input type="text" value={cgst} onChange={(e) => setCgst(e.target.value)} placeholder="2.5%" />
                  </div>
                  <div className="field">
                    <label>SGST</label>
                    <input type="text" value={sgst} onChange={(e) => setSgst(e.target.value)} placeholder="2.5%" />
                  </div>
                  <div className="field">
                    <label>SERVICE CHARGE</label>
                    <input type="text" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} placeholder="0%" />
                    <small className="hint">Optional, applied before tax</small>
                  </div>
                  <div className="field">
                    <label>CURRENCY</label>
                    <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>ROUNDING</label>
                    <input type="text" value={rounding} onChange={(e) => setRounding(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>INVOICE PREFIX</label>
                    <input type="text" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="SF-2026-" />
                  </div>
                </div>
                {tabActions}
              </section>
            )}

            {/* TAB 4: SOCIAL LINKS */}
            {activeTab === 'social' && (
              <section className="panel panel-full">
                <h2>Social links</h2>
                <p className="panel-sub">Shown on customer site footer and order receipts</p>

                <div className="field-grid two">
                  <div className="field icon-field">
                    <label>INSTAGRAM</label>
                    <div className="icon-input">
                      <span>📷</span>
                      <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>FACEBOOK</label>
                    <div className="icon-input">
                      <span>f</span>
                      <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>X (TWITTER)</label>
                    <div className="icon-input">
                      <span>𝕏</span>
                      <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>YOUTUBE</label>
                    <div className="icon-input">
                      <span>▶</span>
                      <input type="text" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="Add link" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>GOOGLE BUSINESS</label>
                    <div className="icon-input">
                      <span>🔗</span>
                      <input type="text" value={googleBusiness} onChange={(e) => setGoogleBusiness(e.target.value)} placeholder="g.page/yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>TRIPADVISOR</label>
                    <div className="icon-input">
                      <span>🔗</span>
                      <input type="text" value={tripadvisor} onChange={(e) => setTripadvisor(e.target.value)} placeholder="Add link" />
                    </div>
                  </div>
                </div>
                {tabActions}
              </section>
            )}

            {/* TAB 5: DELIVERY */}
            {activeTab === 'delivery' && (
              <>
              <div className="panel-grid delivery-grid">
                <section className="panel">
                  <h2>Delivery zone</h2>

                  <div className="field-grid two">
                    <div className="field">
                      <label>RADIUS</label>
                      <input type="text" value={deliveryRadius} onChange={(e) => setDeliveryRadius(e.target.value)} placeholder="5 km" />
                    </div>
                    <div className="field">
                      <label>MIN ORDER</label>
                      <input type="text" value={deliveryMinOrder} onChange={(e) => setDeliveryMinOrder(e.target.value)} placeholder="₹250" />
                    </div>
                    <div className="field">
                      <label>BASE FEE</label>
                      <input type="text" value={deliveryBaseFee} onChange={(e) => setDeliveryBaseFee(e.target.value)} placeholder="₹49" />
                    </div>
                    <div className="field">
                      <label>PER-KM FEE</label>
                      <input type="text" value={deliveryPerKmFee} onChange={(e) => setDeliveryPerKmFee(e.target.value)} placeholder="₹8" />
                    </div>
                    <div className="field">
                      <label>FREE DELIVERY ABOVE</label>
                      <input type="text" value={deliveryFreeAbove} onChange={(e) => setDeliveryFreeAbove(e.target.value)} placeholder="₹999" />
                    </div>
                    <div className="field">
                      <label>AVG PREP TIME</label>
                      <input type="text" value={deliveryPrepTime} onChange={(e) => setDeliveryPrepTime(e.target.value)} placeholder="22 min" />
                    </div>
                  </div>
                </section>

                <aside className="panel">
                  <h2>Channels</h2>

                  <div className="channel-row">
                    <div>
                      <strong>In-house delivery</strong>
                      <small>Use your own riders</small>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={channelInHouse} onChange={(e) => setChannelInHouse(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="channel-row">
                    <div><strong>Zomato</strong></div>
                    <label className="switch">
                      <input type="checkbox" checked={channelZomato} onChange={(e) => setChannelZomato(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="channel-row">
                    <div><strong>Swiggy</strong></div>
                    <label className="switch">
                      <input type="checkbox" checked={channelSwiggy} onChange={(e) => setChannelSwiggy(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="channel-row">
                    <div>
                      <strong>Dunzo on-demand</strong>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={channelDunzo} onChange={(e) => setChannelDunzo(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </aside>
              </div>
              {tabActions}
              </>
            )}

            {/* TAB 6: BRAND MEDIA */}
            {activeTab === 'brand' && (
              <section className="panel panel-full">
                <h2>Brand media</h2>
                <p className="panel-sub">Logo, cover, and gallery used across customer surfaces</p>

                <div className="upload-grid">
                  <label className="upload-tile">
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt="Logo" className="upload-preview" />
                    ) : (
                      <>
                        <svg className="upload-tray-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <strong>Logo</strong>
                        <small>PNG, JPG, SVG · up to 2 MB</small>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readFileAsDataUrl(file, setLogoDataUrl)
                      }}
                    />
                  </label>

                  <label className="upload-tile">
                    {coverPhoto ? (
                      <img src={coverPhoto} alt="Cover" className="upload-preview" />
                    ) : (
                      <>
                        <svg className="upload-tray-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <strong>Cover photo</strong>
                        <small>PNG, JPG · up to 2 MB</small>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readFileAsDataUrl(file, setCoverPhoto)
                      }}
                    />
                  </label>

                  <label className="upload-tile">
                    {ogImage ? (
                      <img src={ogImage} alt="OG" className="upload-preview" />
                    ) : (
                      <>
                        <svg className="upload-tray-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <strong>Square OG image</strong>
                        <small>PNG, JPG · up to 2 MB</small>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readFileAsDataUrl(file, setOgImage)
                      }}
                    />
                  </label>
                </div>
                {tabActions}
              </section>
            )}

            {/* TAB 7: TEAM ACCESS */}
            {activeTab === 'team' && (
              <section className="panel panel-full">
                <div className="team-header">
                  <div>
                    <h2>Team & access</h2>
                    <p className="panel-sub" style={{ margin: 0 }}>Who can access this restaurant's IROAS workspace</p>
                  </div>
                  <button type="button" className="btn-invite">
                    Invite member
                  </button>
                </div>

                <div className="team-card">
                  <div className="team-row">
                    <div className="team-user">
                      <div className="team-avatar">AR</div>
                      <div className="team-info">
                        <strong>Anika Rao</strong>
                        <small>anika@saffronandfig.in</small>
                      </div>
                    </div>
                    <div className="team-actions">
                      <span className="role-badge owner">Owner</span>
                      <button type="button" className="btn-manage">Manage</button>
                    </div>
                  </div>

                  <div className="team-row">
                    <div className="team-user">
                      <div className="team-avatar">RV</div>
                      <div className="team-info">
                        <strong>Rohit Verma</strong>
                        <small>rohit@saffronandfig.in</small>
                      </div>
                    </div>
                    <div className="team-actions">
                      <span className="role-badge manager">Manager</span>
                      <button type="button" className="btn-manage">Manage</button>
                    </div>
                  </div>

                  <div className="team-row">
                    <div className="team-user">
                      <div className="team-avatar">KS</div>
                      <div className="team-info">
                        <strong>Kavya S.</strong>
                        <small>kavya@saffronandfig.in</small>
                      </div>
                    </div>
                    <div className="team-actions">
                      <span className="role-badge lead">Floor lead</span>
                      <button type="button" className="btn-manage">Manage</button>
                    </div>
                  </div>

                  <div className="team-row">
                    <div className="team-user">
                      <div className="team-avatar">IK</div>
                      <div className="team-info">
                        <strong>Imran K.</strong>
                        <small>imran@saffronandfig.in</small>
                      </div>
                    </div>
                    <div className="team-actions">
                      <span className="role-badge chef">Chef de cuisine</span>
                      <button type="button" className="btn-manage">Manage</button>
                    </div>
                  </div>
                </div>
                {tabActions}
              </section>
            )}

            {/* TAB 8: BILLING */}
            {activeTab === 'billing' && (
              <section className="panel panel-full">
                <div className="billing-header">
                  <div>
                    <h2>Billing & subscription</h2>
                    <p className="panel-sub" style={{ margin: 0 }}>Manage your plan, payment methods, and invoice history</p>
                  </div>
                  <button type="button" className="btn-upgrade">
                    Upgrade plan
                  </button>
                </div>

                <div className="plan-card-box">
                  <div className="plan-info-left">
                    <div className="plan-title-row">
                      <span className="plan-name">Pro Plan</span>
                      <span className="plan-active-badge">Active</span>
                    </div>
                    <span className="plan-price">₹3,999 / month · Billed annually. Next renewal on Sep 15, 2026.</span>
                    <div className="plan-features">
                      <span className="feature-pill">POS Sync</span>
                      <span className="feature-pill">Unlimited Orders</span>
                      <span className="feature-pill">Multi-location</span>
                      <span className="feature-pill">24/7 Priority Support</span>
                    </div>
                  </div>
                </div>

                <div className="billing-subgrid">
                  <div>
                    <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>Payment method</h2>
                    <div className="payment-card-box">
                      <div className="card-left">
                        <div className="card-ico-box">VISA</div>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                          <strong style={{ fontSize: '13px' }}>•••• •••• •••• 4242</strong>
                          <small style={{ fontSize: '11px', color: 'var(--muted)' }}>Expires 08/28</small>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="paid-badge">Primary</span>
                        <button type="button" className="btn-manage">Edit</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>Billing history</h2>
                    <div className="invoice-table">
                      <div className="invoice-row">
                        <div>
                          <span className="invoice-num">INV-2026-008</span>
                          <span className="invoice-date" style={{ marginLeft: '8px' }}>Aug 15, 2026</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="invoice-amount">₹3,999</span>
                          <span className="paid-badge">Paid</span>
                        </div>
                      </div>
                      <div className="invoice-row">
                        <div>
                          <span className="invoice-num">INV-2026-007</span>
                          <span className="invoice-date" style={{ marginLeft: '8px' }}>Jul 15, 2026</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="invoice-amount">₹3,999</span>
                          <span className="paid-badge">Paid</span>
                        </div>
                      </div>
                      <div className="invoice-row">
                        <div>
                          <span className="invoice-num">INV-2026-006</span>
                          <span className="invoice-date" style={{ marginLeft: '8px' }}>Jun 15, 2026</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="invoice-amount">₹3,999</span>
                          <span className="paid-badge">Paid</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {tabActions}
              </section>
            )}

            {/* TAB 9: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <section className="panel panel-full">
                <h2>Notification preferences</h2>
                <p className="panel-sub">Choose how and when you receive order, system, and summary alerts</p>

                <div className="panel-grid">
                  <div>
                    <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>Alert Channels</h2>
                    <div className="notif-card-box">
                      <div className="notif-item-row">
                        <div>
                          <strong>Email notifications</strong>
                          <small className="hint" style={{ margin: 0 }}>Receive daily reports, invoices, and system updates</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={emailNotifs} onChange={(e) => setEmailNotifs(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="notif-item-row">
                        <div>
                          <strong>SMS alerts</strong>
                          <small className="hint" style={{ margin: 0 }}>Instant SMS for urgent kitchen & POS order updates</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={smsNotifs} onChange={(e) => setSmsNotifs(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="notif-item-row">
                        <div>
                          <strong>Push notifications</strong>
                          <small className="hint" style={{ margin: 0 }}>Browser notifications for incoming online orders</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={pushNotifs} onChange={(e) => setPushNotifs(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="notif-item-row">
                        <div>
                          <strong>WhatsApp order receipts</strong>
                          <small className="hint" style={{ margin: 0 }}>Send digital receipts directly to customer WhatsApp</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={whatsappNotifs} onChange={(e) => setWhatsappNotifs(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>Event Triggers</h2>
                    <div className="notif-card-box">
                      <div className="notif-item-row">
                        <div>
                          <strong>New incoming order</strong>
                          <small className="hint" style={{ margin: 0 }}>Alert immediately when a order is placed</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={newOrderAlert} onChange={(e) => setNewOrderAlert(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="notif-item-row">
                        <div>
                          <strong>Order cancellation</strong>
                          <small className="hint" style={{ margin: 0 }}>Alert when an order is cancelled or refunded</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={cancelOrderAlert} onChange={(e) => setCancelOrderAlert(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="notif-item-row">
                        <div>
                          <strong>Low inventory stock warning</strong>
                          <small className="hint" style={{ margin: 0 }}>Notify when ingredients drop below minimum threshold</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={lowStockAlert} onChange={(e) => setLowStockAlert(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="notif-item-row">
                        <div>
                          <strong>End of day sales summary</strong>
                          <small className="hint" style={{ margin: 0 }}>Receive automated nightly store revenue report</small>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={eodReportAlert} onChange={(e) => setEodReportAlert(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                {tabActions}
              </section>
            )}
    </DashboardLayout>
  )
}

export default RestaurantProfile
