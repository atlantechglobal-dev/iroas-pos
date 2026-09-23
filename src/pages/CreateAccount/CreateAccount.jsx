import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn.js'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { visibleBusinessCategories } from '../../constants/digitalIdentity.js'
import { getBusinessCopy } from '../../constants/businessCopy.js'
import {
  CALLING_CODES,
  DEFAULT_DIAL_CODE,
} from '../../constants/callingCodes.js'
import { CountryCodePicker } from '../../components/CountryCodePicker.jsx'
import {
  isValidEmail,
  isValidInternationalMobile,
  isValidPersonName,
  isValidPassword,
  passwordRequirements,
  formatE164,
  mobileDigitsOnly,
} from '../../utils/validation.js'
import { ROUTES } from '../../constants/routes.js'
import { prefetchRoute, prefetchWhenIdle } from '../../lib/routePrefetch.js'
import './CreateAccount.css'

const ENABLE_CATEGORY_FLOW = true
const DEFAULT_CATEGORY = 'Restaurant'
const DEFAULT_SIGNUP_COUNTRY_ISO = 'ZA'

const initialErrors = {
  name: '',
  restaurant: '',
  city: '',
  category: '',
  email: '',
  phone: '',
  password: '',
}

function CreateAccount() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const [form, setForm] = useState({
    name: location.state?.googleName || '',
    restaurant: '',
    city: '',
    category: '',
    email: location.state?.googleEmail || '',
    phone: '',
    dialIso: DEFAULT_SIGNUP_COUNTRY_ISO,
    password: '',
  })
  const [errors, setErrors] = useState(initialErrors)
  const [showPassword, setShowPassword] = useState(false)
  const [terms, setTerms] = useState(false)
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState(() => visibleBusinessCategories())
  const [googleIdToken, setGoogleIdToken] = useState(location.state?.googleIdToken || '')
  const [googleLoading, setGoogleLoading] = useState(false)
  const copy = getBusinessCopy(ENABLE_CATEGORY_FLOW ? form.category : DEFAULT_CATEGORY)

  const handleGoogleIdToken = async (idToken) => {
    // Same idToken the Login page would have sent to POST /auth/google —
    // resolve it the same way here just to read name/email back for the
    // form; the actual account only gets created on submit, once the rest
    // of the business details are filled in.
    setGoogleLoading(true)
    try {
      const result = await api.googleLogin(idToken)
      if (result.needsSignup) {
        setGoogleIdToken(result.idToken)
        setForm((prev) => ({
          ...prev,
          name: prev.name || result.name || '',
          email: result.email || prev.email,
        }))
        toast.success('Google verified — finish your business details below.')
      } else {
        // An account already exists for this Google identity — that's a
        // sign-in, not a signup. Send them to Login to complete it there.
        toast.info('An account already exists for this Google account. Please sign in.')
        navigate(ROUTES.LOGIN)
      }
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const { gisHostRef, trigger: triggerGoogle } = useGoogleSignIn(handleGoogleIdToken, {
    text: 'signup_with',
  })

  useEffect(() => {
    let cancelled = false
    prefetchWhenIdle(['login', 'accountThanks'])
    api
      .businessCategories()
      .then(({ categories: rows }) => {
        if (cancelled) return
        if (Array.isArray(rows) && rows.length) setCategories(rows)
      })
      .catch(() => {
        /* keep static fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateField = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({
      ...prev,
      [field]: field === 'phone' ? mobileDigitsOnly(value).slice(0, 14) : value,
    }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const nextErrors = { ...initialErrors }

    if (!form.name.trim()) {
      nextErrors.name = 'Name is required.'
    } else if (!isValidPersonName(form.name)) {
      nextErrors.name = 'Enter a valid name using letters only.'
    }

    if (!form.restaurant.trim()) {
      const nameLabel = copy.nameLabel.toLowerCase()
      nextErrors.restaurant = `${nameLabel.charAt(0).toUpperCase()}${nameLabel.slice(1)} is required.`
    }

    if (!form.city.trim()) {
      nextErrors.city = 'City is required.'
    }

    if (ENABLE_CATEGORY_FLOW && !form.category.trim()) {
      nextErrors.category = 'Category is required.'
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!isValidEmail(form.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!form.phone.trim()) {
      nextErrors.phone = 'Mobile number is required.'
    } else if (
      !isValidInternationalMobile(
        CALLING_CODES.find((c) => c.iso === form.dialIso)?.dial || DEFAULT_DIAL_CODE,
        form.phone,
      )
    ) {
      nextErrors.phone = 'Enter a valid mobile number for the selected country.'
    }

    if (!googleIdToken && !isValidPassword(form.password)) {
      nextErrors.password = passwordRequirements
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
    prefetchRoute('accountThanks')

    try {
      const result = await api.signup({
        name: form.name.trim(),
        restaurant: form.restaurant.trim(),
        city: form.city.trim(),
        category: ENABLE_CATEGORY_FLOW ? form.category : DEFAULT_CATEGORY,
        email: form.email.trim(),
        phone: formatE164(
          CALLING_CODES.find((c) => c.iso === form.dialIso)?.dial || DEFAULT_DIAL_CODE,
          form.phone,
        ),
        ...(googleIdToken ? { idToken: googleIdToken } : { password: form.password }),
      })

      navigate(ROUTES.ACCOUNT_THANKS, {
        replace: true,
        state: { email: result.email || form.email.trim() },
      })
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
            Set up your {copy.noun} in
            <br />
            minutes.
          </h1>

          <p className="description">{copy.signupDescription}</p>

          <div className="features" key={ENABLE_CATEGORY_FLOW ? form.category : DEFAULT_CATEGORY}>
            {copy.signupDeliverables.map((item) => (
              <div className="feature" key={item}>
                <span className="check">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="testimonial">
          <p>{copy.signupQuote}</p>

          <div className="person">
            <div className="avatar">{copy.signupPersonInitials}</div>

            <div>
              <strong>{copy.signupPersonName}</strong>
              <small>{copy.signupPersonRole}</small>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT SECTION */}
      <section className="right-section">
        <div className="form-container">
          <h2>Create your account</h2>

          <p className="subtitle">Free 14-day trial · no card required.</p>

          {!googleIdToken ? (
            <>
              <button
                type="button"
                className="google-signup-button"
                disabled={googleLoading}
                onClick={() => triggerGoogle((message) => toast.info(message))}
              >
                <span className="google-icon" aria-hidden="true">
                  <svg viewBox="0 0 18 18" width="18" height="18">
                    <path
                      fill="#4285F4"
                      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                    />
                    <path
                      fill="#34A853"
                      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                    />
                    <path
                      fill="#EA4335"
                      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                    />
                  </svg>
                </span>
                {googleLoading ? 'Verifying…' : 'Continue with Google'}
              </button>
              <div ref={gisHostRef} className="gis-button-host" aria-hidden="true" />

              <div className="divider">
                <span></span>
                <p>OR FILL IN YOUR DETAILS</p>
                <span></span>
              </div>
            </>
          ) : (
            <div className="google-linked-note">
              <span>✓</span>
              <p>Google account verified. Just finish your business details below.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="name">NAME</label>

              <div className={`input-wrapper ${errors.name ? 'error' : ''}`}>
                <i className="fa-regular fa-user"></i>

                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Your name"
                  autoComplete="name"
                  value={form.name}
                  onChange={updateField('name')}
                />
              </div>
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>

            {ENABLE_CATEGORY_FLOW ? (
              <div className="field-group">
                <label htmlFor="category">CATEGORY</label>

                <div className={`input-wrapper ${errors.category ? 'error' : ''}`}>
                  <i className="fa-solid fa-list"></i>
                  <select
                    id="category"
                    value={form.category}
                    onChange={updateField('category')}
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.category && <p className="field-error">{errors.category}</p>}
              </div>
            ) : null}

            <div className="field-group">
              <label htmlFor="restaurant">{copy.nameLabel.toUpperCase()}</label>

              <div className={`input-wrapper ${errors.restaurant ? 'error' : ''}`}>
                <i className="fa-solid fa-shop"></i>

                <input
                  type="text"
                  id="restaurant"
                  placeholder={copy.fallbackName}
                  value={form.restaurant}
                  onChange={updateField('restaurant')}
                />
              </div>
              {errors.restaurant && <p className="field-error">{errors.restaurant}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="city">CITY</label>

              <div className={`input-wrapper ${errors.city ? 'error' : ''}`}>
                <i className="fa-solid fa-location-dot"></i>

                <input
                  type="text"
                  id="city"
                  name="city"
                  placeholder="Cape Town"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={updateField('city')}
                />
              </div>
              {errors.city && <p className="field-error">{errors.city}</p>}
            </div>

            {/* EMAIL */}
            <div className="field-group">
              <label htmlFor="email">WORK EMAIL</label>

              <div className={`input-wrapper ${errors.email ? 'error' : ''}`}>
                <i className="fa-regular fa-envelope"></i>

                <input
                  type="email"
                  id="email"
                  placeholder={copy.emailPlaceholder.replace('hello@', 'you@')}
                  value={form.email}
                  onChange={updateField('email')}
                  readOnly={Boolean(googleIdToken)}
                />
              </div>
              {googleIdToken ? (
                <p className="field-hint">Locked to your verified Google account.</p>
              ) : null}
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="phone">MOBILE</label>

              <div className={`phone-row ${errors.phone ? 'error' : ''}`}>
                <CountryCodePicker
                  value={form.dialIso}
                  error={Boolean(errors.phone)}
                  onChange={(iso) => {
                    setForm((prev) => ({ ...prev, dialIso: iso }))
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }))
                  }}
                />

                <div className="input-wrapper phone-wrapper">
                  <img src="/images/call.svg" alt="" />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="9876543210"
                    maxLength={14}
                    value={form.phone}
                    onChange={updateField('phone')}
                  />
                </div>
              </div>
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>

            {/* PASSWORD */}
            {!googleIdToken ? (
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
            ) : null}

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
                onMouseEnter={() => prefetchRoute('login')}
                onFocus={() => prefetchRoute('login')}
                onClick={(event) => {
                  event.preventDefault()
                  navigate(ROUTES.LOGIN)
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
