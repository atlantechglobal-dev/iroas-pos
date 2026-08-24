import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setSession } from '../../lib/api'
import './CreateAccount.css'

const initialErrors = {
  name: false,
  restaurant: false,
  email: false,
  phone: false,
  password: false,
}

function CreateAccount() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
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
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setServerError('')

    const nextErrors = {
      name: form.name.trim() === '',
      restaurant: form.restaurant.trim() === '',
      email: form.email.trim() === '' || !form.email.includes('@'),
      phone: form.phone.trim() === '',
      password: form.password.length < 8,
    }

    setErrors(nextErrors)

    const valid = !Object.values(nextErrors).some(Boolean)

    if (!terms) {
      alert('Please agree to the terms and privacy policy.')
      return
    }

    if (!valid) return

    setLoading(true)

    try {
      const { token, user } = await api.signup({
        name: form.name.trim(),
        restaurant: form.restaurant.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      })

      setSession(token, user)
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

          <form onSubmit={handleSubmit}>
            {/* NAME + RESTAURANT */}
            <div className="two-fields">
              <div className="field-group">
                <label htmlFor="name">YOUR NAME</label>

                <div
                  className={`input-wrapper ${errors.name ? 'error' : ''}`}
                >
                  <i className="fa-regular fa-user"></i>

                  <input
                    type="text"
                    id="name"
                    placeholder="Ananya Rao"
                    value={form.name}
                    onChange={updateField('name')}
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="restaurant">RESTAURANT</label>

                <div
                  className={`input-wrapper ${
                    errors.restaurant ? 'error' : ''
                  }`}
                >
                  <i className="fa-solid fa-shop"></i>

                  <input
                    type="text"
                    id="restaurant"
                    placeholder="Saffron & Fig"
                    value={form.restaurant}
                    onChange={updateField('restaurant')}
                  />
                </div>
              </div>
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
            </div>

            {/* PHONE */}
            <div className="field-group">
              <label htmlFor="phone">PHONE</label>

              <div className={`input-wrapper ${errors.phone ? 'error' : ''}`}>
                <img src="/images/call.svg" alt="" />

                <input
                  type="tel"
                  id="phone"
                  placeholder="+91 98200 00000"
                  value={form.phone}
                  onChange={updateField('phone')}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="field-group">
              <label htmlFor="password">PASSWORD</label>

              <div
                className={`input-wrapper ${errors.password ? 'error' : ''}`}
              >
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
              <a href="#login" onClick={(event) => {
                event.preventDefault()
                navigate('/login')
              }}>
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
