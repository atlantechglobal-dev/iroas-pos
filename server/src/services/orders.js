import { db } from '../infra/db.js'

const STATUS_FLOW = ['new', 'accepted', 'preparing', 'ready', 'completed']

function parseJson(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function makePublicCode() {
  return String(10000 + Math.floor(Math.random() * 90000))
}

export function mapOrder(row, items = null) {
  if (!row) return null
  const lineItems =
    items ||
    db
      .prepare(
        `SELECT id, menu_item_id AS menuItemId, name, unit_price AS unitPrice, qty, extras_json AS extrasJson
         FROM order_items WHERE order_id = ? ORDER BY id ASC`,
      )
      .all(row.id)
      .map((it) => ({
        id: it.id,
        menuItemId: it.menuItemId,
        name: it.name,
        unitPrice: it.unitPrice,
        price: it.unitPrice,
        qty: it.qty,
        extras: parseJson(it.extrasJson, []),
      }))

  const table = row.dining_table_id
    ? db
        .prepare('SELECT id, name, public_code AS publicCode FROM dining_tables WHERE id = ?')
        .get(row.dining_table_id)
    : null

  return {
    id: row.id,
    publicCode: row.public_code,
    restaurantId: row.restaurant_id,
    serviceMode: row.service_mode,
    diningTableId: row.dining_table_id,
    tableName: table?.name || null,
    tableCode: table?.publicCode || null,
    guestName: row.guest_name,
    phone: row.phone,
    email: row.email || '',
    address: parseJson(row.address_json, null),
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentTiming: row.payment_timing || 'bill_now',
    subtotal: row.subtotal,
    tax: row.tax,
    fees: row.fees,
    total: row.total,
    notes: row.notes || '',
    etaMinutes: row.eta_minutes,
    items: lineItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
  }
}

export function getOrderById(restaurantId, orderId) {
  const row = db
    .prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?')
    .get(orderId, restaurantId)
  return mapOrder(row)
}

export function getOrderByPublicCode(restaurantId, publicCode, { phone } = {}) {
  const row = db
    .prepare('SELECT * FROM orders WHERE restaurant_id = ? AND public_code = ?')
    .get(restaurantId, String(publicCode || '').trim())
  if (!row) return null
  if (phone) {
    const want = String(phone).replace(/\D/g, '')
    const have = String(row.phone || '').replace(/\D/g, '')
    if (want && have && !have.endsWith(want.slice(-10)) && !want.endsWith(have.slice(-10))) {
      return null
    }
  }
  return mapOrder(row)
}

export function listOrdersByPhone(restaurantId, phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 8) return []
  const rows = db
    .prepare(
      `SELECT * FROM orders
       WHERE restaurant_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .all(restaurantId)
  return rows
    .filter((row) => {
      const have = String(row.phone || '').replace(/\D/g, '')
      return have && (have.endsWith(digits.slice(-10)) || digits.endsWith(have.slice(-10)))
    })
    .map((row) => mapOrder(row))
}

export function listOrders(restaurantId, { status, paymentStatus, serviceMode } = {}) {
  let sql = 'SELECT * FROM orders WHERE restaurant_id = ?'
  const params = [restaurantId]
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (paymentStatus) {
    sql += ' AND payment_status = ?'
    params.push(paymentStatus)
  }
  if (serviceMode) {
    sql += ' AND service_mode = ?'
    params.push(serviceMode)
  }
  sql += ' ORDER BY created_at DESC LIMIT 200'
  return db.prepare(sql).all(...params).map((row) => mapOrder(row))
}

export function createGuestOrder(restaurant, payload = {}) {
  const settings = (() => {
    try {
      return restaurant.settings_json ? JSON.parse(restaurant.settings_json) : {}
    } catch {
      return {}
    }
  })()

  if (settings.pauseOrders) {
    return { ok: false, status: 403, error: 'This restaurant is not accepting orders right now.' }
  }

  const guestName = String(payload.guestName || payload.name || '').trim()
  const phone = String(payload.phone || '').trim()
  if (!guestName || !phone) {
    return { ok: false, status: 400, error: 'Name and phone are required.' }
  }

  const itemsIn = Array.isArray(payload.items) ? payload.items : []
  if (!itemsIn.length) {
    return { ok: false, status: 400, error: 'Cart is empty.' }
  }

  let serviceMode = String(payload.serviceMode || 'pickup').toLowerCase()
  if (!['dinein', 'pickup', 'delivery'].includes(serviceMode)) {
    serviceMode = 'pickup'
  }

  let diningTableId = null
  if (payload.diningTableId || payload.tableId || payload.tableCode) {
    const table = payload.tableCode
      ? db
          .prepare(
            `SELECT id FROM dining_tables
             WHERE restaurant_id = ? AND public_code = ? AND active = 1`,
          )
          .get(restaurant.id, String(payload.tableCode).trim())
      : db
          .prepare(
            `SELECT id FROM dining_tables
             WHERE restaurant_id = ? AND id = ? AND active = 1`,
          )
          .get(restaurant.id, Number(payload.diningTableId || payload.tableId))
    if (!table) {
      return { ok: false, status: 400, error: 'Table not found.' }
    }
    diningTableId = table.id
    serviceMode = 'dinein'
  }

  let paymentMethod = String(payload.paymentMethod || payload.payment || 'cash').toLowerCase()
  if (paymentMethod === 'cod') paymentMethod = 'cash'
  if (paymentMethod === 'pay_later' || payload.paymentTiming === 'pay_later') {
    paymentMethod = String(payload.preferredPayment || payload.paymentMethod || 'cash').toLowerCase()
    if (paymentMethod === 'pay_later') paymentMethod = 'cash'
    if (!['upi', 'cash'].includes(paymentMethod)) paymentMethod = 'cash'
  }
  if (!['upi', 'cash'].includes(paymentMethod)) {
    return { ok: false, status: 400, error: 'Choose Cash or UPI.' }
  }

  let paymentTiming = String(payload.paymentTiming || 'bill_now').toLowerCase()
  if (payload.payment === 'pay_later' || payload.paymentMethod === 'pay_later') {
    paymentTiming = 'pay_later'
  }
  if (!['bill_now', 'pay_later'].includes(paymentTiming)) paymentTiming = 'bill_now'
  if (paymentTiming === 'pay_later' && serviceMode !== 'dinein') {
    paymentTiming = 'bill_now'
  }

  const lineRows = []
  for (const raw of itemsIn) {
    const menuItemId = raw.menuItemId || raw.id || null
    let name = String(raw.name || '').trim()
    let unitPrice = Number(raw.unitPrice ?? raw.price)
    const qty = Math.max(1, Math.min(99, Number(raw.qty) || 1))

    if (menuItemId) {
      const menuItem = db
        .prepare(
          `SELECT id, name, price, stock_status, status
           FROM menu_items WHERE id = ? AND restaurant_id = ?`,
        )
        .get(menuItemId, restaurant.id)
      if (!menuItem || menuItem.status !== 'live') {
        return { ok: false, status: 400, error: `Item unavailable: ${name || menuItemId}` }
      }
      if (menuItem.stock_status === 'out') {
        return { ok: false, status: 400, error: `${menuItem.name} is sold out.` }
      }
      name = menuItem.name
      unitPrice = Number(menuItem.price)
    }

    if (!name || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ok: false, status: 400, error: 'Invalid cart item.' }
    }

    lineRows.push({
      menuItemId: menuItemId ? Number(menuItemId) : null,
      name,
      unitPrice,
      qty,
      extras: Array.isArray(raw.extras) ? raw.extras : raw.mods || [],
    })
  }

  const subtotal = lineRows.reduce((sum, it) => sum + it.unitPrice * it.qty, 0)
  const fees = serviceMode === 'delivery' ? Number(payload.deliveryFee ?? 49) || 0 : 0
  const tax = Math.round(subtotal * 0.05)
  const total = subtotal + fees + tax
  const etaMinutes =
    Number(payload.etaMinutes) ||
    (serviceMode === 'dinein' ? 20 : serviceMode === 'pickup' ? 25 : 38)

  let publicCode = makePublicCode()
  for (let i = 0; i < 8; i += 1) {
    const clash = db
      .prepare('SELECT id FROM orders WHERE restaurant_id = ? AND public_code = ?')
      .get(restaurant.id, publicCode)
    if (!clash) break
    publicCode = makePublicCode()
  }

  const address =
    serviceMode === 'delivery'
      ? {
          street: String(payload.street || payload.address?.street || '').trim(),
          city: String(payload.city || payload.address?.city || '').trim(),
          pincode: String(payload.pincode || payload.address?.pincode || '').trim(),
        }
      : null

  if (serviceMode === 'delivery' && !address?.street) {
    return { ok: false, status: 400, error: 'Delivery address is required.' }
  }

  const notes = String(payload.notes || payload.instructions || '').trim() || null
  const email = String(payload.email || '').trim() || null

  const insertOrder = db.prepare(
    `INSERT INTO orders (
      restaurant_id, public_code, service_mode, dining_table_id,
      guest_name, phone, email, address_json, status,
      payment_method, payment_status, payment_timing, subtotal, tax, fees, total,
      notes, eta_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, 'payment_pending', ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, menu_item_id, name, unit_price, qty, extras_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  let orderId
  const run = db.transaction(() => {
    const info = insertOrder.run(
      restaurant.id,
      publicCode,
      serviceMode,
      diningTableId,
      guestName,
      phone,
      email,
      address ? JSON.stringify(address) : null,
      paymentMethod,
      paymentTiming,
      subtotal,
      tax,
      fees,
      total,
      notes,
      etaMinutes,
    )
    orderId = info.lastInsertRowid
    for (const it of lineRows) {
      insertItem.run(
        orderId,
        it.menuItemId,
        it.name,
        it.unitPrice,
        it.qty,
        JSON.stringify(it.extras || []),
      )
    }
  })
  run.immediate()

  return { ok: true, order: getOrderById(restaurant.id, orderId) }
}

export function updateOrderStatus(restaurantId, orderId, status) {
  const next = String(status || '').toLowerCase()
  if (![...STATUS_FLOW, 'cancelled'].includes(next)) {
    return { ok: false, status: 400, error: 'Invalid status.' }
  }
  const row = db
    .prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?')
    .get(orderId, restaurantId)
  if (!row) return { ok: false, status: 404, error: 'Order not found.' }

  db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(next, orderId)

  return { ok: true, order: getOrderById(restaurantId, orderId) }
}

export function markOrderPaid(restaurantId, orderId, { paymentMethod } = {}) {
  const row = db
    .prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?')
    .get(orderId, restaurantId)
  if (!row) return { ok: false, status: 404, error: 'Order not found.' }

  let method = paymentMethod ? String(paymentMethod).toLowerCase() : row.payment_method
  if (method === 'cod') method = 'cash'
  if (!['upi', 'cash'].includes(method)) method = row.payment_method

  db.prepare(
    `UPDATE orders
     SET payment_status = 'paid', payment_method = ?, paid_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(method, orderId)

  return { ok: true, order: getOrderById(restaurantId, orderId) }
}

export function findTableByPublicCode(restaurantId, code) {
  return db
    .prepare(
      `SELECT id, name, seats, zone, public_code AS publicCode
       FROM dining_tables
       WHERE restaurant_id = ? AND public_code = ? AND active = 1`,
    )
    .get(restaurantId, String(code || '').trim())
}

export { STATUS_FLOW }
