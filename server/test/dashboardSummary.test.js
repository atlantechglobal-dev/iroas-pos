import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardSummary } from '../src/services/dashboardSummary.js'

const NOW = new Date('2026-10-31T10:00:00Z')
const order = (id, postedAt, state, total, extra = {}) => ({ id, postedAt, state, total, orderType: 'Dine In', table: 'T1', customer: 'Guest', qty: 1, ...extra })
const build = (orders, rest = {}) => buildDashboardSummary({ orders, currency: 'ZAR', timezone: 'Africa/Johannesburg', now: NOW, ...rest })

const ORDERS = [
  order('A', '2026-10-31 12:10:00', 'paid', 100),
  order('B', '2026-10-31 12:40:00', 'paid', 50),
  order('C', '2026-10-31 19:05:00', 'unbilled', 70),
  order('D', '2026-10-31 19:30:00', 'cancelled', 999),
  order('E', '2026-10-30 13:00:00', 'paid', 120, { orderType: 'Take Away', table: '' }),
  order('F', '2026-10-24 13:00:00', 'paid', 500),
]

test('today counts only live orders; revenue counts only paid ones; cancelled never count', () => {
  const s = build(ORDERS)
  assert.equal(s.today.revenue, 150)
  assert.equal(s.today.orders, 3)
  assert.equal(s.today.paidOrders, 2)
  assert.equal(s.today.openOrders, 1)
  assert.equal(s.today.openValue, 70)
  assert.equal(s.today.avgOrder, 75)
})

test('yesterday comparison and percentage change', () => {
  const s = build(ORDERS)
  assert.deepEqual(s.yesterday, { revenue: 120, orders: 1 })
  assert.equal(s.revenueChangePct, 25)
  assert.equal(build([order('X', '2026-10-31 12:00:00', 'paid', 10)]).revenueChangePct, null)
})

test('7-day series is oldest to newest and ignores orders older than the window', () => {
  const s = build(ORDERS)
  assert.equal(s.series.length, 7)
  assert.equal(s.series[6].date, '2026-10-31')
  assert.equal(s.series[6].revenue, 150)
  assert.equal(s.series[5].revenue, 120)
  assert.equal(s.series.reduce((sum, d) => sum + d.revenue, 0), 270)
})

test('orders by hour, channel mix and recent list', () => {
  const s = build(ORDERS)
  const at = (h) => s.hours.find((x) => x.hour === h).orders
  assert.equal(at(12), 2)
  assert.equal(at(19), 1)
  assert.deepEqual(s.channels, [{ name: 'Dine-in', amount: 220, pct: 100 }])
  assert.deepEqual(s.recent.map((o) => o.id), ['C', 'B', 'A', 'E', 'F'])
})

test('the restaurant timezone decides what "today" is', () => {
  const lateUtc = new Date('2026-10-30T22:30:00Z')
  const s = buildDashboardSummary({ orders: ORDERS, timezone: 'Africa/Johannesburg', now: lateUtc })
  assert.equal(s.date, '2026-10-31')
  assert.equal(s.today.orders, 3)
})

test('tables: take-away tables are not counted; stock: low items sorted, off-menu items skipped', () => {
  const s = build([], {
    tables: [
      { id: 'T1', name: 'T1', status: 'occupied', seats: 4 },
      { id: 'T2', name: 'T2', status: 'free', seats: 2 },
      { id: 'TA', name: 'TA', status: 'free', takeAway: true, seats: 1 },
    ],
    items: [
      { name: 'Soup', stockQty: 4, onMenu: true },
      { name: 'Pie', stockQty: 0, onMenu: true },
      { name: 'Old', stockQty: 1, onMenu: false },
      { name: 'Rice', stockQty: 50, onMenu: true },
      { name: 'Untracked', stockQty: null, onMenu: true },
    ],
  })
  assert.deepEqual(s.tables, { total: 2, occupied: 1, free: 1, seats: 6, list: [{ id: 'T1', name: 'T1', status: 'occupied' }, { id: 'T2', name: 'T2', status: 'free' }] })
  assert.deepEqual(s.lowStock, [{ name: 'Pie', qty: 0, level: 'Out' }, { name: 'Soup', qty: 4, level: 'Low' }])
})

test('an empty restaurant yields zeros, not NaN, and flags partial coverage at 100 orders', () => {
  const s = build([])
  assert.equal(s.today.revenue, 0)
  assert.equal(s.today.avgOrder, 0)
  assert.deepEqual(s.channels, [])
  assert.equal(s.partial, false)
  assert.equal(build(Array.from({ length: 100 }, (_, i) => order(`O${i}`, '2026-10-31 12:00:00', 'paid', 1))).partial, true)
})
