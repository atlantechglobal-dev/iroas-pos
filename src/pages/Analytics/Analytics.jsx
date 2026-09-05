import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useToast } from '../../components/feedback/ToastProvider.jsx'
import { MESSAGES } from '../../constants/messages.js'
import './Analytics.css'

function generateSeries(n, base, amplitude) {
  return Array.from({ length: n }, (_, i) =>
    Math.round(base + amplitude * Math.sin(i / 3.4) + (i % 7 === 5 ? amplitude * 0.5 : 0)),
  )
}

const REVENUE_VALUES = generateSeries(30, 5800, 2200)
const PEAK_HOURS = ['11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p']
const PEAK_COUNTS = [3, 12, 16, 8, 2, 1, 6, 13, 21, 27, 14, 6]
const CHANNEL_MIX = [
  { name: 'Dine-in', pct: 48, color: '#8bc53f' },
  { name: 'Delivery', pct: 34, color: '#c3e39a' },
  { name: 'Pickup', pct: 18, color: '#2e6fb5' },
]

function buildAreaPath(values, width, height, padding = 6) {
  const max = Math.max(...values)
  const min = 0
  const range = max - min || 1
  const stepX = (width - padding * 2) / (values.length - 1 || 1)
  const points = values.map((v, i) => {
    const x = padding + i * stepX
    const y = padding + (1 - (v - min) / range) * (height - padding * 2)
    return [x, y]
  })
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1][0].toFixed(1)} ${height - padding} L ${points[0][0].toFixed(1)} ${height - padding} Z`
  return { linePath, areaPath }
}

function buildDonut(segments) {
  let cumulative = 0
  const radius = 60
  const circumference = 2 * Math.PI * radius
  return segments.map((seg) => {
    const dash = (seg.pct / 100) * circumference
    const offset = circumference - (cumulative / 100) * circumference
    cumulative += seg.pct
    return { ...seg, dash, gap: circumference - dash, offset }
  })
}

function Analytics() {
  const toast = useToast()
  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))

  const displayRestaurant = restaurantName.trim() || 'Your restaurant'
  const { linePath, areaPath } = useMemo(() => buildAreaPath(REVENUE_VALUES, 900, 220), [])
  const donut = useMemo(() => buildDonut(CHANNEL_MIX), [])
  const maxPeak = Math.max(...PEAK_COUNTS)


  
  return (
    <DashboardLayout pageClassName="analytics-page" activeNav="analytics">
<div className="page-head">
              <div>
                <p className="eyebrow">Insights</p>
                <h1>Analytics</h1>
                <p className="page-desc">Executive metrics across revenue, operations and guests. Filter by date, channel and venue.</p>
              </div>
            </div>

            <div className="stat-cards">
              <div className="stat-card"><span>Revenue · 30d</span><strong>₹38.4 L</strong><small className="up">+14.2%</small></div>
              <div className="stat-card"><span>Tickets</span><strong>5,184</strong><small className="up">+9.6%</small></div>
              <div className="stat-card"><span>Avg. ticket</span><strong>₹741</strong><small className="up">+4.4%</small></div>
              <div className="stat-card"><span>New customers</span><strong>812</strong><small className="up">+22%</small></div>
            </div>

            <div className="chart-row">
              <section className="card revenue-card">
                <h2>Revenue trend</h2>
                <span className="muted-note">Last 30 days</span>
                <svg className="area-chart" viewBox="0 0 900 220" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8bc53f" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#8bc53f" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#revFill)" />
                  <path d={linePath} fill="none" stroke="#8bc53f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </section>

              <section className="card mix-card">
                <h2>Channel mix</h2>
                <span className="muted-note">By revenue share</span>
                <div className="donut-wrap">
                  <svg viewBox="0 0 160 160" width="150" height="150">
                    {donut.map((seg) => (
                      <circle key={seg.name} cx="80" cy="80" r="60" fill="none" stroke={seg.color} strokeWidth="20"
                        strokeDasharray={`${seg.dash} ${seg.gap}`} strokeDashoffset={seg.offset}
                        transform="rotate(-90 80 80)" />
                    ))}
                  </svg>
                </div>
                <ul className="legend-list">
                  {CHANNEL_MIX.map((c) => (
                    <li key={c.name}><span className="legend-dot" style={{ background: c.color }} />{c.name}<strong>{c.pct}%</strong></li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="card peak-card">
              <h2>Peak hours</h2>
              <span className="muted-note">Average orders per hour</span>
              <div className="bar-chart">
                {PEAK_COUNTS.map((count, i) => (
                  <div className="bar-col" key={PEAK_HOURS[i]}>
                    <div className="bar" style={{ height: `${(count / maxPeak) * 100}%` }} title={`${count} orders`} />
                  </div>
                ))}
              </div>
              <div className="chart-axis">
                {PEAK_HOURS.map((h) => <span key={h}>{h}</span>)}
              </div>
            </section>
    </DashboardLayout>
  )
}

export default Analytics
