import { db } from '../infra/db.js'
import { queueEmail, createNotification } from './identityService.js'
import { isSmtpConfigured, sendEmail } from './emailService.js'
import { formatMoney } from '../shared/money.js'

function parseSettings(restaurant) {
  if (!restaurant?.settings_json) return {}
  try {
    return JSON.parse(restaurant.settings_json)
  } catch {
    return {}
  }
}

function ownerWantsEmail(settings) {
  return settings.emailNotifs !== false
}

function insertJob({ restaurantId, orderId, kind, channel, toAddress, subject, body }) {
  db.prepare(
    `INSERT INTO message_jobs
      (restaurant_id, order_id, kind, channel, to_address, subject, body, send_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'queued')`,
  ).run(restaurantId, orderId || null, kind, channel, toAddress || null, subject || null, body)
}

async function deliverNow({ to, subject, body }) {
  if (!to || !isSmtpConfigured()) {
    queueEmail({ to, subject, body })
    return
  }
  const result = await sendEmail({ to, subject, body })
  if (!result.ok) {
    queueEmail({ to, subject, body })
  }
}

export async function onOrderCreated(restaurant, order) {
  const settings = parseSettings(restaurant)
  const restaurantName = restaurant.name || 'the restaurant'
  const modeLabel =
    order.serviceMode === 'dinein'
      ? order.tableName
        ? `Dine-in · ${order.tableName}`
        : 'Dine-in'
      : order.serviceMode === 'delivery'
        ? 'Delivery'
        : 'Takeaway'
  const payLabel =
    order.paymentMethod === 'upi'
      ? `UPI · ${order.paymentStatus === 'paid' ? 'Paid' : 'Pay at counter / scan restaurant UPI'}`
      : `Cash · ${order.paymentStatus === 'paid' ? 'Paid' : 'Pay on collection'}`

  const itemLines = (order.items || [])
    .map((it) => `${it.qty}× ${it.name} — ${formatMoney(it.unitPrice * it.qty)}`)
    .join('\n')

  const guestBody = [
    `Thanks ${order.guestName} — we received your order at ${restaurantName}.`,
    `Order #${order.publicCode}`,
    `Type: ${modeLabel}`,
    `Payment: ${payLabel}`,
    `Total: ${formatMoney(order.total)}`,
    '',
    itemLines,
    order.notes ? `\nNotes: ${order.notes}` : '',
    '',
    'Track your order on the restaurant site (Tracking page) with this order number.',
  ]
    .filter((line) => line != null)
    .join('\n')

  if (order.email) {
    insertJob({
      restaurantId: restaurant.id,
      orderId: order.id,
      kind: 'order_confirmation',
      channel: 'email',
      toAddress: order.email,
      subject: `Order #${order.publicCode} received — ${restaurantName}`,
      body: guestBody,
    })
    await deliverNow({
      to: order.email,
      subject: `Order #${order.publicCode} received — ${restaurantName}`,
      body: guestBody,
    })
  }

  if (settings.newOrderAlert !== false) {
    const ownerBody = [
      `New order #${order.publicCode}`,
      `${order.guestName} · ${order.phone}`,
      modeLabel,
      payLabel,
      `Total ${formatMoney(order.total)}`,
      itemLines,
    ].join('\n')

    createNotification({
      userId: restaurant.owner_id,
      title: `New order #${order.publicCode}`,
      body: `${modeLabel} · ${formatMoney(order.total)} · ${order.guestName}`,
      type: 'order',
      meta: { orderId: order.id, publicCode: order.publicCode },
    })

    if (ownerWantsEmail(settings) && restaurant.email) {
      insertJob({
        restaurantId: restaurant.id,
        orderId: order.id,
        kind: 'order_owner_alert',
        channel: 'email',
        toAddress: restaurant.email,
        subject: `New order #${order.publicCode} — ${restaurantName}`,
        body: ownerBody,
      })
      await deliverNow({
        to: restaurant.email,
        subject: `New order #${order.publicCode} — ${restaurantName}`,
        body: ownerBody,
      })
    }
  }
}

/** Staff alert for a guest order placed straight in the POS (self-ordering or table QR). One alert per invoice. */
export function notifyPosGuestOrder(restaurant, { invoice, table, guestName, total, source }) {
  try {
    const settings = parseSettings(restaurant)
    if (!invoice || settings.newOrderAlert === false) return
    const already = db
      .prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND type = 'pos_order' AND meta_json LIKE ?`)
      .get(restaurant.owner_id, `%"invoice":${JSON.stringify(invoice)}%`)
    if (already) return

    const where = table ? `Table ${table}` : source === 'pickup' ? 'Pickup' : 'Online'
    const who = guestName ? ` · ${guestName}` : ''
    const amount = total != null ? ` · ${formatMoney(total)}` : ''
    const title = `New order ${invoice}`
    const body = `${where}${who}${amount}`
    createNotification({ userId: restaurant.owner_id, type: 'pos_order', title, body, meta: { invoice, table: table || null } })

    if (ownerWantsEmail(settings)) {
      const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(restaurant.owner_id)
      const to = restaurant.email || owner?.email
      if (to) queueEmail({ to, subject: `${title} — ${restaurant.name || 'your restaurant'}`, body: `${body}\n\nOpen Orders in your dashboard to see the items.` })
    }
  } catch (err) {
    console.error('[pos-order-alert] failed', err)
  }
}
