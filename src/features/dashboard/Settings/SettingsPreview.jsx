import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import '@/features/dashboard/Settings/SettingsPreview.css'

const PRESETS = {
  users: { title: 'Users & permissions', desc: 'Roles, invitations and access for your team.' },
  billing: { title: 'Billing & plan', desc: 'Your plan, invoices and payment method.' },
  security: { title: 'Security', desc: 'Two-factor sign-in, sessions and access rules.' },
  'api-keys': { title: 'API keys', desc: 'Developer keys for integrations.' },
  backup: { title: 'Backup & restore', desc: 'Snapshots and restore points.' },
  audit: { title: 'Audit logs', desc: 'A trail of the changes made in your workspace.' },
  privacy: { title: 'Data privacy', desc: 'Data export, deletion requests and retention.' },
}

function SettingsPreview({ presetKey }) {
  const navigate = useNavigate()
  const preset = PRESETS[presetKey] || PRESETS.users

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
      </div>

      <div className="card" style={{ padding: 24 }}>
        <strong>Not available yet</strong>
        <p style={{ margin: '6px 0 0', color: '#8b8b8f' }}>This section will show your real data once it is enabled.</p>
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
