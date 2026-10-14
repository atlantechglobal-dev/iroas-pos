// URY Table READ. Request mirrors the captured URY POS call
//   GET frappe.desk.reportview.get_list?doctype=URY Table&fields=[…]&limit=10000
// plus a `restaurant` filter (field confirmed in the URY Table DocType) so a
// tenant only ever receives its own URY Restaurant's tables.

const TABLE_FIELDS = [
  'name',
  'occupied',
  'latest_invoice_time',
  'restaurant',
  'restaurant_room',
  'no_of_seats',
  'is_take_away',
]

function toBoolOrNull(value) {
  if (value === 1 || value === true) return true
  if (value === 0 || value === false) return false
  return null
}

export function mapUryTable(row) {
  const occupied = toBoolOrNull(row.occupied)
  return {
    id: row.name,
    name: row.name,
    room: row.restaurant_room || '',
    seats: Number.isFinite(row.no_of_seats) && row.no_of_seats > 0 ? row.no_of_seats : null,
    takeAway: row.is_take_away === 1,
    status: occupied === true ? 'occupied' : occupied === false ? 'free' : 'unknown',
    lastInvoiceTime: row.latest_invoice_time || null,
  }
}

/** `tenant` comes from resolveUryTenant(); its client is the tenant's own integration user. */
export async function listUryTables(tenant) {
  const { client, uryRestaurant } = tenant
  const rows = await client.getList('URY Table', {
    fields: TABLE_FIELDS,
    filters: { restaurant: uryRestaurant },
  })
  return rows.filter((row) => row.restaurant === uryRestaurant).map(mapUryTable)
}
