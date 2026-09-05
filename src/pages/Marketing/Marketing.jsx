import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { MESSAGES } from '../../constants/messages.js'
import './Marketing.css'

const CAMPAIGNS = [
  { icon: '🎟', name: 'WEEKEND25', meta: 'Coupon · 25% off', status: 'Live', progress: '412 / 1000' },
  { icon: '✉', name: 'Monsoon menu launch', meta: 'Email · 4.2k recipients', status: 'Sent', progress: 'Opened 38%' },
  { icon: '💬', name: 'Booking reminder', meta: 'SMS · auto', status: 'Active', progress: '1.1k sent' },
  { icon: '📱', name: 'Friday Tapas push', meta: 'Push notification', status: 'Scheduled', progress: 'Scheduled · Fri 5 PM' },
  { icon: '🎁', name: '₹500 gift card', meta: 'Gift card', status: 'Live', progress: 'Sold 86' },
  { icon: '🏆', name: 'Fig Club Loyalty', meta: 'Loyalty · 8 pts / ₹100', status: 'Live', progress: '1,240 members' },
]

function Marketing() {
  const toast = useToast()
  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))

    
      

  
  return (
    <DashboardLayout pageClassName="marketing-page" activeNav="marketing">
<div className="page-head">
              <div>
                <p className="eyebrow">Growth</p>
                <h1>Marketing</h1>
                <p className="page-desc">Coupons, loyalty, gift cards and campaigns across email, SMS and push — launch in minutes.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => comingSoon('New campaign')}>+ New campaign</button>
            </div>

            <div className="suggestion-card">
              <span className="suggestion-icon">✦</span>
              <div className="suggestion-body">
                <strong>Smart suggestion</strong>
                <p>Tuesdays are 31% slower than weekends. Try a 20% lunch offer for loyalty members.</p>
              </div>
              <button className="btn btn-dark" type="button" onClick={() => comingSoon('Create offer')}>Create offer</button>
            </div>

            <div className="section-head">
              <h2>Active campaigns</h2>
              <span className="muted-note">Across all channels</span>
            </div>

            <div className="campaign-grid">
              {CAMPAIGNS.map((c) => (
                <div className="campaign-card" key={c.name}>
                  <div className="campaign-top">
                    <span className="campaign-icon">{c.icon}</span>
                    <span className={`status-pill status-${c.status.toLowerCase()}`}>{c.status}</span>
                  </div>
                  <strong>{c.name}</strong>
                  <p>{c.meta}</p>
                  <div className="campaign-foot">
                    <span>{c.progress}</span>
                    <button type="button" onClick={() => comingSoon(`Manage ${c.name} — coming soon in this demo.`)}>Manage</button>
                  </div>
                </div>
              ))}
            </div>
    </DashboardLayout>
  )
}

export default Marketing
