import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { MESSAGES } from '../../constants/messages.js'
import './PosIntegration.css'

const PROVIDERS = [
  { name: 'Petpooja', desc: "Full menu + order sync, India's most used POS", status: 'Connected', action: 'Configure' },
  { name: 'Square', desc: 'Card terminal and catalog sync', status: 'Available', action: 'Connect' },
  { name: 'Toast', desc: 'Orders, checks and tips sync', status: 'Available', action: 'Connect' },
  { name: 'Posist', desc: 'Enterprise multi-outlet POS', status: 'Available', action: 'Connect' },
  { name: 'Zomato / Swiggy', desc: 'Aggregator order ingestion', status: 'Connected', action: 'Configure' },
  { name: 'Custom webhook', desc: 'Push orders to your own endpoint', status: 'Configured', action: 'Configure' },
]

const DEVICES = [
  { name: 'Kitchen KOT printer', meta: 'Epson TM-T82 · 192.168.1.24', online: true },
  { name: 'Bar KOT printer', meta: 'Epson TM-T82 · 192.168.1.25', online: true },
  { name: 'Counter bill printer', meta: 'TVS RP 3160 · USB', online: true },
  { name: 'Card terminal', meta: 'Pine Labs · Bluetooth', online: false },
]

const ACTIVITY = [
  { text: 'Pushed 14 menu items to Petpooja', time: '2 min ago', ok: true },
  { text: 'Pulled 3 aggregator orders from Swiggy', time: '18 min ago', ok: true },
  { text: 'Retried KOT print for order #10412', time: '44 min ago', ok: true },
  { text: 'Card terminal heartbeat missed', time: '1 hr ago', ok: false },
  { text: 'Full catalog sync completed (62 items)', time: '3 hr ago', ok: true },
]

const RULES = [
  { key: 'twoWay', label: 'Two-way menu sync', desc: 'Keep prices and availability identical in both systems', on: true },
  { key: 'autoAccept', label: 'Auto-accept POS orders', desc: 'Orders from POS skip the accept step in IROAS', on: true },
  { key: 'printKot', label: 'Print KOT on accept', desc: 'Fire kitchen tickets the moment an order is accepted', on: true },
  { key: 'pushPayments', label: 'Push payments to POS', desc: 'Online payments recorded as POS tenders', on: false },
  { key: 'syncTables', label: 'Sync table state', desc: 'Occupied / free status mirrors your floor plan', on: true },
]

function PosIntegration() {
  const toast = useToast()
  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))

  const [rules, setRules] = useState(RULES)

  const toggleRule = (key) => {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, on: !r.on } : r)))
  }


  
  return (
    <DashboardLayout pageClassName="pos-page" activeNav="pos">
<div className="page-head">
              <div>
                <p className="eyebrow">System</p>
                <h1>POS Integration</h1>
                <p className="page-desc">Connect your point-of-sale, printers and terminals so orders, menu and payments stay in sync.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => alert('Sync started — demo only, no real POS is connected.')}>⟳ Sync now</button>
            </div>

            <div className="stat-cards">
              <div className="stat-card"><span>📶 Connection</span><strong className="ok">Healthy</strong></div>
              <div className="stat-card"><span>⇅ Last sync</span><strong>2 min ago</strong></div>
              <div className="stat-card"><span>⊞ Items in sync</span><strong>62 / 62</strong></div>
              <div className="stat-card"><span>⚠ Failed jobs · 24h</span><strong>1</strong></div>
            </div>

            <div className="two-col">
              <section className="card">
                <h2>Providers</h2>
                <span className="muted-note">One primary POS, unlimited aggregators</span>
                <div className="provider-grid">
                  {PROVIDERS.map((p) => (
                    <div className="provider-card" key={p.name}>
                      <div className="provider-top">
                        <strong>{p.name}</strong>
                        <span className={`status-pill status-${p.status.toLowerCase()}`}>{p.status}</span>
                      </div>
                      <p>{p.desc}</p>
                      <button type="button" onClick={() => comingSoon(`${p.action} ${p.name} — coming soon in this demo.`)}>
                        {p.action === 'Configure' ? '⚙' : '⇗'} {p.action}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="side-col">
                <section className="card">
                  <h2>Devices</h2>
                  <span className="muted-note">Printers &amp; terminals on this floor</span>
                  <ul className="device-list">
                    {DEVICES.map((d) => (
                      <li key={d.name}>
                        <span className="device-ico">🖨</span>
                        <div className="device-main">
                          <strong>{d.name}</strong>
                          <p>{d.meta}</p>
                        </div>
                        <span className={`device-status ${d.online ? 'online' : 'offline'}`}>
                          <span className="dot" /> {d.online ? 'Online' : 'Offline'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button className="add-device-btn" type="button" onClick={() => comingSoon('Add device')}>+ Add device</button>
                </section>

                <section className="card">
                  <h2>Sync activity</h2>
                  <ul className="activity-list">
                    {ACTIVITY.map((a) => (
                      <li key={a.text}>
                        <span className={`activity-ico ${a.ok ? 'ok' : 'warn'}`}>{a.ok ? '✓' : '⟳'}</span>
                        <div>
                          <strong>{a.text}</strong>
                          <p>{a.time}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>

            <section className="card rules-card">
              <h2>Sync rules</h2>
              <span className="muted-note">Applies to the primary POS connection</span>
              {rules.map((r) => (
                <div className="rule-row" key={r.key}>
                  <div>
                    <strong>{r.label}</strong>
                    <p>{r.desc}</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={r.on} onChange={() => toggleRule(r.key)} />
                    <span className="slider"></span>
                  </label>
                </div>
              ))}
            </section>
    </DashboardLayout>
  )
}

export default PosIntegration
