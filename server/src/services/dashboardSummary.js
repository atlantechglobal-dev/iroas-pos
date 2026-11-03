import { zonedNow } from './reservationAvailability.js'

const DAY_MS = 86_400_000
const HOURS = Array.from({ length: 13 }, (_, i) => i + 10)
const LOW_STOCK_AT = 5
const CHANNEL_NAMES = { 'Dine In': 'Dine-in', 'Take Away': 'Takeaway' }

const round2 = (n) => Math.round(n * 100) / 100
const dateOf = (order) => String(order.postedAt || '').slice(0, 10)

function hourOf(order) {
  const match = / (\d{2}):/.exec(String(order.postedAt || ''))
  return match ? Number(match[1]) : null
}

function lastDays(today, count) {
  const base = Date.parse(`${today}T00:00:00Z`)
  return Array.from({ length: count }, (_, i) => new Date(base - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10))
}

const weekday = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

function stockLevel(qty) {
  if (qty <= 0) return 'Out'
  if (qty <= 2) return 'Critical'
  return 'Low'
}

/** Owner dashboard numbers from POS invoices, tables and menu stock. */
export function buildDashboardSummary({ orders = [], tables = [], items = [], currency = '', timezone = '', now = new Date() }) {
  const today = zonedNow(timezone, now).date
  const days = lastDays(today, 7)
  const yesterday = days[days.length - 2]

  const live = orders.filter((o) => o.state !== 'cancelled' && o.state !== 'returned')
  const on = (date) => live.filter((o) => dateOf(o) === date)
  const total = (list) => round2(list.reduce((sum, o) => sum + (o.total || 0), 0))
  const paid = (list) => list.filter((o) => o.state === 'paid')

  const todays = on(today)
  const todaysPaid = paid(todays)
  const yesterdays = on(yesterday)
  const revenue = total(todaysPaid)
  const revenueYesterday = total(paid(yesterdays))
  const open = todays.filter((o) => o.state === 'draft' || o.state === 'unbilled')

  const channelTotals = new Map()
  for (const order of todays) {
    const name = CHANNEL_NAMES[order.orderType] || order.orderType || 'Other'
    channelTotals.set(name, round2((channelTotals.get(name) || 0) + (order.total || 0)))
  }
  const channelSum = [...channelTotals.values()].reduce((a, b) => a + b, 0)

  const dineIn = tables.filter((t) => !t.takeAway)
  const occupied = dineIn.filter((t) => t.status === 'occupied').length

  return {
    currency,
    date: today,
    partial: orders.length >= 100,
    today: {
      revenue,
      orders: todays.length,
      paidOrders: todaysPaid.length,
      openOrders: open.length,
      openValue: total(open),
      avgOrder: todaysPaid.length ? round2(revenue / todaysPaid.length) : 0,
    },
    yesterday: { revenue: revenueYesterday, orders: yesterdays.length },
    revenueChangePct: revenueYesterday > 0 ? Math.round(((revenue - revenueYesterday) / revenueYesterday) * 1000) / 10 : null,
    series: days.map((date) => ({ date, label: weekday(date), revenue: total(paid(on(date))) })),
    hours: HOURS.map((hour) => ({ hour, orders: todays.filter((o) => hourOf(o) === hour).length })),
    channels: [...channelTotals.entries()]
      .map(([name, amount]) => ({ name, amount, pct: channelSum ? Math.round((amount / channelSum) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount),
    recent: [...live]
      .sort((a, b) => String(b.postedAt || '').localeCompare(String(a.postedAt || '')))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        state: o.state,
        table: o.table,
        orderType: o.orderType,
        customer: o.customer,
        qty: o.qty,
        total: o.total,
        postedAt: o.postedAt,
      })),
    tables: {
      total: dineIn.length,
      occupied,
      free: dineIn.filter((t) => t.status === 'free').length,
      seats: dineIn.reduce((sum, t) => sum + (t.seats || 0), 0),
      list: dineIn.map((t) => ({ id: t.id, name: t.name, status: t.status })),
    },
    lowStock: items
      .filter((i) => i.onMenu !== false && typeof i.stockQty === 'number' && i.stockQty <= LOW_STOCK_AT)
      .sort((a, b) => a.stockQty - b.stockQty)
      .slice(0, 4)
      .map((i) => ({ name: i.name, qty: i.stockQty, level: stockLevel(i.stockQty) })),
  }
}
