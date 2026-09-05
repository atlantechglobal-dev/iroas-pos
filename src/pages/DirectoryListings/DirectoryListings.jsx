import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useRestaurant } from '../../hooks/useRestaurant.js'
import './DirectoryListings.css'

const DIRECTORIES = [
  {
    name: 'Google Business Profile',
    meta: 'Verified · 4.7★ (1,204)',
    views: '18.4k',
    updated: 'Updated 2 hours ago',
    status: 'live',
    action: 'View',
  },
  {
    name: 'Zomato',
    meta: 'Claimed · 4.4★ (862)',
    views: '9.1k',
    updated: 'Updated Yesterday',
    status: 'live',
    action: 'View',
  },
  {
    name: 'Swiggy',
    meta: 'Menu prices out of sync (6 items)',
    views: '7.6k',
    updated: 'Updated 4 days ago',
    status: 'attention',
    action: 'Fix now',
  },
  {
    name: 'Apple Maps',
    meta: 'Verification postcard in transit',
    views: '1.2k',
    updated: 'Updated 6 days ago',
    status: 'pending',
    action: 'View',
  },
  {
    name: 'TripAdvisor',
    meta: 'Claimed · 4.5★ (318)',
    views: '2.3k',
    updated: 'Updated 3 days ago',
    status: 'live',
    action: 'View',
  },
  {
    name: 'Facebook Page',
    meta: 'Opening hours differ from profile',
    views: '4.0k',
    updated: 'Updated 1 week ago',
    status: 'attention',
    action: 'Fix now',
  },
  {
    name: 'Bing Places',
    meta: 'Submitted, awaiting review',
    views: '410',
    updated: 'Updated 2 weeks ago',
    status: 'pending',
    action: 'View',
  },
  {
    name: 'Justdial',
    meta: 'Claimed · phone verified',
    views: '1.8k',
    updated: 'Updated 5 days ago',
    status: 'live',
    action: 'View',
  },
]

const STATUS_LABEL = {
  live: 'Live',
  pending: 'Pending',
  attention: 'Needs attention',
}

function DirectoryListings() {
  const { displayRestaurant, restaurantStatus } = useRestaurant()
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [previewNote, setPreviewNote] = useState('')

  const handleSync = () => {
    setPreviewNote('Sync started — demo directories refresh with sample data.')
    setTimeout(() => setPreviewNote(''), 2500)
  }

  const handleAction = (name) => {
    setPreviewNote(`${name} — preview opened with sample listing data.`)
    setTimeout(() => setPreviewNote(''), 2500)
  }

  const filteredDirectories = DIRECTORIES.filter((directory) =>
    directory.name.toLowerCase().includes(directoryQuery.trim().toLowerCase()),
  )

  return (
    <DashboardLayout pageClassName="directory-page" activeNav="directory-listings">
      <div className="page-head">
        <div>
          <p className="eyebrow">Growth</p>
          <h1>Directory Listings</h1>
          <p className="page-desc">
            One profile, everywhere. Track accuracy of your name, address, hours
            and menu across every major directory.
            {restaurantStatus === 'onboarding'
              ? ` · ${displayRestaurant} is still completing setup.`
              : ''}
          </p>
        </div>

        <button className="btn btn-primary" type="button" onClick={handleSync}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12C4 7.58172 7.58172 4 12 4C15.0808 4 17.7461 5.78325 19.0429 8.4M20 12C20 16.4183 16.4183 20 12 20C8.91924 20 6.25392 18.2167 4.95712 15.6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M19 4V8.5H14.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 20V15.5H9.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sync all
        </button>
      </div>

      {previewNote ? <p className="muted-note">{previewNote}</p> : null}

      <div className="stat-cards">
        <div className="stat-card">
          <span className="pill pill-green">Live</span>
          <div className="stat-number">4</div>
          <p className="stat-sub">of 8 directories</p>
        </div>

        <div className="stat-card">
          <span className="pill pill-yellow">Pending</span>
          <div className="stat-number">2</div>
          <p className="stat-sub">of 8 directories</p>
        </div>

        <div className="stat-card">
          <span className="pill pill-red">Needs attention</span>
          <div className="stat-number">2</div>
          <p className="stat-sub">of 8 directories</p>
        </div>
      </div>

      <div className="directory-panel">
        <div className="directory-toolbar">
          <div className="search-bar search-bar-muted">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M20 20L16.5 16.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search directories..."
              value={directoryQuery}
              onChange={(event) => setDirectoryQuery(event.target.value)}
            />
          </div>

          <span className="sync-note">Last full sync · today 06:40</span>
        </div>

        <ul className="directory-list">
          {filteredDirectories.map((directory) => (
            <li className="directory-row" key={directory.name}>
              <div className="directory-main">
                <strong>{directory.name}</strong>
                <p>{directory.meta}</p>
              </div>

              <div className="directory-metric">
                <strong>{directory.views}</strong> monthly views
              </div>

              <div className="directory-updated">{directory.updated}</div>

              <span className={`status status-${directory.status}`}>
                {STATUS_LABEL[directory.status]}
              </span>

              <button
                className="btn btn-outline btn-xs"
                type="button"
                onClick={() => handleAction(directory.name)}
              >
                {directory.action}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  )
}

export default DirectoryListings
