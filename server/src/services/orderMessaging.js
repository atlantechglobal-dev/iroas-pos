import { db } from '../infra/db.js'
import { queueEmail, createNotification } from './identityService.js'
import { isSmtpConfigured, sendEmail } from './emailService.js'

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
    .map((it) => `${it.qty}× ${it.name} — ₹${Math.round(it.unitPrice * it.qty)}`)
    .join('\n')

  const guestBody = [
    `Thanks ${order.guestName} — we received your order at ${restaurantName}.`,
    `Order #${order.publicCode}`,
    `Type: ${modeLabel}`,
    `Payment: ${payLabel}`,
    `Total: ₹${Math.round(order.total)}`,
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
      `Total ₹${Math.round(order.total)}`,
      itemLines,
    ].join('\n')

    createNotification({
      userId: restaurant.owner_id,
      title: `New order #${order.publicCode}`,
      body: `${modeLabel} · ₹${Math.round(order.total)} · ${order.guestName}`,
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
