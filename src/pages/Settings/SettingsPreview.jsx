import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import './SettingsPreview.css'

const PRESETS = {
  users: {
    title: 'Users & permissions',
    desc: 'Roles, invitations and access logs for your workspace.',
    rows: [
      { label: 'Ananya Rao', meta: 'Owner · active' },
      { label: 'Rohit Menon', meta: 'Manager · invited' },
      { label: 'Priya Nair', meta: 'Cashier · active' },
    ],
  },
  billing: {
    title: 'Billing & plan',
    desc: 'Plan, invoices and payment method preview.',
    rows: [
      { label: 'Pro plan', meta: '₹4,999 / month · renews 1 Oct' },
      { label: 'Card on file', meta: 'Visa ·••• 4242' },
      { label: 'Last invoice', meta: 'INV-2041 · Paid' },
    ],
  },
  security: {
    title: 'Security',
    desc: '2FA, sessions and allowlist preview.',
    rows: [
      { label: 'Two-factor auth', meta: 'Recommended · Off (demo)' },
      { label: 'Active sessions', meta: '2 devices' },
      { label: 'IP allowlist', meta: 'Not configured' },
    ],
  },
  'api-keys': {
    title: 'API keys',
    desc: 'Developer keys for integrations (demo values).',
    rows: [
      { label: 'Live key', meta: 'iroas_live_••••9f2a' },
      { label: 'Test key', meta: 'iroas_test_••••11bc' },
      { label: 'Webhook secret', meta: 'whsec_••••c4e1' },
    ],
  },
  backup: {
    title: 'Backup & restore',
    desc: 'Automatic snapshots and restore points.',
    rows: [
      { label: 'Daily snapshot', meta: 'Today 03:10 · 184 MB' },
      { label: 'Weekly archive', meta: 'Sun 02:00 · 1.2 GB' },
      { label: 'Restore', meta: 'Available for last 14 days' },
    ],
  },
  audit: {
    title: 'Audit logs',
    desc: 'Every action, every user — sample trail.',
    rows: [
      { label: 'Menu item updated', meta: 'Owner · 12 min ago' },
      { label: 'Staff invited', meta: 'Manager · 1 hour ago' },
      { label: 'Login success', meta: 'Owner · 3 hours ago' },
    ],
  },
  privacy: {
    title: 'Data privacy',
    desc: 'GDPR & DPDP request handling preview.',
    rows: [
      { label: 'Export requests', meta: '0 open' },
      { label: 'Deletion requests', meta: '1 in review (demo)' },
      { label: 'Retention policy', meta: '24 months order history' },
    ],
  },
}

function SettingsPreview({ presetKey }) {
  const navigate = useNavigate()
  const preset = PRESETS[presetKey] || PRESETS.users
  const [note, setNote] = useState('')

  return (
    <DashboardLayout pageClassName="settings-preview-page" activeNav="settings">
      <div className="page-head">
        <div>
          <button type="button" className="back-link" onClick={() => navigate('/settings')}>
            ← Settings
          </button>
          <h1>{preset.title}</h1>
          <p className="page-desc">{preset.desc}</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            setNote('Demo action applied — no live changes were made.')
            setTimeout(() => setNote(''), 2500)
          }}
        >
          Preview action
        </button>
      </div>

      {note ? <p className="muted-note">{note}</p> : null}

      <div className="card">
        <ul>
          {preset.rows.map((row) => (
            <li key={row.label}>
              <strong>{row.label}</strong>
              <span>{row.meta}</span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  )
}

export function SettingsUsers() {
  return <SettingsPreview presetKey="users" />
}
export function SettingsBilling() {
  return <SettingsPreview presetKey="billing" />
}
export function SettingsSecurity() {
  return <SettingsPreview presetKey="security" />
}
export function SettingsApiKeys() {
  return <SettingsPreview presetKey="api-keys" />
}
export function SettingsBackup() {
  return <SettingsPreview presetKey="backup" />
}
export function SettingsAudit() {
  return <SettingsPreview presetKey="audit" />
}
export function SettingsPrivacy() {
  return <SettingsPreview presetKey="privacy" />
}

export default SettingsPreview
