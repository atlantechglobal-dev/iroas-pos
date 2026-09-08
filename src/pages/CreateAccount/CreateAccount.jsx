import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setSession } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth.js'
import {
  isValidEmail,
  isValidMobile,
  isValidPersonName,
  normalizeMobileDigits,
} from '../../utils/validation.js'
import './CreateAccount.css'

const initialErrors = {
  firstName: '',
  lastName: '',
  restaurant: '',
  email: '',
  phone: '',
  password: '',
}

function CreateAccount() {
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    restaurant: '',
    email: '',
    phone: '',
    password: '',
  })
  const [errors, setErrors] = useState(initialErrors)
  const [showPassword, setShowPassword] = useState(false)
  const [terms, setTerms] = useState(false)
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const updateField = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({
      ...prev,
      [field]: field === 'phone' ? normalizeMobileDigits(value) : value,
    }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const nextErrors = { ...initialErrors }

    if (!form.firstName.trim()) {
      nextErrors.firstName = 'First name is required.'
    } else if (!isValidPersonName(form.firstName)) {
      nextErrors.firstName = 'Enter a valid first name using letters only.'
    }

    if (!form.lastName.trim()) {
      nextErrors.lastName = 'Last name is required.'
    } else if (!isValidPersonName(form.lastName)) {
      nextErrors.lastName = 'Enter a valid last name using letters only.'
    }

    if (!form.restaurant.trim()) {
      nextErrors.restaurant = 'Restaurant name is required.'
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!isValidEmail(form.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!form.phone.trim()) {
      nextErrors.phone = 'Mobile number is required.'
    } else if (!isValidMobile(form.phone)) {
      nextErrors.phone = 'Mobile number must be exactly 10 digits.'
    }

    if (form.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    setErrors(nextErrors)
    return !Object.values(nextErrors).some(Boolean)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setServerError('')

    if (!terms) {
      alert('Please agree to the terms and privacy policy.')
      return
    }

    if (!validateForm()) return

    setLoading(true)

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`

    try {
      const { token, user } = await api.signup({
        name: fullName,
        restaurant: form.restaurant.trim(),
        email: form.email.trim(),
        phone: normalizeMobileDigits(form.phone),
        password: form.password,
      })

      setSession(token, user)
      setUser(user)
      navigate('/restaurant-setup')
    } catch (err) {
      setServerError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-account-page">
      {/* LEFT SECTION */}
      <section className="left-section">
        <div className="logo">
          <img src="/images/logo.svg.svg" alt="IROAS Logo" />
        </div>

        <div className="left-content">
          <div className="get-started">
            <img src="/images/security.svg" alt="" />
            GET STARTED
          </div>

          <h1>
            Set up your restaurant in
            <br />
            minutes.
          </h1>

          <p className="description">
            Create your owner account, then our onboarding wizard builds your
            menu, website and QR codes.
          </p>

          <div className="features">
            <div className="feature">
              <span className="check">✓</span>
              <span>Menu, orders & tables in one dashboard</span>
            </div>

            <div className="feature">
              <span className="check">✓</span>
              <span>Branded ordering website in minutes</span>
            </div>

            <div className="feature">
              <span className="check">✓</span>
              <span>QR codes, KDS & analytics built in</span>
            </div>

            <div className="feature">
              <span className="check">✓</span>
              <span>Payments, reviews & marketing tools</span>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="testimonial">
          <p>
            "IROAS cut our onboarding to a single afternoon. Orders, QR menus
            and staff scheduling just work."
          </p>

          <div className="person">
            <div className="avatar">AK</div>

            <div>
              <strong>Aarav Kapoor</strong>
              <small>Owner, Saffron & Fig</small>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT SECTION */}
      <section className="right-section">
        <div className="form-container">
          <h2>Create your account</h2>

          <p className="subtitle">Free 14-day trial · no card required.</p>

          <form onSubmit={handleSubmit} noValidate>
            {/* FIRST + LAST NAME */}
            <div className="two-fields">
              <div className="field-group">
                <label htmlFor="firstName">FIRST NAME</label>

                <div className={`input-wrapper ${errors.firstName ? 'error' : ''}`}>
                  <i className="fa-regular fa-user"></i>

                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    placeholder="Ananya"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={updateField('firstName')}
                  />
                </div>
                {errors.firstName && <p className="field-error">{errors.firstName}</p>}
              </div>

              <div className="field-group">
                <label htmlFor="lastName">LAST NAME</label>

                <div className={`input-wrapper ${errors.lastName ? 'error' : ''}`}>
                  <i className="fa-regular fa-user"></i>

                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    placeholder="Rao"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={updateField('lastName')}
                  />
                </div>
                {errors.lastName && <p className="field-error">{errors.lastName}</p>}
              </div>
            </div>

            {/* RESTAURANT */}
            <div className="field-group">
              <label htmlFor="restaurant">RESTAURANT</label>

              <div className={`input-wrapper ${errors.restaurant ? 'error' : ''}`}>
                <i className="fa-solid fa-shop"></i>

                <input
                  type="text"
                  id="restaurant"
                  placeholder="Saffron & Fig"
                  value={form.restaurant}
                  onChange={updateField('restaurant')}
                />
              </div>
              {errors.restaurant && <p className="field-error">{errors.restaurant}</p>}
            </div>

            {/* EMAIL */}
            <div className="field-group">
              <label htmlFor="email">WORK EMAIL</label>

              <div className={`input-wrapper ${errors.email ? 'error' : ''}`}>
                <i className="fa-regular fa-envelope"></i>

                <input
                  type="email"
                  id="email"
                  placeholder="you@restaurant.com"
                  value={form.email}
                  onChange={updateField('email')}
                />
              </div>
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

            {/* PHONE */}
            <div className="field-group">
              <label htmlFor="phone">MOBILE</label>

              <div className={`input-wrapper ${errors.phone ? 'error' : ''}`}>
                <img src="/images/call.svg" alt="" />

                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="9876543210"
                  maxLength={10}
                  value={form.phone}
                  onChange={updateField('phone')}
                />
              </div>
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>

            {/* PASSWORD */}
            <div className="field-group">
              <label htmlFor="password">PASSWORD</label>

              <div className={`input-wrapper ${errors.password ? 'error' : ''}`}>
                <i className="fa-solid fa-lock"></i>

                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={updateField('password')}
                />

                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <i
                    className={`fa-regular ${
                      showPassword ? 'fa-eye-slash' : 'fa-eye'
                    }`}
                  ></i>
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>

            {/* TERMS */}
            <div className="terms">
              <input
                type="checkbox"
                id="terms"
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
              />

              <label htmlFor="terms">
                I agree to the <a href="#terms">terms</a> and{' '}
                <a href="#privacy">privacy policy</a>.
              </label>
            </div>

            {serverError && <p className="form-error">{serverError}</p>}

            {/* BUTTON */}
            <button type="submit" className="create-btn" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            {/* SIGN IN */}
            <p className="signin">
              Already have an account?{' '}
              <a
                href="#login"
                onClick={(event) => {
                  event.preventDefault()
                  navigate('/login')
                }}
              >
                Sign in
              </a>
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}

export default CreateAccount
