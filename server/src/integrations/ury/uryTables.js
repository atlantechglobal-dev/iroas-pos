// URY Table READ. Request mirrors the captured URY POS call
//   GET frappe.desk.reportview.get_list?doctype=URY Table&fields=[…]&limit=10000
// plus a `restaurant` filter (field confirmed in the URY Table DocType) so a
// tenant only ever receives its own URY Restaurant's tables.

import { UryError } from './uryClient.js'

const TABLE_FIELDS = [
  'name',
  'occupied',
  'latest_invoice_time',
  'restaurant',
  'restaurant_room',
  'no_of_seats',
  'is_take_away',
  'table_shape',
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
    shape: row.table_shape || '',
    status: occupied === true ? 'occupied' : occupied === false ? 'free' : 'unknown',
    lastInvoiceTime: row.latest_invoice_time || null,
  }
}

/** Dine-in tables grouped by room, matching the URY POS Select Table dialog. */
export function groupDineTables(tables) {
  const rooms = new Map()
  for (const table of tables) {
    if (table.takeAway) continue
    const room = table.room || 'Tables'
    if (!rooms.has(room)) rooms.set(room, [])
    rooms.get(room).push({
      name: table.name,
      room,
      seats: table.seats,
      shape: table.shape || '',
      occupied: table.status === 'occupied',
    })
  }
  return [...rooms.entries()]
    .map(([name, roomTables]) => ({
      name,
      tables: roomTables.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const TABLE_SHAPES = ['Square', 'Rectangle', 'Circle']

export class TableEditError extends Error {
  constructor(code, message, { status = 400 } = {}) {
    super(message)
    this.name = 'TableEditError'
    this.code = code
    this.status = status
  }
}

function cleanTableName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 140)
}

async function branchRooms(client, branch) {
  try {
    const rows = await client.getList('URY Room', {
      fields: ['name', 'branch'],
      filters: [['branch', '=', branch]],
      limit: 100,
    })
    return rows.filter((row) => row.branch === branch).map((row) => row.name)
  } catch (err) {
    if (err instanceof UryError && (err.code === 'forbidden' || err.code === 'not_found')) return []
    throw err
  }
}

/** Branch and rooms the Add Dining Table form can use. */
export async function getUryTableOptions(tenant) {
  return {
    branch: tenant.branch,
    restaurant: tenant.uryRestaurant,
    rooms: await branchRooms(tenant.client, tenant.branch),
    shapes: TABLE_SHAPES,
  }
}

/** Creates a URY Table for this restaurant. Same fields as the URY Add Dining Table screen. */
export async function createUryTable(tenant, input = {}) {
  const name = cleanTableName(input.name)
  const seats = Number(input.seats)
  const minimumSeating = Number(input.minimumSeating)
  const room = cleanTableName(input.room)
  const shape = TABLE_SHAPES.includes(input.shape) ? input.shape : ''
  const takeAway = input.takeAway === true || input.takeAway === 1
  if (!name) throw new TableEditError('name_required', 'Enter a table name.')
  if (!Number.isInteger(seats) || seats < 1 || seats > 100) throw new TableEditError('invalid_seats', 'Enter a seat count from 1 to 100.')
  if (!Number.isInteger(minimumSeating) || minimumSeating < 1 || minimumSeating > seats) {
    throw new TableEditError('invalid_minimum', 'Minimum seating must be at least 1 and no more than the seat count.')
  }
  if (!shape) throw new TableEditError('invalid_shape', 'Choose a table shape.')
  const rooms = await branchRooms(tenant.client, tenant.branch)
  if (!room || !rooms.includes(room)) throw new TableEditError('invalid_room', 'Choose a room for this branch.')

  try {
    await tenant.client.getDoc('URY Table', name)
    throw new TableEditError('table_exists', `${name} already exists.`, { status: 409 })
  } catch (err) {
    if (err instanceof TableEditError) throw err
    if (!(err instanceof UryError && err.code === 'not_found')) throw err
  }

  try {
    await tenant.client.post('frappe.client.insert', {
      doc: {
        doctype: 'URY Table',
        name,
        table_name: name,
        restaurant: tenant.uryRestaurant,
        branch: tenant.branch,
        restaurant_room: room,
        no_of_seats: seats,
        minimum_seating: minimumSeating,
        table_shape: shape,
        is_take_away: takeAway ? 1 : 0,
      },
    })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new TableEditError('rejected', err.message, { status: err.status === 409 ? 409 : 422 })
    }
    throw err
  }
  return listUryTables(tenant)
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
