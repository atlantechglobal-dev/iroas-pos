// URY order READ. URY POS records every order as a POS Invoice (Draft while the
// table is open, Paid once settled); `restaurant` links it to the URY Restaurant.
//   list:   get_list POS Invoice filtered by restaurant, newest first
//   items:  getdoc POS Invoice <name> -> items[] (POS Invoice Item rows)
// `URY Order` itself cannot be listed (get_list returns 500), so it is not used.

const INVOICE_FIELDS = [
  'name',
  'status',
  'docstatus',
  'order_type',
  'restaurant',
  'restaurant_table',
  'customer',
  'customer_name',
  'mobile_number',
  'grand_total',
  'rounded_total',
  'currency',
  'posting_date',
  'posting_time',
  'total_qty',
  'waiter',
  'modified',
]

const LIST_LIMIT = 100
const DETAIL_LIMIT = 30

const PAID_STATUSES = new Set(['Paid', 'Submitted', 'Consolidated'])
const RETURN_STATUSES = new Set(['Return', 'Credit Note Issued'])

/** open: still on the table (Draft) · unpaid: submitted, awaiting payment · paid · cancelled · returned */
export function mapInvoiceState(row) {
  if (row.status === 'Cancelled' || row.docstatus === 2) return 'cancelled'
  if (row.docstatus === 0 || row.status === 'Draft') return 'open'
  if (RETURN_STATUSES.has(row.status)) return 'returned'
  if (PAID_STATUSES.has(row.status)) return 'paid'
  return 'unpaid'
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function mapUryInvoice(row, items = null) {
  return {
    id: row.name,
    state: mapInvoiceState(row),
    posStatus: row.status || '',
    orderType: row.order_type || '',
    table: row.restaurant_table || '',
    customer: row.customer_name || row.customer || '',
    phone: row.mobile_number || '',
    waiter: row.waiter || '',
    total: num(row.rounded_total) || num(row.grand_total),
    currency: row.currency || null,
    qty: num(row.total_qty),
    postedAt: row.posting_date ? `${row.posting_date}${row.posting_time ? ` ${String(row.posting_time).slice(0, 8)}` : ''}` : null,
    updatedAt: row.modified || null,
    items,
  }
}

function mapItems(doc) {
  return (doc.items || [])
    .filter((it) => it.parent === doc.name)
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
    .map((it) => ({
      id: it.name,
      name: it.item_name || it.item_code || '',
      qty: num(it.qty),
      rate: num(it.rate),
      amount: num(it.amount),
    }))
}

export async function listUryOrders({ client, uryRestaurant }) {
  const rows = (
    await client.getList('POS Invoice', {
      fields: INVOICE_FIELDS,
      filters: { restaurant: uryRestaurant },
      orderBy: 'modified desc',
      limit: LIST_LIMIT,
    })
  ).filter((row) => row.restaurant === uryRestaurant)

  const withItems = new Set(
    rows
      .filter((row) => ['open', 'unpaid'].includes(mapInvoiceState(row)))
      .slice(0, DETAIL_LIMIT)
      .map((row) => row.name),
  )
  const details = new Map()
  await Promise.all(
    [...withItems].map(async (name) => {
      const doc = (await client.getDoc('POS Invoice', name)).docs[0]
      if (doc.restaurant === uryRestaurant) details.set(name, mapItems(doc))
    }),
  )

  return rows.map((row) => mapUryInvoice(row, details.get(row.name) ?? null))
}

/** Customers are global in URY (no restaurant field), so derive them from this restaurant's invoices. */
export async function listUryCustomers({ client, uryRestaurant }) {
  const rows = (
    await client.getList('POS Invoice', {
      fields: ['name', 'restaurant', 'status', 'docstatus', 'customer', 'customer_name', 'mobile_number', 'grand_total', 'rounded_total', 'currency', 'posting_date'],
      filters: { restaurant: uryRestaurant },
      orderBy: 'posting_date desc',
    })
  ).filter((row) => row.restaurant === uryRestaurant && row.customer)

  const byCustomer = new Map()
  for (const row of rows) {
    const state = mapInvoiceState(row)
    if (state === 'cancelled' || state === 'returned') continue
    let entry = byCustomer.get(row.customer)
    if (!entry) {
      entry = {
        id: row.customer,
        name: row.customer_name || row.customer,
        phone: row.mobile_number || '',
        visits: 0,
        spend: 0,
        currency: row.currency || null,
        lastVisit: row.posting_date || null,
      }
      byCustomer.set(row.customer, entry)
    }
    entry.visits += 1
    if (state === 'paid') entry.spend += num(row.rounded_total) || num(row.grand_total) || 0
    if (!entry.phone && row.mobile_number) entry.phone = row.mobile_number
    if (row.posting_date && (!entry.lastVisit || row.posting_date > entry.lastVisit)) entry.lastVisit = row.posting_date
  }
  return [...byCustomer.values()].sort((a, b) => String(b.lastVisit || '').localeCompare(String(a.lastVisit || '')))
}
