import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { COUNTRIES } from '../../lib/countries'
import { TIMEZONES } from '../../lib/timezones'
import './RestaurantSetup.css'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const defaultHours = DAY_NAMES.map((day) => ({
  day,
  open: '',
  close: '',
  closed: false,
}))

function RestaurantSetup() {
  const navigate = useNavigate()

  const [restaurantName, setRestaurantName] = useState('')
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
  const [saveLabel, setSaveLabel] = useState('Save & continue later')

  // Load the restaurant profile already on file for this account
  useEffect(() => {
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (restaurant.name) setRestaurantName(restaurant.name)
        if (restaurant.cuisine) setCuisine(restaurant.cuisine)
        if (restaurant.description) setDescription(restaurant.description)
        if (restaurant.phone) setPhone(restaurant.phone)
        if (restaurant.website) setWebsite(restaurant.website)
        if (restaurant.email) setEmail(restaurant.email)
        if (restaurant.city) setCity(restaurant.city)
        if (restaurant.country) setCountry(restaurant.country)
        if (restaurant.timezone) setTimezone(restaurant.timezone)
        if (restaurant.address) setAddress(restaurant.address)
        if (restaurant.operating_hours) {
          try {
            setHours(JSON.parse(restaurant.operating_hours))
          } catch {
            // keep defaults if stored hours are malformed
          }
        }
      })
      .catch(() => {
        // no restaurant yet on this account — form stays blank
      })
  }, [])

  const updateHour = (index, field, value) => {
    setHours((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  const buildProfileData = () => ({
    restaurantName,
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

  const handleSave = async () => {
    try {
      await api.updateProfile(buildProfileData())
      setSaveLabel('Saved ✓')
    } catch {
      setSaveLabel('Save failed — try again')
    } finally {
      setTimeout(() => setSaveLabel('Save & continue later'), 2000)
    }
  }

  const handleContinue = async () => {
    if (restaurantName.trim() === '') {
      alert('Please enter your restaurant name.')
      return
    }

    try {
      await api.updateProfile(buildProfileData())
      navigate('/domain')
    } catch (err) {
      alert(err.message)
    }
  }

  const previewLetter = restaurantName.trim()
    ? restaurantName.trim().charAt(0).toUpperCase()
    : 'R'

  return (
    <div className="restaurant-setup-page">
      {/* TOP HEADER */}
      <header className="top-header">
        <div className="header-left">
          <img
            src="/images/Logo9-1 1.svg"
            alt="IROAS"
            className="iroas-logo"
          />

          <span className="time-info">◷ &nbsp; About 2–3 minutes</span>
        </div>

        <div className="header-right">
          <span className="autosaved">
            <span className="green-dot"></span>
            Auto-saved
          </span>

          <button className="save-button" onClick={handleSave}>
            {saveLabel}
          </button>
        </div>
      </header>

      {/* PROGRESS STEPS */}
      <nav className="steps-container">
        <div className="step active">
          <div className="step-icon">
            <img src="/images/profile.png" alt="Profile" />
          </div>

          <div className="step-text">
            <strong>Profile</strong>
            <span>Tell us about your place</span>
          </div>
        </div>

        <div className="step">
          <div className="step-icon">
            <img src="/images/domain.png" alt="Domain" />
          </div>

          <div className="step-text">
            <strong>Domain</strong>
            <span>Pick your web address</span>
          </div>
        </div>

        <div className="step">
          <div className="step-icon">
            <img src="/images/brand.png" alt="Brand" />
          </div>

          <div className="step-text">
            <strong>Brand</strong>
            <span>Logo, colors & theme</span>
          </div>
        </div>

        <div className="step">
          <div className="step-icon">
            <img src="/images/qr.png" alt="Launch" />
          </div>

          <div className="step-text">
            <strong>Launch</strong>
            <span>QR & digital card</span>
          </div>
        </div>
      </nav>

      {/* MAIN AREA */}
      <main className="main-container">
        {/* FORM */}
        <section className="form-card">
          <div className="step-number">◉ &nbsp; STEP 1 OF 4</div>

          <h1>Let's set up your restaurant</h1>

          <p className="subtitle">
            Tell us about your restaurant so we can create your digital
            presence. Everything autosaves as you type.
          </p>

          <div className="separator"></div>

          <div className="form-grid">
            <div className="field">
              <label>RESTAURANT NAME</label>

              <input
                type="text"
                placeholder="Saffron & Fig"
                value={restaurantName}
                onChange={(event) => setRestaurantName(event.target.value)}
              />
            </div>

            <div className="field">
              <label>
                CUISINE TYPE
                <span className="smart">Smart suggestions</span>
              </label>

              <div className="input-wrapper">
                <span className="input-icon">⌕</span>

                <input
                  type="text"
                  placeholder="Search cuisines"
                  value={cuisine}
                  onChange={(event) => setCuisine(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>
                RESTAURANT DESCRIPTION
                <span id="charCount">{description.length} / 200</span>
              </label>

              <textarea
                maxLength={200}
                placeholder="A modern bistro serving seasonal small plates and natural wine in the heart of downtown."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              ></textarea>
            </div>

            <div className="field">
              <label>PHONE NUMBER</label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="/images/blackcall.svg" alt="" />
                </span>

                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>
                WEBSITE
                <span className="optional">Optional</span>
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="/images/blackweb.svg" alt="" />
                </span>

                <input
                  type="text"
                  placeholder="www.yourrestaurant.com"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>EMAIL</label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="/images/msg.svg" alt="" />
                </span>

                <input
                  type="email"
                  placeholder="hello@yourrestaurant.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>CITY</label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="/images/blacklocation.svg" alt="" />
                </span>

                <input
                  type="text"
                  placeholder="Mumbai"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>COUNTRY</label>

              <select
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>TIME ZONE</label>

              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                <option value="">Select timezone</option>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            <div className="field full-width">
              <label>
                FULL ADDRESS
                <span className="address-note">Auto-complete supported</span>
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="/images/blacklocation.svg" alt="" />
                </span>

                <input
                  type="text"
                  defaultValue="142, Hill Road, Bandra West, Mumbai 400050"
                />
              </div>
            </div>
          </div>

          {/* OPERATING HOURS */}
          <div className="hours-section">
            <div className="hours-title">
              <span>OPERATING HOURS</span>
              <small>Drag to copy across days</small>
            </div>

            {hours.map((row, index) => (
              <div className="day-row" key={row.day}>
                <span className="day-name">{row.day}</span>

                <input
                  type="text"
                  className="time-input"
                  value={row.open}
                  disabled={row.closed}
                  onChange={(event) =>
                    updateHour(index, 'open', event.target.value)
                  }
                />

                <input
                  type="text"
                  className="time-input"
                  value={row.close}
                  disabled={row.closed}
                  onChange={(event) =>
                    updateHour(index, 'close', event.target.value)
                  }
                />

                <label className="closed-label">
                  <input
                    type="checkbox"
                    className="closed-checkbox"
                    checked={row.closed}
                    onChange={(event) =>
                      updateHour(index, 'closed', event.target.checked)
                    }
                  />
                  Closed
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* LIVE PREVIEW */}
        <aside className="preview-area">
          <div className="preview-card">
            <div className="preview-heading">LIVE PREVIEW</div>

            <div className="preview-profile">
              <div className="preview-logo">{previewLetter}</div>

              <div>
                <h3>{restaurantName.trim() || 'Your restaurant'}</h3>
                <p>{cuisine.trim() || 'Cuisine'}</p>
              </div>
            </div>

            <p className="preview-description">
              {description.trim() ||
                'Your description will appear here as you type.'}
            </p>
          </div>

          <div className="preview-note">
            <span>
              <img src="/images/security.svg" alt="" />
            </span>
            Your profile updates this card in real time.
          </div>
        </aside>
      </main>

      {/* BOTTOM BAR */}
      <footer className="bottom-bar">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="page-indicator">Step 1 of 4 · Profile</div>

        <button className="continue-button" onClick={handleContinue}>
          Continue →
        </button>
      </footer>
    </div>
  )
}

export default RestaurantSetup
