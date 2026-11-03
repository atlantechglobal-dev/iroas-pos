import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/shared/ui/layout/DashboardLayout'
import { useAuth } from '@/shared/hooks/useAuth'
import { useRestaurant } from '@/shared/hooks/useRestaurant'
import { HorizontalDragScroll } from '@/shared/ui/HorizontalDragScroll'
import { usePosResource } from '@/shared/hooks/usePosResource'
import { ROUTES } from '@/shared/constants/routes'
import { api } from '@/shared/lib/api'
import { SetupProgress } from '@/shared/ui/setup-progress/SetupProgress'
import { todayIso } from '@/shared/utils/localDate'
import '@/features/dashboard/Dashboard/Dashboard.css'

const REFRESH_MS = 30_000

function formatMoney(value, currency) {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', maximumFractionDigits: 2 }).format(amount)
  } catch {
    return amount.toFixed(2)
  }
}

function buildAreaPath(values, width, height, padding = 6) {
  if (!values.length) return { linePath: '', areaPath: '' }
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = (width - padding * 2) / (values.length - 1 || 1)
  const points = values.map((v, i) => [padding + i * stepX, padding + (1 - (v - min) / range) * (height - padding * 2)])
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1][0].toFixed(1)} ${height - padding} L ${points[0][0].toFixed(1)} ${height - padding} Z`
  return { linePath, areaPath }
}

const ORDER_STATE = {
  paid: { label: 'Paid', className: 'status-completed' },
  draft: { label: 'Open', className: 'status-preparing' },
  unbilled: { label: 'Open', className: 'status-preparing' },
}

function orderMeta(order) {
  const where = order.table ? `Table ${order.table}` : order.orderType || 'Order'
  const items = order.qty ? ` · ${order.qty} item${order.qty === 1 ? '' : 's'}` : ''
  return `${where} · ${order.customer || 'Guest'}${items}`
}

function orderTime(postedAt, today) {
  const text = String(postedAt || '')
  const time = text.slice(11, 16)
  return text.slice(0, 10) === today ? time : `${text.slice(5, 10)} ${time}`
}

function hourLabel(hour) {
  return hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`
}

function Dashboard() {
  const { user } = useAuth()
  const { displayRestaurant, restaurantStatus } = useRestaurant()
  const navigate = useNavigate()
  const summary = usePosResource(api.getDashboard, { refreshMs: REFRESH_MS })
  const data = summary.status === 'ready' ? summary.data : null
  const currency = data?.currency
  const [tonightReservations, setTonightReservations] = useState([])
  const [activeReservationCount, setActiveReservationCount] = useState(null)
  const [arrivingSoonCount, setArrivingSoonCount] = useState(0)
  const [setup, setSetup] = useState(null)

  useEffect(() => {
    api
      .getOnboardingProgress()
      .then((res) => setSetup(res.progress))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .getReservations()
      .then(({ reservations }) => {
        if (cancelled) return
        const today = todayIso()
        const now = new Date()
        const active = (reservations || []).filter((r) => r.status !== 'cancelled' && String(r.date) >= today)
        setActiveReservationCount(active.length)

        const todayActive = active.filter((r) => r.date === today)
        setArrivingSoonCount(
          todayActive.filter((r) => {
            const [h, m] = String(r.time || '').split(':').map(Number)
            if (Number.isNaN(h)) return false
            const slot = new Date(now)
            slot.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0)
            const diffMin = (slot.getTime() - now.getTime()) / 60000
            return diffMin >= 0 && diffMin <= 60
          }).length,
        )

        setTonightReservations(
          todayActive
            .sort((a, b) => String(a.time).localeCompare(String(b.time)))
            .slice(0, 6)
            .map((r) => {
              const [h, m] = String(r.time || '').split(':')
              const hour = Number(h)
              const ampm = hour >= 12 ? 'PM' : 'AM'
              const h12 = Number.isNaN(hour) ? r.time : `${((hour + 11) % 12) + 1}:${m || '00'} ${ampm}`
              return { name: r.guestName, meta: r.notes || r.phone || '—', time: h12, party: r.guests, status: r.status }
            }),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setTonightReservations([])
          setActiveReservationCount(0)
          setArrivingSoonCount(0)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = (user?.name || 'there').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()

  const series = useMemo(() => data?.series || [], [data])
  const { linePath, areaPath } = useMemo(() => buildAreaPath(series.map((d) => d.revenue), 600, 180), [series])
  const hours = data?.hours || []
  const maxOrders = Math.max(...hours.map((h) => h.orders), 1)
  const trend = data?.revenueChangePct

  const posNotice =
    summary.status === 'not_connected'
      ? 'Your POS is not connected yet, so sales numbers will appear once it is.'
      : summary.status === 'mapping_invalid'
        ? 'Your POS connection needs to be checked. Please contact IROAS support.'
        : summary.status === 'error'
          ? 'Sales numbers are temporarily unavailable.'
          : ''

  return (
    <DashboardLayout pageClassName="dashboard-page" activeNav="dashboard">
      {restaurantStatus && restaurantStatus !== 'live' ? (
        <div className="setup-banner">
          <div>
            <strong>Finish restaurant setup</strong>
            <p>Complete your profile, domain and brand to go live.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/restaurant-setup')}>
            Continue setup
          </button>
        </div>
      ) : null}

      {setup && !setup.complete ? <SetupProgress progress={setup} links hideDone title="Finish setting up" /> : null}

      <div className="page-head">
        <div>
          <p className="eyebrow">TODAY · {todayLabel}</p>
          <h1>{greeting}, {firstName}</h1>
          <p className="page-desc">
            Here&apos;s how {displayRestaurant} is performing right now. Live data refreshes every 30 seconds.
          </p>
        </div>
      </div>

      {posNotice ? <p className="empty-note">{posNotice}</p> : null}
      {data?.partial ? (
        <p className="empty-note">Showing the latest 100 orders; older days in the chart may be incomplete.</p>
      ) : null}

      <HorizontalDragScroll className="stat-cards">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">R</span>
            {trend == null ? <span className="trend up">Live</span> : <span className={`trend ${trend >= 0 ? 'up' : 'down'}`}>{trend >= 0 ? '↗ +' : '↘ '}{trend}%</span>}
          </div>
          <div className="stat-number">{data ? formatMoney(data.today.revenue, currency) : '—'}</div>
          <p className="stat-sub">Revenue today</p>
          <p className="stat-foot">{data ? `vs. yesterday ${formatMoney(data.yesterday.revenue, currency)}` : ' '}</p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">🧾</span>
            <span className="trend up">Live</span>
          </div>
          <div className="stat-number">{data ? data.today.orders : '—'}</div>
          <p className="stat-sub">Orders today</p>
          <p className="stat-foot">
            {data ? `${data.today.paidOrders} paid · ${data.today.openOrders} open (${formatMoney(data.today.openValue, currency)})` : ' '}
          </p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">👥</span>
            <span className="trend up">Live</span>
          </div>
          <div className="stat-number">{activeReservationCount == null ? '—' : activeReservationCount}</div>
          <p className="stat-sub">Active reservations</p>
          <p className="stat-foot">{arrivingSoonCount} arriving in next hour</p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">⏱</span>
            <span className="trend up">{data?.tables.total ? `${Math.round((data.tables.occupied / data.tables.total) * 100)}%` : 'Live'}</span>
          </div>
          <div className="stat-number">{data ? `${data.tables.occupied} / ${data.tables.total}` : '—'}</div>
          <p className="stat-sub">Tables occupied</p>
          <p className="stat-foot">{data ? `${data.tables.seats} seats` : ' '}</p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-ico">💳</span>
            <span className="trend up">Live</span>
          </div>
          <div className="stat-number">{data ? formatMoney(data.today.avgOrder, currency) : '—'}</div>
          <p className="stat-sub">Avg. order value</p>
          <p className="stat-foot">Paid orders today</p>
        </div>
      </HorizontalDragScroll>

      <div className="chart-row">
        <section className="card chart-card">
          <div className="card-head">
            <div>
              <h2>Revenue</h2>
              <span>Paid orders, last 7 days</span>
            </div>
          </div>
          <svg className="area-chart" viewBox="0 0 600 180" preserveAspectRatio="none">
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8bc53f" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#8bc53f" stopOpacity="0" />
              </linearGradient>
            </defs>
            {series.length ? (
              <>
                <path d={areaPath} fill="url(#revenueFill)" />
                <path d={linePath} fill="none" stroke="#8bc53f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}
          </svg>
          <div className="chart-axis">
            {series.map((d) => (
              <span key={d.date} title={`${d.date}: ${formatMoney(d.revenue, currency)}`}>{d.label}</span>
            ))}
          </div>
        </section>

        <section className="card bar-card">
          <div className="card-head">
            <div>
              <h2>Order trends</h2>
              <span>Today by hour</span>
            </div>
          </div>
          <div className="bar-chart">
            {hours.map((h) => (
              <div className="bar-col" key={h.hour}>
                <div className="bar" style={{ height: `${(h.orders / maxOrders) * 100}%` }} title={`${h.orders} orders`} />
              </div>
            ))}
          </div>
          <div className="chart-axis">
            {hours.map((h) => (
              <span key={h.hour}>{hourLabel(h.hour)}</span>
            ))}
          </div>
        </section>
      </div>

      <div className="two-col-row">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Recent orders</h2>
              <span>Latest from your POS</span>
            </div>
            <button className="link-btn" type="button" onClick={() => navigate(ROUTES.ORDERS)}>
              View all
            </button>
          </div>
          <ul className="order-list">
            {data && data.recent.length === 0 ? (
              <li>
                <div className="order-main">
                  <p>No orders yet. New orders show here as they come in.</p>
                </div>
              </li>
            ) : null}
            {(data?.recent || []).map((order) => {
              const state = ORDER_STATE[order.state] || { label: order.state, className: '' }
              return (
                <li key={order.id}>
                  <span className="order-id">{order.id.split('-').pop()}</span>
                  <div className="order-main">
                    <div className="order-top">
                      <span className={`status-pill ${state.className}`}>{state.label}</span>
                    </div>
                    <p>{orderMeta(order)}</p>
                  </div>
                  <div className="order-side">
                    <strong>{formatMoney(order.total, currency)}</strong>
                    <small>{orderTime(order.postedAt, data.date)}</small>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Tonight&apos;s reservations</h2>
              <span>{tonightReservations.length ? `${tonightReservations.length} active today` : 'No bookings for today yet'}</span>
            </div>
            <button className="link-btn" type="button" onClick={() => navigate(ROUTES.RESERVATIONS)}>
              Calendar
            </button>
          </div>
          <ul className="reservation-list">
            {tonightReservations.length === 0 ? (
              <li>
                <div className="reservation-main">
                  <strong>No reservations tonight</strong>
                  <p>Guest website bookings will show here.</p>
                </div>
              </li>
            ) : null}
            {tonightReservations.map((r) => (
              <li key={`${r.name}-${r.time}`}>
                <span className="party-count">{r.party}</span>
                <div className="reservation-main">
                  <strong>{r.name}</strong>
                  <p>{r.meta}</p>
                </div>
                <div className="reservation-side">
                  <strong>{r.time}</strong>
                  <small>{(r.status || 'pending').toUpperCase()}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="three-col-row">
        <section className="card">
          <div className="card-head">
            <div><h2>Channel mix</h2><span>Order value today</span></div>
          </div>
          <div className="channel-mix">
            {data && data.channels.length === 0 ? <p className="empty-note">No orders today yet.</p> : null}
            {(data?.channels || []).map((c) => (
              <div className="channel-item" key={c.name}>
                <div className="channel-labels">
                  <span>{c.name}</span>
                  <span>{formatMoney(c.amount, currency)} · {c.pct}%</span>
                </div>
                <div className="channel-track">
                  <div className="channel-fill" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div><h2>Low stock</h2><span>Menu items with 5 or fewer left</span></div>
            <button className="link-btn" type="button" onClick={() => navigate(ROUTES.MENU)}>
              Menu
            </button>
          </div>
          <ul className="stock-list">
            {data && data.lowStock.length === 0 ? (
              <li>
                <div>
                  <strong>Nothing running low</strong>
                  <p>Items you stock in the menu show here when they get low.</p>
                </div>
              </li>
            ) : null}
            {(data?.lowStock || []).map((item) => (
              <li key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.qty} left</p>
                </div>
                <span className={`level-pill level-${item.level.toLowerCase()}`}>{item.level}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div><h2>Floor status</h2><span>{data ? `${data.tables.total} tables · ${data.tables.seats} seats` : 'Tables'}</span></div>
            <button className="link-btn" type="button" onClick={() => navigate(ROUTES.TABLES)}>
              Tables
            </button>
          </div>
          <div className="floor-grid">
            {(data?.tables.list || []).map((table) => (
              <div key={table.id} className={`floor-cell floor-${table.status}`} title={`${table.name}: ${table.status}`}>
                {table.name.replace(/^T/i, '')}
              </div>
            ))}
          </div>
          <div className="floor-legend">
            <span><i className="dot floor-occupied" /> Occupied {data?.tables.occupied ?? 0}</span>
            <span><i className="dot floor-free" /> Free {data?.tables.free ?? 0}</span>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
