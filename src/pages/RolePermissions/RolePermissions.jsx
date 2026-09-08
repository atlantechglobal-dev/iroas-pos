import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import './RolePermissions.css'

const ROLES = [
  {
    name: 'Owner',
    members: 1,
    access: ['Full access', 'Billing', 'Staff', 'Settings'],
  },
  {
    name: 'Manager',
    members: 2,
    access: ['Orders', 'Menu', 'Reservations', 'Staff schedules'],
  },
  {
    name: 'Cashier',
    members: 4,
    access: ['POS', 'Payments', 'Receipts'],
  },
  {
    name: 'Kitchen',
    members: 6,
    access: ['KOT view', 'Order status'],
  },
]

const PERMISSIONS = [
  'View dashboard',
  'Manage menu',
  'Accept orders',
  'Issue refunds',
  'Edit restaurant profile',
  'Invite staff',
  'View analytics',
  'Manage billing',
]

function RolePermissions() {
  const [activeRole, setActiveRole] = useState('Manager')
  const [note, setNote] = useState('')
  const [checks, setChecks] = useState(() =>
    Object.fromEntries(PERMISSIONS.map((p, i) => [p, i < 5])),
  )

  const preview = (label) => {
    setNote(`${label} — demo preview saved locally for evaluation.`)
    setTimeout(() => setNote(''), 2500)
  }

  return (
    <DashboardLayout pageClassName="role-permissions-page" activeNav="role-permissions">
      <div className="page-head">
        <div>
          <p className="eyebrow">People</p>
          <h1>Role Permissions</h1>
          <p className="page-desc">
            Configure what each role can see and do. Demo toggles update the preview only.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => preview('Save permissions')}>
          Save permissions
        </button>
      </div>

      {note ? <p className="muted-note">{note}</p> : null}

      <div className="role-grid">
        {ROLES.map((role) => (
          <button
            key={role.name}
            type="button"
            className={`role-card ${activeRole === role.name ? 'active' : ''}`}
            onClick={() => setActiveRole(role.name)}
          >
            <strong>{role.name}</strong>
            <span>{role.members} members</span>
            <p>{role.access.join(' · ')}</p>
          </button>
        ))}
      </div>

      <div className="card">
        <h2>Permissions for {activeRole}</h2>
        <ul className="perm-list">
          {PERMISSIONS.map((perm) => (
            <li key={perm}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(checks[perm])}
                  onChange={() =>
                    setChecks((prev) => ({ ...prev, [perm]: !prev[perm] }))
                  }
                />
                {perm}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  )
}

export default RolePermissions
