import { useNavigate } from 'react-router-dom'
import './GoLive.css'

const CHECKLIST = [
  'Profile completed',
  'Domain connected',
  'Branding applied',
  'QR generated',
]

function GoLive() {
  const navigate = useNavigate()

  const handleDashboard = () => {
    navigate('/directory-listings')
  }

  const handlePreview = () => {
    console.log('Opening website preview...')
  }

  const handleDownloadQR = () => {
    console.log('Downloading QR kit...')
  }

  return (
    <main className="go-live-page">
      <div className="icon-badge" aria-hidden="true">
        <img src="/images/cracker.svg" alt="Success icon" />
      </div>

      <h1 className="title">trident is now live!</h1>

      <p className="subtitle">
        Your digital identity is set up and ready to greet guests. Welcome to
        <br />
        IROAS.
      </p>

      <section className="checklist-card" aria-label="Setup checklist">
        <ul className="checklist">
          {CHECKLIST.map((item) => (
            <li className="checklist-item" key={item}>
              <span className="check-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13L10 18L19 7"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="item-label">{item}</span>
              <span className="item-status">DONE</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleDashboard}
        >
          Go to dashboard
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12H19M19 12L13 6M19 12L13 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={handlePreview}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 3H21V10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21 3L10 14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19 14V19C19 20.1046 18.1046 21 17 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5H10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Preview website
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={handleDownloadQR}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3V15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 10L12 15L17 10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 19H19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Download QR kit
        </button>
      </div>
    </main>
  )
}

export default GoLive
