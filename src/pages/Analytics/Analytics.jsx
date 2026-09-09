import { useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'
import { useRestaurant } from '../../hooks/useRestaurant.js'
import './Analytics.css'

const REVENUE_VALUES = [
  4200, 5100, 4700, 5600, 6100, 7400, 6900, 5400, 5900, 6400, 7100, 6600, 7900, 7500, 6200, 5800,
  6500, 7300, 8100, 7600, 7000, 8400, 9200, 9900, 10400, 9300, 8600, 7800, 8500, 9100,
]

const PEAK_HOURS = ['11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p']
const PEAK_COUNTS = [4, 12, 18, 8, 3, 4, 9, 16, 22, 27, 15, 8]
const CHANNEL_MIX = [
  { name: 'Dine-in', pct: 48, color: '#8bc53f' },
  { name: 'Delivery', pct: 34, color: '#c3e39a' },
  { name: 'Pickup', pct: 18, color: '#2e6fb5' },
]

const RANGES = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
]

function buildAreaPath(values, width, height, padding = { top: 12, right: 8, bottom: 8, left: 8 }) {
  const max = 10000
  const min = 0
  const range = max - min
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const stepX = innerW / (values.length - 1 || 1)
  const points = values.map((v, i) => {
    const x = padding.left + i * stepX
    const y = padding.top + (1 - Math.min(v, max) / range) * innerH
    return [x, y]
  })
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const first = points[0]
  const baseY = height - padding.bottom
  const areaPath = `${linePath} L ${last[0].toFixed(1)} ${baseY} L ${first[0].toFixed(1)} ${baseY} Z`
  return { linePath, areaPath }
}

function buildDonut(segments) {
  let cumulative = 0
  const radius = 58
  const circumference = 2 * Math.PI * radius
  return segments.map((seg) => {
    const dash = (seg.pct / 100) * circumference
    const offset = circumference * (1 - cumulative / 100)
    cumulative += seg.pct
    return { ...seg, radius, dash, gap: circumference - dash, offset }
  })
}

function Analytics() {
  const { displayRestaurant } = useRestaurant()
  const [range, setRange] = useState('30d')
  const [channel, setChannel] = useState('all')

  const { linePath, areaPath } = useMemo(() => buildAreaPath(REVENUE_VALUES, 720, 240), [])
  const donut = useMemo(() => buildDonut(CHANNEL_MIX), [])
  const maxPeak = Math.max(...PEAK_COUNTS)
  const yTicks = [10000, 7500, 5000, 2500, 0]
  const xLabels = [1, 5, 10, 15, 20, 25, 30]
  const peakYTicks = [28, 21, 14, 7, 0]

  return (
    <DashboardLayout pageClassName="analytics-page" activeNav="analytics">
      <div className="page-head">
        <div>
          <p className="eyebrow">Insights</p>
          <h1>Analytics</h1>
          <p className="page-desc">
            Executive metrics for {displayRestaurant} across revenue, operations and guests. Filter by
            date, channel and venue.
          </p>
        </div>
        <div className="analytics-filters">
          <div className="range-toggle" role="tablist" aria-label="Date range">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={range === item.id ? 'active' : ''}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            className="channel-select"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            aria-label="Channel"
          >
            <option value="all">All channels</option>
            <option value="dine-in">Dine-in</option>
            <option value="delivery">Delivery</option>
            <option value="pickup">Pickup</option>
          </select>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span>Revenue · {range}</span>
          <strong>₹38.4 L</strong>
          <small className="up">+14.2%</small>
        </div>
        <div className="stat-card">
          <span>Tickets</span>
          <strong>5,184</strong>
          <small className="up">+9.6%</small>
        </div>
        <div className="stat-card">
          <span>Avg. ticket</span>
          <strong>₹741</strong>
          <small className="up">+4.4%</small>
        </div>
        <div className="stat-card">
          <span>New customers</span>
          <strong>812</strong>
          <small className="up">+22%</small>
        </div>
      </div>

      <div className="chart-row">
        <section className="card revenue-card">
          <div className="card-head">
            <div>
              <h2>Revenue trend</h2>
              <span>Last 30 days</span>
            </div>
          </div>
          <div className="trend-chart">
            <div className="y-axis" aria-hidden="true">
              {yTicks.map((tick) => (
                <span key={tick}>{tick === 0 ? '0' : tick.toLocaleString('en-IN')}</span>
              ))}
            </div>
            <div className="trend-plot">
              <svg className="area-chart" viewBox="0 0 720 240" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8bc53f" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#8bc53f" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.05, 0.29, 0.53, 0.77, 0.95].map((pct) => (
                  <line
                    key={pct}
                    x1="8"
                    x2="712"
                    y1={240 * pct}
                    y2={240 * pct}
                    stroke="#ece8df"
                    strokeWidth="1"
                  />
                ))}
                <path d={areaPath} fill="url(#revFill)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#8bc53f"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="chart-axis">
                {xLabels.map((day) => (
                  <span key={day}>D{day}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card mix-card">
          <div className="card-head">
            <div>
              <h2>Channel mix</h2>
              <span>By revenue share</span>
            </div>
          </div>
          <div className="donut-wrap">
            <svg viewBox="0 0 160 160" width="168" height="168">
              {donut.map((seg) => (
                <circle
                  key={seg.name}
                  cx="80"
                  cy="80"
                  r={seg.radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="22"
                  strokeDasharray={`${seg.dash} ${seg.gap}`}
                  strokeDashoffset={seg.offset}
                  transform="rotate(-90 80 80)"
                  strokeLinecap="butt"
                />
              ))}
              <text x="80" y="76" textAnchor="middle" className="donut-value">
                100%
              </text>
              <text x="80" y="96" textAnchor="middle" className="donut-label">
                revenue
              </text>
            </svg>
          </div>
          <ul className="legend-list">
            {CHANNEL_MIX.map((item) => (
              <li key={item.name}>
                <span className="legend-dot" style={{ background: item.color }} />
                {item.name}
                <strong>{item.pct}%</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card peak-card">
        <div className="card-head">
          <div>
            <h2>Peak hours</h2>
            <span>Average orders per hour</span>
          </div>
        </div>
        <div className="peak-chart">
          <div className="y-axis peak-y" aria-hidden="true">
            {peakYTicks.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
          <div className="peak-plot">
            <div className="bar-chart">
              {PEAK_COUNTS.map((count, i) => (
                <div className="bar-col" key={PEAK_HOURS[i]}>
                  <div
                    className="bar"
                    style={{ height: `${(count / maxPeak) * 100}%` }}
                    title={`${count} orders at ${PEAK_HOURS[i]}`}
                  />
                </div>
              ))}
            </div>
            <div className="chart-axis">
              {PEAK_HOURS.map((hour) => (
                <span key={hour}>{hour}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default Analytics
