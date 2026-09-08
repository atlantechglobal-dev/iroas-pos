import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { useRestaurant } from '../../hooks/useRestaurant.js'
import './Staff.css'

const ROLES = ['Owner', 'Manager', 'Chef', 'Cashier', 'Waiter', 'Kitchen Staff']

const DIRECTORY = [
  { initials: 'KM', name: 'Karan Mehta', role: 'Head Chef', hours: '12:00 – 23:00', attendance: 96, rating: 4.8, status: 'On floor', dot: 'green' },
  { initials: 'PS', name: 'Priya Shah', role: 'Server', hours: '17:00 – 23:30', attendance: 92, rating: 4.6, status: 'Serving T-12', dot: 'blue' },
  { initials: 'DI', name: 'Dev Iyer', role: 'Server', hours: '17:00 – 23:30', attendance: 88, rating: 4.3, status: 'On break', dot: 'yellow' },
  { initials: 'AR', name: 'Anita Rao', role: 'Cashier', hours: '10:00 – 19:00', attendance: 99, rating: 4.9, status: 'At POS', dot: 'green' },
  { initials: 'RV', name: 'Rahul Verma', role: 'Kitchen', hours: '10:00 – 19:00', attendance: 81, rating: 4.1, status: 'Off shift', dot: 'gray' },
  { initials: 'SK', name: 'Sneha K.', role: 'Manager', hours: '12:00 – 23:30', attendance: 97, rating: 4.7, status: 'Floor walk', dot: 'blue' },
]

function Staff() {
  const toast = useToast()
  const { displayRestaurant } = useRestaurant()
  const preview = (label) => toast.info(`${label} — demo preview with sample data.`)

  const [activeRole, setActiveRole] = useState('Owner')
  const [query, setQuery] = useState('')

  const filtered = DIRECTORY.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

  
  return (
    <DashboardLayout pageClassName="staff-page" activeNav="staff">
<div className="page-head">
              <div>
                <p className="eyebrow">People</p>
                <h1>Staff</h1>
                <p className="page-desc">Directory, roles, schedules and performance for every team member at {displayRestaurant}.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => preview('Invite member')}>+ Invite member</button>
            </div>

            <div className="stat-cards">
              <div className="stat-card"><span>Total staff</span><strong>{DIRECTORY.length * 4}</strong></div>
              <div className="stat-card"><span>On shift now</span><strong>{DIRECTORY.filter((p) => p.dot !== 'gray').length}</strong></div>
              <div className="stat-card"><span>Avg. attendance</span><strong>{Math.round(DIRECTORY.reduce((s, p) => s + p.attendance, 0) / DIRECTORY.length)}%</strong></div>
              <div className="stat-card"><span>Avg. rating</span><strong>{(DIRECTORY.reduce((s, p) => s + p.rating, 0) / DIRECTORY.length).toFixed(1)} ★</strong></div>
            </div>

            <div className="card roles-card">
              <h2>Roles</h2>
              <span className="muted-note">Tap a role to edit permissions</span>
              <div className="role-chips">
                {ROLES.map((r) => (
                  <button key={r} type="button" className={`chip ${activeRole === r ? 'active' : ''}`}
                    onClick={() => setActiveRole(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="card directory-card">
              <div className="directory-head">
                <div>
                  <h2>Directory</h2>
                  <span className="muted-note">{filtered.length} of {DIRECTORY.length} shown</span>
                </div>
                <input className="directory-search" type="text" placeholder="Search staff..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>

              <ul className="staff-list">
                {filtered.map((p) => (
                  <li key={p.name}>
                    <span className="staff-avatar">{p.initials}</span>
                    <div className="staff-main">
                      <strong>{p.name}</strong>
                      <p>{p.role}</p>
                    </div>
                    <div className="staff-hours">{p.hours}</div>
                    <div className="staff-metric">{p.attendance}%</div>
                    <div className="staff-metric rating">{p.rating} ★</div>
                    <div className="staff-status"><span className={`status-dot ${p.dot}`} />{p.status}</div>
                  </li>
                ))}
                {filtered.length === 0 && <p className="empty-note">No staff match your search.</p>}
              </ul>
            </div>
    </DashboardLayout>
  )
}

export default Staff
