import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser, clearSession } from '../../lib/api'
import { NAV_GROUPS } from '../../lib/navGroups'
import { deriveAccentShades, DEFAULT_ACCENT } from '../../lib/accentColor'
import { COUNTRIES } from '../../lib/countries'
import { TIMEZONES } from '../../lib/timezones'
import './RestaurantProfile.css'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const defaultHours = DAY_NAMES.map((day) => ({ day, open: '', close: '', closed: false }))

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

const TAB_ICONS = {
  basic: '<path d="M3 8 L4 3 H16 L17 8"/><path d="M3 8 V17 H17 V8"/><rect x="8" y="12" width="4" height="5"/>',
  hours: '<circle cx="10" cy="10" r="7.2"/><path d="M10 6 V10 L13 12"/>',
  tax: '<rect x="3" y="3.5" width="14" height="13" rx="2"/><path d="M7 8h6M7 11h6M7 14h3"/>',
  social: '<circle cx="10" cy="10" r="7.2"/><path d="M2.8 10h14.4M10 2.8c2.2 2 3.4 4.6 3.4 7.2s-1.2 5.2-3.4 7.2c-2.2-2-3.4-4.6-3.4-7.2S7.8 4.8 10 2.8Z"/>',
  delivery: '<rect x="2" y="6" width="9.5" height="7.5" rx="1"/><path d="M11.5 8.5H15l2.5 2.5V13.5h-6z"/><circle cx="6" cy="15" r="1.6"/><circle cx="14.3" cy="15" r="1.6"/>',
  brand: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.6"/><circle cx="7" cy="8.2" r="1.6"/><path d="M3 14.5l4-4 3 3 3.5-3.5 3.5 3.5"/>',
  team: '<circle cx="7" cy="7" r="2.6"/><circle cx="14" cy="8" r="2.1"/><path d="M2.5 17c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5"/><path d="M12.8 12.3c1.9.3 3.4 2.1 3.4 4.3"/>',
  billing: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.6"/><path d="M2.5 8h15"/>',
  notifications: '<path d="M5 13.5c0-.9.7-1.1.7-2.9V9a4.3 4.3 0 0 1 8.6 0v1.6c0 1.8.7 2 .7 2.9Z"/><path d="M8.3 16a1.7 1.7 0 0 0 3.4 0"/>',
}

function TabIcon({ tab }) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: TAB_ICONS[tab] }}
    />
  )
}

function RestaurantProfile() {
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const [activeNav] = useState('restaurant-profile')
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [saving, setSaving] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')

  // Real, DB-backed fields
  const [name, setName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [timezone, setTimezone] = useState('')
  const [address, setAddress] = useState('')
  const [hours, setHours] = useState(defaultHours)
  const [logoDataUrl, setLogoDataUrl] = useState(null)

  // Settings JSON-backed fields
  const [legalEntity, setLegalEntity] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [tagline, setTagline] = useState('')
  const [yearEstablished, setYearEstablished] = useState('')
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [fssai, setFssai] = useState('')
  const [cgst, setCgst] = useState('')
  const [sgst, setSgst] = useState('')
  const [serviceCharge, setServiceCharge] = useState('')
  const [currency, setCurrency] = useState('INR (₹)')
  const [rounding, setRounding] = useState('Nearest ₹1')
  const [invoicePrefix, setInvoicePrefix] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [twitter, setTwitter] = useState('')
  const [youtube, setYoutube] = useState('')
  const [googleBusiness, setGoogleBusiness] = useState('')
  const [tripadvisor, setTripadvisor] = useState('')
  const [lastOrderCutoff, setLastOrderCutoff] = useState('')
  const [pauseOrders, setPauseOrders] = useState(false)
  const [honorHolidays, setHonorHolidays] = useState(true)
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
  const [coverPhoto, setCoverPhoto] = useState(null)
  const [ogImage, setOgImage] = useState(null)
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)

  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) {
          setName(restaurant.name)
          setRestaurantName(restaurant.name)
        }
        setRestaurantStatus(restaurant.status)
        if (restaurant.cuisine) setCuisine(restaurant.cuisine)
        if (restaurant.description) setDescription(restaurant.description)
        if (restaurant.phone) setPhone(restaurant.phone)
        if (restaurant.website) setWebsite(restaurant.website)
        if (restaurant.email) setEmail(restaurant.email)
        if (restaurant.city) setCity(restaurant.city)
        if (restaurant.country) setCountry(restaurant.country)
        if (restaurant.timezone) setTimezone(restaurant.timezone)
        if (restaurant.address) setAddress(restaurant.address)
        if (restaurant.logo_data_url) setLogoDataUrl(restaurant.logo_data_url)
        if (restaurant.operating_hours) {
          try {
            setHours(JSON.parse(restaurant.operating_hours))
          } catch {
            // keep defaults
          }
        }

        const s = restaurant.settings || {}
        if (s.adminAccentColor) setAccentColor(s.adminAccentColor)
        if (s.legalEntity) setLegalEntity(s.legalEntity)
        if (s.priceRange) setPriceRange(s.priceRange)
        if (s.tagline) setTagline(s.tagline)
        if (s.yearEstablished) setYearEstablished(s.yearEstablished)
        if (s.gstin) setGstin(s.gstin)
        if (s.pan) setPan(s.pan)
        if (s.fssai) setFssai(s.fssai)
        if (s.cgst) setCgst(s.cgst)
        if (s.sgst) setSgst(s.sgst)
        if (s.serviceCharge !== undefined) setServiceCharge(s.serviceCharge)
        if (s.currency) setCurrency(s.currency)
        if (s.rounding) setRounding(s.rounding)
        if (s.invoicePrefix) setInvoicePrefix(s.invoicePrefix)
        if (s.instagram) setInstagram(s.instagram)
        if (s.facebook) setFacebook(s.facebook)
        if (s.twitter) setTwitter(s.twitter)
        if (s.youtube) setYoutube(s.youtube)
        if (s.googleBusiness) setGoogleBusiness(s.googleBusiness)
        if (s.tripadvisor) setTripadvisor(s.tripadvisor)
        if (s.lastOrderCutoff) setLastOrderCutoff(s.lastOrderCutoff)
        if (s.pauseOrders !== undefined) setPauseOrders(s.pauseOrders)
        if (s.honorHolidays !== undefined) setHonorHolidays(s.honorHolidays)
        if (s.deliveryRadius) setDeliveryRadius(s.deliveryRadius)
        if (s.deliveryMinOrder) setDeliveryMinOrder(s.deliveryMinOrder)
        if (s.deliveryBaseFee) setDeliveryBaseFee(s.deliveryBaseFee)
        if (s.deliveryPerKmFee) setDeliveryPerKmFee(s.deliveryPerKmFee)
        if (s.deliveryFreeAbove) setDeliveryFreeAbove(s.deliveryFreeAbove)
        if (s.deliveryPrepTime) setDeliveryPrepTime(s.deliveryPrepTime)
        if (s.channelInHouse !== undefined) setChannelInHouse(s.channelInHouse)
        if (s.channelZomato !== undefined) setChannelZomato(s.channelZomato)
        if (s.channelSwiggy !== undefined) setChannelSwiggy(s.channelSwiggy)
        if (s.channelDunzo !== undefined) setChannelDunzo(s.channelDunzo)
        if (s.coverPhoto) setCoverPhoto(s.coverPhoto)
        if (s.ogImage) setOgImage(s.ogImage)
      })
      .catch(() => {})
  }, [])

  const accentStyle = deriveAccentShades(accentColor)

  const updateHour = (index, field, value) => {
    setHours((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'

  const setupSections = [
    { key: 'basic', label: 'Basic info', done: Boolean(name.trim() && cuisine.trim() && phone.trim()) },
    { key: 'hours', label: 'Hours & timezone', done: hours.some((h) => h.open && h.close) },
    { key: 'tax', label: 'Tax & legal', done: Boolean(gstin.trim()) },
    { key: 'social', label: 'Social links', done: [instagram, facebook, twitter, youtube, googleBusiness, tripadvisor].some((v) => v.trim()) },
    { key: 'delivery', label: 'Delivery radius', done: Boolean(deliveryRadius.trim()) },
  ]
  const completedCount = setupSections.filter((s) => s.done).length
  const progressPct = Math.round((completedCount / setupSections.length) * 100)

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const handleNavClick = (item) => {
    setProfileOpen(false)
    if (item.route) {
      navigate(item.route)
    } else {
      alert(`${item.label} — coming soon in this demo.`)
    }
  }

  const readFileAsDataUrl = (file, onLoad) => {
    const reader = new FileReader()
    reader.onload = (event) => onLoad(event.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
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

      await api.updateSettings({
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
      })

      if (logoDataUrl) {
        await api.updateBrand({ logoDataUrl })
      }

      setRestaurantName(name)
      alert('Restaurant profile saved.')
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="restaurant-profile-page" style={accentStyle}>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="brand">
            <img src="/images/Logo9-1 1.svg" alt="logo" />
          </div>

          <button
            className="restaurant-switch"
            type="button"
            onClick={() => alert('Switch restaurant — coming soon in this demo.')}
          >
            <span className="avatar-badge">{displayRestaurant.charAt(0).toUpperCase()}</span>
            <span className="restaurant-info">
              <strong>{displayRestaurant}</strong>
              <small>{restaurantStatus === 'live' ? 'Live' : 'Onboarding'}</small>
            </span>
            <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <nav className="nav">
            {NAV_GROUPS.map((group) => (
              <div className="nav-group" key={group.label}>
                <p className="nav-label">{group.label}</p>
                {group.items.map((item) => (
                  <a
                    href="#top"
                    key={item.key}
                    className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                    onClick={(event) => {
                      event.preventDefault()
                      handleNavClick(item)
                    }}
                  >
                    <img src={item.icon} alt={item.label} />
                    {item.label}
                    {item.badge && <span className="badge">{item.badge}</span>}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* MAIN */}
        <div className="main">
          <header className="topbar">
            <div className="search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Search orders, menu items, customers..." />
              <span className="kbd">⌘ K</span>
            </div>

            <div className="topbar-actions">
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => alert('Quick actions — coming soon in this demo.')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                Quick action
              </button>

              <button
                className="icon-btn"
                type="button"
                aria-label="Notifications"
                onClick={() => alert('No new notifications.')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6 8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V13L20 17H4L6 13V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span className="dot"></span>
              </button>

              <div className="user-chip-wrapper">
                <button className="user-chip" type="button" onClick={() => setProfileOpen((prev) => !prev)}>
                  <span className="avatar-dark">{(currentUser?.name || 'A').charAt(0).toUpperCase()}</span>
                  <span className="user-info">
                    <strong>{currentUser?.name || 'Owner'}</strong>
                    <small>Owner</small>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {profileOpen && (
                  <>
                    <div className="menu-overlay" onClick={() => setProfileOpen(false)} />
                    <div className="profile-menu">
                      <button type="button" onClick={() => { setProfileOpen(false); alert('Account settings — coming soon in this demo.') }}>
                        Settings
                      </button>
                      <button type="button" className="danger" onClick={handleLogout}>
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="content" id="top">
            <div className="page-head">
              <div>
                <p className="eyebrow">Setup</p>
                <h1>Restaurant profile</h1>
                <p className="page-desc">
                  Your restaurant's identity, hours, tax and contact info — shared across POS, online ordering and bookings.
                </p>
              </div>

              <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
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

            {/* TAB BAR */}
            <div className="tab-bar">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <TabIcon tab={tab.key} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* BASIC INFO */}
            {activeTab === 'basic' && (
              <div className="panel-grid">
                <section className="panel">
                  <h2>Identity</h2>
                  <p className="panel-sub">Visible to customers across POS, web and bookings</p>

                  <div className="field-grid">
                    <div className="field">
                      <label>Restaurant name</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your restaurant" />
                    </div>
                    <div className="field">
                      <label>Legal entity</label>
                      <input type="text" value={legalEntity} onChange={(e) => setLegalEntity(e.target.value)} placeholder="Pvt Ltd / LLP name" />
                    </div>
                    <div className="field">
                      <label>Cuisine</label>
                      <input type="text" value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Modern Indian · Mediterranean" />
                    </div>
                    <div className="field">
                      <label>Price range</label>
                      <input type="text" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder="₹₹ · 800–1500 / head" />
                    </div>
                    <div className="field">
                      <label>Tagline</label>
                      <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short brand line" />
                    </div>
                    <div className="field">
                      <label>Year established</label>
                      <input type="text" value={yearEstablished} onChange={(e) => setYearEstablished(e.target.value)} placeholder="2019" />
                    </div>
                    <div className="field full">
                      <label>About</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell guests what makes your place special." />
                    </div>
                  </div>
                </section>

                <aside className="panel side-panel">
                  <h2>Contact</h2>

                  <div className="contact-list">
                    <div className="contact-row">
                      <span className="contact-ico">📍</span>
                      <div>
                        <span className="contact-label">Address</span>
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, city" />
                      </div>
                    </div>
                    <div className="contact-row">
                      <span className="contact-ico">☎</span>
                      <div>
                        <span className="contact-label">Phone</span>
                        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98200 12345" />
                      </div>
                    </div>
                    <div className="contact-row">
                      <span className="contact-ico">✉</span>
                      <div>
                        <span className="contact-label">Email</span>
                        <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@yourrestaurant.com" />
                      </div>
                    </div>
                    <div className="contact-row">
                      <span className="contact-ico">🌐</span>
                      <div>
                        <span className="contact-label">Website</span>
                        <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourrestaurant.com" />
                      </div>
                    </div>
                    <div className="contact-row">
                      <span className="contact-ico">🏙</span>
                      <div>
                        <span className="contact-label">City</span>
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
                      </div>
                    </div>
                    <div className="contact-row">
                      <span className="contact-ico">🏳</span>
                      <div>
                        <span className="contact-label">Country</span>
                        <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="India" />
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {/* HOURS & TIMEZONE */}
            {activeTab === 'hours' && (
              <div className="panel-grid">
                <section className="panel">
                  <h2>Operating hours</h2>
                  <p className="panel-sub">Service hours per day, with optional split shifts</p>

                  <div className="hours-table">
                    {hours.map((row, index) => (
                      <div className="hours-row" key={row.day}>
                        <strong>{row.day}</strong>
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
                        <button
                          type="button"
                          className={`status-bar ${row.closed ? 'closed' : row.open && row.close ? 'open' : ''}`}
                          onClick={() => updateHour(index, 'closed', !row.closed)}
                        >
                          {row.closed ? 'Closed' : row.open && row.close ? 'Open' : 'Set hours'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="panel side-panel">
                  <h2>Timezone & holidays</h2>

                  <div className="field">
                    <label>Time zone</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      <option value="">Select timezone</option>
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Last order cutoff</label>
                    <input type="text" value={lastOrderCutoff} onChange={(e) => setLastOrderCutoff(e.target.value)} placeholder="22:45" />
                    <small className="hint">Online orders close before closing time.</small>
                  </div>

                  <div className="toggle-row">
                    <div>
                      <strong>Pause new orders</strong>
                      <small>Stops accepting until manually resumed</small>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={pauseOrders} onChange={(e) => setPauseOrders(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="toggle-row">
                    <div>
                      <strong>Honor public holidays</strong>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={honorHolidays} onChange={(e) => setHonorHolidays(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </aside>
              </div>
            )}

            {/* TAX & LEGAL */}
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
                    <label>FSSAI license</label>
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
                    <label>Service charge</label>
                    <input type="text" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} placeholder="0%" />
                    <small className="hint">Optional, applied before tax</small>
                  </div>
                  <div className="field">
                    <label>Currency</label>
                    <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Rounding</label>
                    <input type="text" value={rounding} onChange={(e) => setRounding(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Invoice prefix</label>
                    <input type="text" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="SF-2026-" />
                  </div>
                </div>
              </section>
            )}

            {/* SOCIAL LINKS */}
            {activeTab === 'social' && (
              <section className="panel panel-full">
                <h2>Social links</h2>
                <p className="panel-sub">Shown on customer site footer and order receipts</p>

                <div className="field-grid two">
                  <div className="field icon-field">
                    <label>Instagram</label>
                    <div className="icon-input">
                      <span>📷</span>
                      <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>Facebook</label>
                    <div className="icon-input">
                      <span>f</span>
                      <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>X (Twitter)</label>
                    <div className="icon-input">
                      <span>𝕏</span>
                      <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>YouTube</label>
                    <div className="icon-input">
                      <span>▶</span>
                      <input type="text" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="Add link" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>Google business</label>
                    <div className="icon-input">
                      <span>🔗</span>
                      <input type="text" value={googleBusiness} onChange={(e) => setGoogleBusiness(e.target.value)} placeholder="g.page/yourrestaurant" />
                    </div>
                  </div>
                  <div className="field icon-field">
                    <label>TripAdvisor</label>
                    <div className="icon-input">
                      <span>🔗</span>
                      <input type="text" value={tripadvisor} onChange={(e) => setTripadvisor(e.target.value)} placeholder="Add link" />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* DELIVERY */}
            {activeTab === 'delivery' && (
              <div className="panel-grid delivery-grid">
                <section className="panel">
                  <h2>Delivery zone</h2>

                  <div className="field-grid two">
                    <div className="field">
                      <label>Radius</label>
                      <input type="text" value={deliveryRadius} onChange={(e) => setDeliveryRadius(e.target.value)} placeholder="5 km" />
                    </div>
                    <div className="field">
                      <label>Min order</label>
                      <input type="text" value={deliveryMinOrder} onChange={(e) => setDeliveryMinOrder(e.target.value)} placeholder="₹250" />
                    </div>
                    <div className="field">
                      <label>Base fee</label>
                      <input type="text" value={deliveryBaseFee} onChange={(e) => setDeliveryBaseFee(e.target.value)} placeholder="₹49" />
                    </div>
                    <div className="field">
                      <label>Per-km fee</label>
                      <input type="text" value={deliveryPerKmFee} onChange={(e) => setDeliveryPerKmFee(e.target.value)} placeholder="₹8" />
                    </div>
                    <div className="field">
                      <label>Free delivery above</label>
                      <input type="text" value={deliveryFreeAbove} onChange={(e) => setDeliveryFreeAbove(e.target.value)} placeholder="₹999" />
                    </div>
                    <div className="field">
                      <label>Avg prep time</label>
                      <input type="text" value={deliveryPrepTime} onChange={(e) => setDeliveryPrepTime(e.target.value)} placeholder="22 min" />
                    </div>
                  </div>
                </section>

                <aside className="panel side-panel">
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
            )}

            {/* BRAND MEDIA */}
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
                        <span className="upload-ico">⇧</span>
                        <strong>Logo</strong>
                        <small>PNG, JPG up to 5MB</small>
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
                        <span className="upload-ico">⇧</span>
                        <strong>Cover photo</strong>
                        <small>PNG, JPG up to 5MB</small>
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
                        <span className="upload-ico">⇧</span>
                        <strong>Square OG image</strong>
                        <small>PNG, JPG up to 5MB</small>
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
              </section>
            )}

            {/* COMING SOON TABS */}
            {(activeTab === 'team' || activeTab === 'billing' || activeTab === 'notifications') && (
              <section className="panel panel-full coming-soon">
                <div className="coming-soon-icon">
                  <TabIcon tab={activeTab} />
                </div>
                <h2>{TABS.find((t) => t.key === activeTab)?.label} — coming soon</h2>
                <p className="panel-sub">
                  This section isn't wired up in the demo yet. Everything else on this page saves for real.
                </p>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default RestaurantProfile
