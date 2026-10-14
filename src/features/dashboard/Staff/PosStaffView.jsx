import { useState } from 'react'

function initials(name) {
  return (
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  )
}

function PosStaffView({ posStaff }) {
  const [query, setQuery] = useState('')
  const staff = posStaff.data?.staff || []
  const q = query.trim().toLowerCase()
  const filtered = staff.filter(
    (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
  )
  const activeCount = staff.filter((p) => p.active).length
  const posCount = staff.filter((p) => p.posAccess).length

  if (posStaff.status === 'loading') return <p className="empty-note">Loading staff…</p>
  if (posStaff.status === 'mapping_invalid') {
    return (
      <div className="card">
        <p className="empty-note">Your POS connection needs to be checked. Please contact IROAS support.</p>
      </div>
    )
  }
  if (posStaff.status === 'error') {
    return (
      <div className="card pos-staff-error">
        <p>Staff service is temporarily unavailable. Please try again.</p>
        <button type="button" className="btn btn-outline" onClick={posStaff.reload}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><span>Team members</span><strong>{staff.length}</strong></div>
        <div className="stat-card"><span>Active</span><strong>{activeCount}</strong></div>
        <div className="stat-card"><span>POS access</span><strong>{posCount}</strong></div>
        <div className="stat-card"><span>Branch</span><strong className="pos-branch">{posStaff.data?.branch || '—'}</strong></div>
      </div>

      <div className="card directory-card">
        <div className="directory-head">
          <div>
            <h2>
              <span className="pos-live-dot" /> POS team
            </h2>
            <span className="muted-note">
              {filtered.length} of {staff.length} shown · managed in your POS
            </span>
          </div>
          <div className="pos-staff-tools">
            <input className="directory-search" type="text" placeholder="Search staff..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" className="btn btn-outline" onClick={posStaff.reload}>Refresh</button>
          </div>
        </div>

        <ul className="staff-list">
          {filtered.map((p) => (
            <li key={p.id}>
              <span className="staff-avatar">{initials(p.name)}</span>
              <div className="staff-main">
                <strong>{p.name}</strong>
                <p>{[p.designation, p.department, p.email].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <div className="staff-hours">{p.joinedOn ? `Joined ${p.joinedOn}` : ''}</div>
              <div className="staff-hours">{p.room ? `Room · ${p.room}` : ''}</div>
              {p.posAccess ? <span className="pos-access-pill">POS access</span> : <span className="pos-access-pill is-none">No POS access</span>}
              <div className="staff-status">
                <span className={`status-dot ${p.active ? 'green' : 'gray'}`} />
                {p.active ? 'Active' : p.employeeStatus || 'Inactive'}
              </div>
            </li>
          ))}
          {staff.length === 0 && <p className="empty-note">No staff are assigned to your branch in the POS yet.</p>}
          {staff.length > 0 && filtered.length === 0 && <p className="empty-note">No staff match your search.</p>}
        </ul>
      </div>
    </>
  )
}

export default PosStaffView
